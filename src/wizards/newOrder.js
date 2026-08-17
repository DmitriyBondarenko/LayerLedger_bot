import { sendMessage, editMessageText, editMessageReplyMarkup } from "../lib/telegram.js";
import { optionsKeyboard, actionsKeyboard, mergeKeyboards } from "../lib/keyboard.js";
import { setDraft, clearDraft } from "../lib/kv.js";
import { todayISO } from "../lib/date.js";
import { escapeHtml } from "../lib/format.js";
import {
  WORK_TYPES, WORK_TYPE_LABELS,
  ORDER_SOURCES, ORDER_SOURCE_LABELS,
  PRIORITIES, PRIORITY_LABELS,
  CURRENCIES, CURRENCY_LABELS,
} from "../constants.js";
import { createOrder } from "../commands/new-order.js";

const STEPS = [
  { key: "Назва", label: "Назва замовлення", type: "text" },
  { key: "Клієнт", label: "Клієнт", type: "text", optional: true },
  { key: "Тип роботи", label: "Тип роботи", type: "select", options: WORK_TYPES, optionLabels: WORK_TYPE_LABELS },
  { key: "Джерело замовлення", label: "Джерело замовлення", type: "select", options: ORDER_SOURCES, optionLabels: ORDER_SOURCE_LABELS },
  { key: "Дедлайн", label: "Дедлайн", type: "date" },
  { key: "Пріоритет", label: "Пріоритет", type: "select", options: PRIORITIES, optionLabels: PRIORITY_LABELS },
  { key: "Вартість замовлення", label: "Вартість замовлення", type: "number" },
  { key: "Сума передоплати", label: "Сума передоплати", type: "number", optional: true },
  { key: "Валюта", label: "Валюта", type: "select", options: CURRENCIES, optionLabels: CURRENCY_LABELS },
  { key: "Коментар", label: "Коментар", type: "text", optional: true },
];

function isConfirmStep(draft) {
  return draft.step >= STEPS.length;
}

function buildStepKeyboard(step) {
  const keyboards = [];
  if (step.type === "select") keyboards.push(optionsKeyboard(step.options, "w:opt", 2, step.optionLabels));
  if (step.type === "date") {
    keyboards.push(actionsKeyboard([
      { label: "Сьогодні", data: "w:date:today" },
      { label: "Завтра", data: "w:date:tomorrow" },
    ]));
  }
  const bottomRow = [];
  if (step.optional) bottomRow.push({ label: "Пропустити", data: "w:skip" });
  bottomRow.push({ label: "Скасувати", data: "w:cancel" });
  keyboards.push(actionsKeyboard(bottomRow));
  return mergeKeyboards(...keyboards);
}

function renderConfirm(draft) {
  const lines = STEPS.map((step) => `${step.label}: ${draft.data[step.key] ? escapeHtml(draft.data[step.key]) : "—"}`);
  const text = `🔍 <b>Перевірте замовлення:</b>\n\n${lines.join("\n")}\n\nСтворити?`;
  const replyMarkup = actionsKeyboard([
    { label: "✅ Створити", data: "w:confirm" },
    { label: "❌ Скасувати", data: "w:cancel" },
  ]);
  return { text, replyMarkup };
}

function renderStep(draft) {
  if (isConfirmStep(draft)) return renderConfirm(draft);

  const step = STEPS[draft.step];
  let text = `🧾 <b>Нове замовлення</b> — крок ${draft.step + 1}/${STEPS.length}\n\n`;
  if (step.type === "select") {
    text += `Оберіть <b>${step.label}</b>:`;
  } else if (step.type === "date") {
    text += `📅 Введіть <b>${step.label}</b> (YYYY-MM-DD) або оберіть кнопкою:`;
  } else if (step.type === "number") {
    text += `Введіть <b>${step.label}</b> (число)${step.optional ? " або натисніть «Пропустити»" : ""}:`;
  } else {
    text += `Введіть <b>${step.label}</b>${step.optional ? " або натисніть «Пропустити»" : ""}:`;
  }
  return { text, replyMarkup: buildStepKeyboard(step) };
}

async function sendStep(env, chatId, draft) {
  const { text, replyMarkup } = renderStep(draft);
  const res = await sendMessage(env, chatId, text, replyMarkup);
  const body = await res.json();
  draft.messageId = body?.result?.message_id;
  await setDraft(env, chatId, draft);
}

export async function start(env, chatId) {
  await clearDraft(env, chatId);
  await sendStep(env, chatId, { type: "new", step: 0, data: {} });
}

export async function handleText(env, chatId, draft, text) {
  if (isConfirmStep(draft)) return;

  const step = STEPS[draft.step];
  if (step.type === "select") {
    return sendMessage(env, chatId, "Будь ласка, оберіть варіант кнопкою вище.", buildStepKeyboard(step));
  }

  let value = text.trim();
  if (step.type === "number") {
    const num = parseFloat(value.replace(",", "."));
    if (Number.isNaN(num)) {
      return sendMessage(env, chatId, `⚠️ Введіть число для «${step.label}».`, buildStepKeyboard(step));
    }
    value = String(num);
  } else if (step.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return sendMessage(env, chatId, "⚠️ Формат дати: YYYY-MM-DD (наприклад 2026-08-20).", buildStepKeyboard(step));
    }
  } else if (!step.optional && !value) {
    return sendMessage(env, chatId, `⚠️ «${step.label}» — обов'язкове поле.`, buildStepKeyboard(step));
  }

  if (draft.messageId) {
    await editMessageReplyMarkup(env, chatId, draft.messageId, { inline_keyboard: [] }).catch(() => {});
  }
  if (value) draft.data[step.key] = value;
  draft.step += 1;
  await sendStep(env, chatId, draft);
}

export async function handleCallback(env, chatId, messageId, data, draft) {
  const [, action, arg] = data.split(":");

  if (action === "cancel") {
    await clearDraft(env, chatId);
    return editMessageText(env, chatId, messageId, "❌ Створення замовлення скасовано.", { inline_keyboard: [] });
  }

  if (isConfirmStep(draft)) {
    if (action !== "confirm") return;
    const res = await createOrder(env, draft.data);
    await clearDraft(env, chatId);
    if (res.object === "error") {
      return editMessageText(env, chatId, messageId, `⚠️ Помилка при створенні замовлення: ${escapeHtml(res.message)}`, { inline_keyboard: [] });
    }
    return editMessageText(env, chatId, messageId, `Замовлення «${escapeHtml(draft.data["Назва"])}» додано ✅`, { inline_keyboard: [] });
  }

  const step = STEPS[draft.step];
  if (action === "skip" && step.optional) {
    draft.step += 1;
  } else if (action === "opt" && step.type === "select") {
    const value = step.options[parseInt(arg, 10)];
    if (value === undefined) return;
    draft.data[step.key] = value;
    draft.step += 1;
  } else if (action === "date" && step.type === "date") {
    draft.data[step.key] = arg === "today" ? todayISO(0) : todayISO(1);
    draft.step += 1;
  } else {
    return;
  }

  draft.messageId = messageId;
  await setDraft(env, chatId, draft);
  const { text, replyMarkup } = renderStep(draft);
  return editMessageText(env, chatId, messageId, text, replyMarkup);
}

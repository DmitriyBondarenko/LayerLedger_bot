import { sendMessage, editMessageText } from "../lib/telegram.js";
import { optionsKeyboard, actionsKeyboard, mergeKeyboards } from "../lib/keyboard.js";
import { setDraft, clearDraft } from "../lib/kv.js";
import { escapeHtml } from "../lib/format.js";
import { STATUSES, STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "../constants.js";
import { queryActiveOrders } from "../commands/orders.js";
import { applyStatusUpdate, applyPaymentUpdate } from "../commands/status.js";

function orderStepKeyboard(orders) {
  const names = orders.map((o) => o.name);
  return mergeKeyboards(optionsKeyboard(names, "st:o", 1), actionsKeyboard([{ label: "Скасувати", data: "st:cancel" }]));
}

function statusStepKeyboard() {
  return mergeKeyboards(optionsKeyboard(STATUSES, "st:s", 1, STATUS_LABELS), actionsKeyboard([{ label: "Скасувати", data: "st:cancel" }]));
}

function paymentStepKeyboard() {
  return mergeKeyboards(optionsKeyboard(PAYMENT_STATUSES, "st:p", 1, PAYMENT_STATUS_LABELS), actionsKeyboard([{ label: "Пропустити", data: "st:pskip" }]));
}

export async function start(env, chatId) {
  await clearDraft(env, chatId);

  const results = await queryActiveOrders(env);
  if (!results.length) {
    return sendMessage(env, chatId, "Активних замовлень немає 😿");
  }

  const orders = results.map((page) => ({
    id: page.id,
    name: page.properties["Назва"]?.title?.[0]?.plain_text || "(без назви)",
  }));

  const draft = { type: "status", step: 0, orders };
  const res = await sendMessage(env, chatId, "🗂 Оберіть замовлення:", orderStepKeyboard(orders));
  const body = await res.json();
  draft.messageId = body?.result?.message_id;
  return setDraft(env, chatId, draft);
}

export async function handleCallback(env, chatId, messageId, data, draft) {
  const [, action, arg] = data.split(":");

  if (action === "cancel") {
    await clearDraft(env, chatId);
    const text = draft.step === 2
      ? `Статус «${escapeHtml(draft.selectedOrderName)}» вже змінено на Здано ✅. Оплату не оновлено.`
      : "❌ Скасовано.";
    return editMessageText(env, chatId, messageId, text, { inline_keyboard: [] });
  }

  if (draft.step === 0 && action === "o") {
    const order = draft.orders[parseInt(arg, 10)];
    if (!order) return;
    draft.selectedOrderId = order.id;
    draft.selectedOrderName = order.name;
    draft.step = 1;
    draft.messageId = messageId;
    await setDraft(env, chatId, draft);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Замовлення: <b>${escapeHtml(order.name)}</b>\n\n🔄 Оберіть новий статус:`,
      statusStepKeyboard()
    );
  }

  if (draft.step === 1 && action === "s") {
    const newStatus = STATUSES[parseInt(arg, 10)];
    if (!newStatus) return;
    await applyStatusUpdate(env, draft.selectedOrderId, newStatus);

    if (newStatus === "Здано") {
      draft.step = 2;
      draft.messageId = messageId;
      await setDraft(env, chatId, draft);
      return editMessageText(
        env,
        chatId,
        messageId,
        `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\n\n💰 Оплату отримано повністю?`,
        paymentStepKeyboard()
      );
    }

    await clearDraft(env, chatId);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на ${newStatus} ✅`,
      { inline_keyboard: [] }
    );
  }

  if (draft.step === 2 && action === "pskip") {
    await clearDraft(env, chatId);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\nОплату не оновлено.`,
      { inline_keyboard: [] }
    );
  }

  if (draft.step === 2 && action === "p") {
    const paymentStatus = PAYMENT_STATUSES[parseInt(arg, 10)];
    if (!paymentStatus) return;
    await applyPaymentUpdate(env, draft.selectedOrderId, paymentStatus);
    await clearDraft(env, chatId);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\nОплата: ${paymentStatus} ✅`,
      { inline_keyboard: [] }
    );
  }
}

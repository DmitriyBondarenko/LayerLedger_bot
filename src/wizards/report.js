import { sendMessage, editMessageText } from "../lib/telegram.js";
import { actionsKeyboard } from "../lib/keyboard.js";
import { setDraft, clearDraft } from "../lib/kv.js";
import { weekRange, monthRange, computeReport, formatReport } from "../commands/report.js";

const PERIOD_KEYBOARD = actionsKeyboard([
  { label: "📆 Тиждень", data: "rp:week" },
  { label: "🗓 Місяць", data: "rp:month" },
  { label: "✏️ Свій період", data: "rp:custom" },
]);

const CANCEL_KEYBOARD = actionsKeyboard([{ label: "Скасувати", data: "rp:cancel" }]);

const DATE_RANGE_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})$/;

export async function start(env, chatId) {
  await clearDraft(env, chatId);
  const res = await sendMessage(env, chatId, "Оберіть період звіту:", PERIOD_KEYBOARD);
  const body = await res.json();
  return setDraft(env, chatId, { type: "report", step: 0, messageId: body?.result?.message_id });
}

export async function handleCallback(env, chatId, messageId, data, draft) {
  const [, action] = data.split(":");

  if (action === "cancel") {
    await clearDraft(env, chatId);
    return editMessageText(env, chatId, messageId, "❌ Скасовано.", { inline_keyboard: [] });
  }

  if (action === "week" || action === "month") {
    const { start, end } = action === "week" ? weekRange() : monthRange();
    const report = await computeReport(env, start, end);
    await clearDraft(env, chatId);
    return editMessageText(env, chatId, messageId, formatReport(report), { inline_keyboard: [] });
  }

  if (action === "custom") {
    draft.step = 1;
    draft.messageId = messageId;
    await setDraft(env, chatId, draft);
    return editMessageText(
      env,
      chatId,
      messageId,
      "✏️ Введіть період у форматі: YYYY-MM-DD YYYY-MM-DD",
      CANCEL_KEYBOARD
    );
  }
}

export async function handleText(env, chatId, draft, text) {
  if (draft.step !== 1) return;

  const match = DATE_RANGE_RE.exec(text.trim());
  if (!match) {
    return sendMessage(env, chatId, "⚠️ Формат: YYYY-MM-DD YYYY-MM-DD (наприклад 2026-08-01 2026-08-17).", CANCEL_KEYBOARD);
  }

  const [, start, end] = match;
  const report = await computeReport(env, start, end);
  await clearDraft(env, chatId);
  return sendMessage(env, chatId, formatReport(report));
}

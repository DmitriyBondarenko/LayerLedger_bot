import { sendMessage, answerCallbackQuery } from "./lib/telegram.js";
import { isAllowed } from "./lib/auth.js";
import { getDraft, clearDraft } from "./lib/kv.js";
import { menuKeyboard } from "./lib/keyboard.js";
import { START_MESSAGE } from "./constants.js";
import { handleToday, handleTomorrow, handleActive, handleUnpaid, handleOrderDetail } from "./commands/orders.js";
import * as newOrderWizard from "./wizards/new-order.js";
import * as statusWizard from "./wizards/status.js";
import * as reportWizard from "./wizards/report.js";

const MENU_KEYBOARD = menuKeyboard([
  { label: "🧾 Нове замовлення", data: "menu:new" },
  { label: "📅 Сьогодні", data: "menu:today" },
  { label: "🗓 Завтра", data: "menu:tomorrow" },
  { label: "📋 Активні", data: "menu:active" },
  { label: "💸 Неоплачені", data: "menu:unpaid" },
  { label: "💰 Звіт", data: "menu:report" },
  { label: "🔄 Статус", data: "menu:status" },
]);

const COMMANDS = {
  "/start": (env, chatId) => sendMessage(env, chatId, START_MESSAGE, MENU_KEYBOARD),
  "/menu": (env, chatId) => sendMessage(env, chatId, "Меню:", MENU_KEYBOARD),
  "/new": (env, chatId) => newOrderWizard.start(env, chatId),
  "/today": handleToday,
  "/tomorrow": handleTomorrow,
  "/active": handleActive,
  "/unpaid": handleUnpaid,
  "/report": (env, chatId) => reportWizard.start(env, chatId),
  "/status": (env, chatId) => statusWizard.start(env, chatId),
};

async function handleCallbackQuery(env, callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data || "";

  if (!chatId || !isAllowed(env, chatId)) {
    return answerCallbackQuery(env, callbackQuery.id, "Немає доступу", true);
  }

  if (data.startsWith("ord:")) {
    await answerCallbackQuery(env, callbackQuery.id);
    return handleOrderDetail(env, chatId, data.slice("ord:".length));
  }

  if (data.startsWith("menu:")) {
    await answerCallbackQuery(env, callbackQuery.id);
    const handler = COMMANDS["/" + data.slice("menu:".length)];
    return handler?.(env, chatId);
  }

  const draft = await getDraft(env, chatId);
  if (!draft) {
    return answerCallbackQuery(env, callbackQuery.id, "Сесія закінчилась. Почніть команду заново.", true);
  }

  await answerCallbackQuery(env, callbackQuery.id);

  if (draft.type === "new" && data.startsWith("w:")) {
    return newOrderWizard.handleCallback(env, chatId, messageId, data, draft);
  }
  if (draft.type === "status" && data.startsWith("st:")) {
    return statusWizard.handleCallback(env, chatId, messageId, data, draft);
  }
  if (draft.type === "report" && data.startsWith("rp:")) {
    return reportWizard.handleCallback(env, chatId, messageId, data, draft);
  }
}

export async function handleUpdate(env, update) {
  if (update.callback_query) {
    return handleCallbackQuery(env, update.callback_query);
  }

  const message = update.message;
  if (!message || !message.text) return;
  const chatId = message.chat.id;

  if (!isAllowed(env, chatId)) {
    return sendMessage(env, chatId, `🔒 Бот приватний. Ваш chat ID: <code>${chatId}</code>`);
  }

  const text = message.text.trim();

  if (text === "/cancel") {
    await clearDraft(env, chatId);
    return sendMessage(env, chatId, "❌ Скасовано.");
  }

  if (!text.startsWith("/")) {
    const draft = await getDraft(env, chatId);
    if (draft?.type === "new") {
      return newOrderWizard.handleText(env, chatId, draft, text);
    }
    if (draft?.type === "report") {
      return reportWizard.handleText(env, chatId, draft, text);
    }
  }

  const [command, ...args] = text.split(" ");
  const handler = COMMANDS[command];
  if (!handler) {
    return sendMessage(env, chatId, "❓ Не знаю такої команди. Введіть / щоб побачити список.");
  }
  return handler(env, chatId, args);
}

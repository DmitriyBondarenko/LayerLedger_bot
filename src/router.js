import { sendMessage } from "./lib/telegram.js";
import { isAllowed } from "./lib/auth.js";
import { START_MESSAGE, NEW_ORDER_TEMPLATE } from "./constants.js";
import { handleToday, handleTomorrow, handleActive, handleUnpaid } from "./commands/orders.js";
import { handleReport } from "./commands/report.js";
import { handleStatusCommand } from "./commands/status.js";
import { handleNewOrderMessage } from "./commands/new-order.js";

const COMMANDS = {
  "/start": (env, chatId) => sendMessage(env, chatId, START_MESSAGE),
  "/new": (env, chatId) => sendMessage(env, chatId, NEW_ORDER_TEMPLATE),
  "/today": handleToday,
  "/tomorrow": handleTomorrow,
  "/active": handleActive,
  "/unpaid": handleUnpaid,
  "/report": (env, chatId, args) => handleReport(env, chatId, args),
  "/status": (env, chatId, args) => handleStatusCommand(env, chatId, args),
};

export async function handleUpdate(env, update) {
  const message = update.message;
  if (!message || !message.text) return;
  const chatId = message.chat.id;

  if (!isAllowed(env, chatId)) {
    return sendMessage(env, chatId, `Бот приватний. Ваш chat ID: <code>${chatId}</code>`);
  }

  const text = message.text.trim();

  if (text.startsWith("Назва:")) {
    return handleNewOrderMessage(env, chatId, text);
  }

  const [command, ...args] = text.split(" ");
  const handler = COMMANDS[command];
  if (!handler) {
    return sendMessage(env, chatId, "Не знаю такої команди. Введіть / щоб побачити список.");
  }
  return handler(env, chatId, args);
}

import { queryOrders } from "./lib/notion.js";
import { sendMessage } from "./lib/telegram.js";
import { todayISO } from "./lib/date.js";
import { allowedChatIds } from "./lib/auth.js";
import { orderListKeyboard } from "./lib/keyboard.js";
import { ACTIVE_STATUSES } from "./constants.js";
import { toOrderButtons } from "./commands/orders.js";

export async function handleReminders(env) {
  const results = await queryOrders(env, {
    and: [
      { property: "Дедлайн", date: { equals: todayISO(1) } },
      { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    ],
  });
  if (!results.length) return;

  const orders = toOrderButtons(results, (page) => page.properties["Статус"]?.select?.name || "-");
  const keyboard = orderListKeyboard(orders);
  for (const chatId of allowedChatIds(env)) {
    await sendMessage(env, chatId, "⏰ <b>Нагадування — дедлайн завтра:</b>", keyboard);
  }
}

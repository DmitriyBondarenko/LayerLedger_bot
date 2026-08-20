import { queryOrders } from "./lib/notion.js";
import { sendMessage } from "./lib/telegram.js";
import { todayISO } from "./lib/date.js";
import { allowedChatIds } from "./lib/auth.js";
import { orderListKeyboard } from "./lib/keyboard.js";
import { ACTIVE_STATUSES } from "./constants.js";
import { toOrderButtons } from "./commands/orders.js";
import { statusLabel } from "./lib/format.js";

function queryActiveOrdersByDeadline(env, date) {
  return queryOrders(env, {
    and: [
      { property: "Дедлайн", date: { equals: date } },
      { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    ],
  });
}

export async function handleReminders(env) {
  const [todayOrders, tomorrowOrders] = await Promise.all([
    queryActiveOrdersByDeadline(env, todayISO(0)),
    queryActiveOrdersByDeadline(env, todayISO(1)),
  ]);
  if (!todayOrders.length && !tomorrowOrders.length) return;

  const hint = (page) => statusLabel(page.properties["Статус"]?.select?.name);
  for (const chatId of allowedChatIds(env)) {
    if (todayOrders.length) {
      const keyboard = orderListKeyboard(toOrderButtons(todayOrders, hint));
      await sendMessage(env, chatId, "⏰ <b>Нагадування — дедлайн сьогодні:</b>", keyboard);
    }
    if (tomorrowOrders.length) {
      const keyboard = orderListKeyboard(toOrderButtons(tomorrowOrders, hint));
      await sendMessage(env, chatId, "⏰ <b>Нагадування — дедлайн завтра:</b>", keyboard);
    }
  }
}

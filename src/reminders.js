import { queryOrders } from "./lib/notion.js";
import { sendMessage } from "./lib/telegram.js";
import { todayISO } from "./lib/date.js";
import { allowedChatIds } from "./lib/auth.js";
import { fmtOrder } from "./lib/format.js";
import { ACTIVE_STATUSES } from "./constants.js";

export async function handleReminders(env) {
  const results = await queryOrders(env, {
    and: [
      { property: "Дедлайн", date: { equals: todayISO(1) } },
      { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    ],
  });
  if (!results.length) return;
  const text = "⏰ <b>Нагадування — дедлайн завтра:</b>\n\n" + results.map(fmtOrder).join("\n\n");
  for (const chatId of allowedChatIds(env)) {
    await sendMessage(env, chatId, text);
  }
}

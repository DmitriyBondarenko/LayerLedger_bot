import { queryOrders } from "../lib/notion.js";
import { sendMessage } from "../lib/telegram.js";
import { todayISO } from "../lib/date.js";
import { fmtOrder } from "../lib/format.js";
import { ACTIVE_STATUSES } from "../constants.js";

export async function handleToday(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(0) },
  });
  if (!results.length) return sendMessage(env, chatId, "На сьогодні дедлайнів немає 🎉");
  return sendMessage(env, chatId, "📅 <b>Сьогодні:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

export async function handleTomorrow(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(1) },
  });
  if (!results.length) return sendMessage(env, chatId, "На завтра дедлайнів немає 🎉");
  return sendMessage(env, chatId, "📅 <b>Завтра:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

export function queryActiveOrders(env) {
  return queryOrders(
    env,
    { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    [{ property: "Дедлайн", direction: "ascending" }]
  );
}

export async function handleActive(env, chatId) {
  const results = await queryActiveOrders(env);
  if (!results.length) return sendMessage(env, chatId, "Активних замовлень немає.");
  return sendMessage(env, chatId, "📋 <b>Активні замовлення:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

export async function handleUnpaid(env, chatId) {
  const results = await queryOrders(env, {
    or: ["Не оплачено", "Частково"].map((s) => ({ property: "Статус оплати", select: { equals: s } })),
  });
  if (!results.length) return sendMessage(env, chatId, "Все оплачено ✅");
  return sendMessage(env, chatId, "💸 <b>Оплачено не повністю:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

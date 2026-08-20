import { queryOrders, getPage } from "../lib/notion.js";
import { sendMessage } from "../lib/telegram.js";
import { todayISO, formatDisplayDate } from "../lib/date.js";
import { orderName, fmtOrderDetail } from "../lib/format.js";
import { orderListKeyboard } from "../lib/keyboard.js";
import { ACTIVE_STATUSES, STATUSES, STATUS_LABELS } from "../constants.js";

function statusLabel(name) {
  const index = STATUSES.indexOf(name);
  return index === -1 ? name || "-" : STATUS_LABELS[index];
}

// Turns query results into {id, label} pairs for orderListKeyboard, where `hint`
// appends a bit of context relevant to that particular list (status, deadline, price...).
export function toOrderButtons(results, hint) {
  return results.map((page) => ({
    id: page.id,
    label: hint ? `${orderName(page)} — ${hint(page)}` : orderName(page),
  }));
}

export async function handleToday(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(0) },
  });
  if (!results.length) return sendMessage(env, chatId, "На сьогодні дедлайнів немає 🎉");
  const orders = toOrderButtons(results, (page) => page.properties["Статус"]?.select?.name || "-");
  return sendMessage(env, chatId, "📅 <b>Сьогодні:</b>", orderListKeyboard(orders));
}

export async function handleTomorrow(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(1) },
  });
  if (!results.length) return sendMessage(env, chatId, "На завтра дедлайнів немає 🎉");
  const orders = toOrderButtons(results, (page) => page.properties["Статус"]?.select?.name || "-");
  return sendMessage(env, chatId, "📅 <b>Завтра:</b>", orderListKeyboard(orders));
}

export function queryActiveOrders(env) {
  return queryOrders(
    env,
    { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    [{ property: "Дедлайн", direction: "ascending" }]
  );
}

// Active orders plus Здано orders that aren't fully paid yet, so /status can
// also be used to update payment on an order that's already been delivered.
// Excluding fully-paid Здано orders keeps this list from growing forever —
// there's nothing left to do on those in this flow.
export function queryStatusChangeableOrders(env) {
  return queryOrders(
    env,
    {
      or: [
        ...ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })),
        {
          and: [
            { property: "Статус", select: { equals: "Здано" } },
            { property: "Статус оплати", select: { does_not_equal: "Оплачено повністю" } },
          ],
        },
      ],
    },
    [{ property: "Дедлайн", direction: "ascending" }]
  );
}

export async function handleActive(env, chatId) {
  const results = await queryActiveOrders(env);
  if (!results.length) return sendMessage(env, chatId, "Активних замовлень немає 😿");
  const orders = toOrderButtons(results, (page) => {
    const deadline = formatDisplayDate(page.properties["Дедлайн"]?.date?.start) || "без дедлайну";
    const status = statusLabel(page.properties["Статус"]?.select?.name);
    return `${deadline} · ${status}`;
  });
  return sendMessage(env, chatId, "📋 <b>Активні замовлення:</b>", orderListKeyboard(orders));
}

export async function handleUnpaid(env, chatId) {
  const results = await queryOrders(env, {
    or: ["Не оплачено", "Частково"].map((s) => ({ property: "Статус оплати", select: { equals: s } })),
  });
  if (!results.length) return sendMessage(env, chatId, "Все оплачено ✅");
  const orders = toOrderButtons(results, (page) => {
    const cost = page.properties["Вартість замовлення"]?.number ?? "-";
    const currency = page.properties["Валюта"]?.select?.name || "";
    return `${cost} ${currency}`.trim();
  });
  return sendMessage(env, chatId, "💸 <b>Оплачено не повністю:</b>", orderListKeyboard(orders));
}

export async function handleOrderDetail(env, chatId, pageId) {
  const page = await getPage(env, pageId);
  if (page.object === "error") {
    return sendMessage(env, chatId, "⚠️ Не вдалося знайти замовлення (можливо, видалено).");
  }
  return sendMessage(env, chatId, fmtOrderDetail(page));
}

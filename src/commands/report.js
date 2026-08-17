import { queryOrders } from "../lib/notion.js";
import { todayISO, formatDisplayDate } from "../lib/date.js";

export function weekRange() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  return { start: monday.toISOString().slice(0, 10), end: todayISO(0) };
}

export function monthRange() {
  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { start, end: todayISO(0) };
}

export async function computeReport(env, start, end) {
  const results = await queryOrders(env, {
    and: [
      { property: "Дата отримання", date: { on_or_after: start } },
      { property: "Дата отримання", date: { on_or_before: end } },
    ],
  });

  const byCurrency = {};
  for (const page of results) {
    const p = page.properties;
    const currency = p["Валюта"]?.select?.name || "—";
    const cost = p["Вартість замовлення"]?.number || 0;
    const prepaid = p["Сума передоплати"]?.number || 0;
    const status = p["Статус оплати"]?.select?.name;
    const paid = status === "Оплачено повністю" ? cost : prepaid;

    if (!byCurrency[currency]) byCurrency[currency] = { count: 0, total: 0, paid: 0 };
    byCurrency[currency].count += 1;
    byCurrency[currency].total += cost;
    byCurrency[currency].paid += paid;
  }

  return { start, end, orderCount: results.length, byCurrency };
}

export function formatReport(report) {
  const { start, end, orderCount, byCurrency } = report;
  const header = `💰 <b>Звіт (${formatDisplayDate(start)} — ${formatDisplayDate(end)}):</b>`;

  if (!orderCount) {
    return `${header}\n\nЗамовлень немає 😿`;
  }

  const sections = Object.entries(byCurrency).map(([currency, { count, total, paid }]) =>
    `<b>${currency}</b>\n` +
    `Замовлень: ${count}\n` +
    `Загальна сума: ${total}\n` +
    `Оплачено: ${paid}\n` +
    `Залишилось отримати: ${total - paid}`
  );

  return `${header}\n\n${sections.join("\n\n")}`;
}

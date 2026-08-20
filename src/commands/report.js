import { queryOrders } from "../lib/notion.js";
import { todayISO, formatDisplayDate } from "../lib/date.js";
import { workTypeLabel } from "../lib/format.js";

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
    const workType = p["Тип роботи"]?.select?.name || "—";

    if (!byCurrency[currency]) byCurrency[currency] = { count: 0, total: 0, paid: 0, byWorkType: {} };
    const bucket = byCurrency[currency];
    bucket.count += 1;
    bucket.total += cost;
    bucket.paid += paid;

    if (!bucket.byWorkType[workType]) bucket.byWorkType[workType] = { count: 0, total: 0 };
    bucket.byWorkType[workType].count += 1;
    bucket.byWorkType[workType].total += cost;
  }

  return { start, end, orderCount: results.length, byCurrency };
}

export function formatReport(report) {
  const { start, end, orderCount, byCurrency } = report;
  const header = `💰 <b>Звіт (${formatDisplayDate(start)} — ${formatDisplayDate(end)}):</b>`;

  if (!orderCount) {
    return `${header}\n\nЗамовлень немає 😿`;
  }

  const sections = Object.entries(byCurrency).map(([currency, { count, total, paid, byWorkType }]) => {
    const workTypeLines = Object.entries(byWorkType)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([type, { count, total }]) => `${workTypeLabel(type)}: ${count} · ${total}`)
      .join("\n");

    return (
      `<b>${currency}</b>\n` +
      `Замовлень: ${count}\n` +
      `Загальна сума: ${total}\n` +
      `Оплачено: ${paid}\n` +
      `Залишилось отримати: ${total - paid}\n\n` +
      `За типом роботи:\n${workTypeLines}`
    );
  });

  return `${header}\n\n${sections.join("\n\n")}`;
}

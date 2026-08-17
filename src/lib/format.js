import { formatDisplayDate } from "./date.js";

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Plain (unescaped) order name — for Telegram button text, which doesn't render HTML.
export function orderName(page) {
  return page.properties["Назва"]?.title?.[0]?.plain_text || "(без назви)";
}

export function fmtOrderDetail(page) {
  const p = page.properties;
  const name = escapeHtml(orderName(page));
  const client = p["Клієнт"]?.rich_text?.[0]?.plain_text;
  const workType = p["Тип роботи"]?.select?.name;
  const source = p["Джерело замовлення"]?.select?.name;
  const deadline = formatDisplayDate(p["Дедлайн"]?.date?.start);
  const priority = p["Пріоритет"]?.select?.name;
  const cost = p["Вартість замовлення"]?.number;
  const currency = p["Валюта"]?.select?.name || "";
  const prepaid = p["Сума передоплати"]?.number;
  const received = formatDisplayDate(p["Дата отримання"]?.date?.start);
  const status = p["Статус"]?.select?.name || "-";
  const paymentStatus = p["Статус оплати"]?.select?.name || "-";
  const deliveredAt = formatDisplayDate(p["Фактична дата здачі"]?.date?.start);
  const comment = p["Коментар"]?.rich_text?.[0]?.plain_text;

  const lines = [`🧾 <b>${name}</b>`];
  if (client) lines.push(`👤 Клієнт: ${escapeHtml(client)}`);
  if (workType) lines.push(`🏷 Тип роботи: ${workType}`);
  if (source) lines.push(`📍 Джерело: ${source}`);
  if (deadline) lines.push(`📅 Дедлайн: ${deadline}`);
  if (priority) lines.push(`⚡ Пріоритет: ${priority}`);
  if (cost != null) lines.push(`💵 Вартість: ${cost} ${currency}`);
  if (prepaid != null) lines.push(`💳 Передоплата: ${prepaid} ${currency}`);
  if (received) lines.push(`🗓 Дата отримання: ${received}`);
  lines.push(`🔄 Статус: ${status}`);
  lines.push(`💰 Оплата: ${paymentStatus}`);
  if (deliveredAt) lines.push(`✅ Здано: ${deliveredAt}`);
  if (comment) lines.push(`💬 Коментар: ${escapeHtml(comment)}`);

  return lines.join("\n");
}

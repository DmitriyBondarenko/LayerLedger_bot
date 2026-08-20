import { formatDisplayDate } from "./date.js";
import { STATUSES, STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, WORK_TYPES, WORK_TYPE_LABELS } from "../constants.js";

// Emoji-labeled equivalent of a raw Notion select value, e.g. "В роботі" -> "🔧 В роботі".
// Shared by every order list/detail view so status reads the same everywhere.
export function statusLabel(name) {
  const index = STATUSES.indexOf(name);
  return index === -1 ? name || "-" : STATUS_LABELS[index];
}

export function paymentStatusLabel(name) {
  const index = PAYMENT_STATUSES.indexOf(name);
  return index === -1 ? name || "-" : PAYMENT_STATUS_LABELS[index];
}

export function workTypeLabel(name) {
  const index = WORK_TYPES.indexOf(name);
  return index === -1 ? name || "-" : WORK_TYPE_LABELS[index];
}

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
  const status = statusLabel(p["Статус"]?.select?.name);
  const paymentStatus = paymentStatusLabel(p["Статус оплати"]?.select?.name);
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

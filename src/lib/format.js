import { formatDisplayDate } from "./date.js";

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fmtOrder(page) {
  const p = page.properties;
  const name = escapeHtml(p["Назва"]?.title?.[0]?.plain_text || "(без назви)");
  const client = escapeHtml(p["Клієнт"]?.rich_text?.[0]?.plain_text || "-");
  const deadline = formatDisplayDate(p["Дедлайн"]?.date?.start) || "-";
  const cost = p["Вартість замовлення"]?.number ?? "-";
  const currency = p["Валюта"]?.select?.name || "";
  const status = p["Статус"]?.select?.name || "-";
  return `• <b>${name}</b> (${client})\n  Дедлайн: ${deadline} | ${cost} ${currency} | ${status}`;
}

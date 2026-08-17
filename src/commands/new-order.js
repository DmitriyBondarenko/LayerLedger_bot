import { notionApi } from "../lib/notion.js";
import { sendMessage } from "../lib/telegram.js";
import { todayISO } from "../lib/date.js";
import { escapeHtml } from "../lib/format.js";

export function parseOrderMessage(text) {
  const data = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value) data[key] = value;
  }
  return data;
}

export async function handleNewOrderMessage(env, chatId, text) {
  const data = parseOrderMessage(text);
  if (!data["Назва"]) {
    return sendMessage(env, chatId, "Не вистачає поля Назва — замовлення не створено.");
  }

  const properties = {
    "Назва": { title: [{ text: { content: data["Назва"] } }] },
    "Дата отримання": { date: { start: todayISO(0) } },
    "Статус": { select: { name: "В черзі" } },
    "Статус оплати": { select: { name: "Не оплачено" } },
    "Передоплата отримана": { checkbox: false },
  };

  if (data["Клієнт"]) properties["Клієнт"] = { rich_text: [{ text: { content: data["Клієнт"] } }] };
  if (data["Тип роботи"]) properties["Тип роботи"] = { select: { name: data["Тип роботи"] } };
  if (data["Джерело замовлення"]) properties["Джерело замовлення"] = { select: { name: data["Джерело замовлення"] } };
  if (data["Дедлайн"]) properties["Дедлайн"] = { date: { start: data["Дедлайн"] } };
  if (data["Пріоритет"]) properties["Пріоритет"] = { select: { name: data["Пріоритет"] } };
  if (data["Вартість замовлення"]) properties["Вартість замовлення"] = { number: parseFloat(data["Вартість замовлення"]) };
  if (data["Сума передоплати"]) {
    const amt = parseFloat(data["Сума передоплати"]);
    properties["Сума передоплати"] = { number: amt };
    if (amt > 0) {
      properties["Передоплата отримана"] = { checkbox: true };
      properties["Статус оплати"] = { select: { name: "Частково" } };
    }
  }
  if (data["Валюта"]) properties["Валюта"] = { select: { name: data["Валюта"] } };
  if (data["Коментар"]) properties["Коментар"] = { rich_text: [{ text: { content: data["Коментар"] } }] };

  const res = await notionApi(env, "pages", "POST", {
    parent: { database_id: env.NOTION_DATABASE_ID },
    properties,
  });

  if (res.object === "error") {
    return sendMessage(env, chatId, `Помилка при створенні замовлення: ${escapeHtml(res.message)}`);
  }
  return sendMessage(env, chatId, `Замовлення «${escapeHtml(data["Назва"])}» додано ✅`);
}

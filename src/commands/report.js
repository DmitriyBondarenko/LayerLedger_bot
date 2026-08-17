import { queryOrders } from "../lib/notion.js";
import { sendMessage } from "../lib/telegram.js";
import { todayISO } from "../lib/date.js";

export async function handleReport(env, chatId, args) {
  let start, end;
  const period = (args[0] || "month").toLowerCase();
  const now = new Date();

  if (period === "week") {
    const day = now.getUTCDay() || 7;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - day + 1);
    start = monday.toISOString().slice(0, 10);
    end = todayISO(0);
  } else if (period === "month") {
    start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    end = todayISO(0);
  } else if (args.length === 2) {
    start = args[0];
    end = args[1];
  } else {
    return sendMessage(env, chatId, "Формат: /report week, /report month, або /report YYYY-MM-DD YYYY-MM-DD");
  }

  const results = await queryOrders(env, {
    and: [
      { property: "Дата отримання", date: { on_or_after: start } },
      { property: "Дата отримання", date: { on_or_before: end } },
    ],
  });

  let total = 0;
  let paid = 0;
  for (const page of results) {
    const cost = page.properties["Вартість замовлення"]?.number || 0;
    const prepaid = page.properties["Сума передоплати"]?.number || 0;
    const status = page.properties["Статус оплати"]?.select?.name;
    total += cost;
    paid += status === "Оплачено повністю" ? cost : prepaid;
  }

  const text =
    `💰 <b>Звіт (${start} — ${end}):</b>\n\n` +
    `Замовлень: ${results.length}\n` +
    `Загальна сума: ${total}\n` +
    `Оплачено: ${paid}\n` +
    `Залишилось отримати: ${total - paid}`;
  return sendMessage(env, chatId, text);
}

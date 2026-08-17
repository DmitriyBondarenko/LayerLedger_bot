import { queryOrders, notionApi } from "../lib/notion.js";
import { sendMessage } from "../lib/telegram.js";
import { todayISO } from "../lib/date.js";
import { escapeHtml } from "../lib/format.js";
import { STATUSES } from "../constants.js";

export async function handleStatusCommand(env, chatId, args) {
  const raw = args.join(" ");
  const [orderName, newStatus] = raw.split("|").map((s) => (s || "").trim());

  if (!orderName || !newStatus || !STATUSES.includes(newStatus)) {
    return sendMessage(
      env,
      chatId,
      `Формат: /status Назва замовлення | Новий статус\nСтатуси: ${STATUSES.join(", ")}`
    );
  }

  const results = await queryOrders(env, { property: "Назва", title: { contains: orderName } });
  if (!results.length) return sendMessage(env, chatId, `Замовлення «${orderName}» не знайдено.`);

  const page = results[0];
  const props = { "Статус": { select: { name: newStatus } } };
  if (newStatus === "Здано") {
    props["Фактична дата здачі"] = { date: { start: todayISO(0) } };
  }
  await notionApi(env, `pages/${page.id}`, "PATCH", { properties: props });
  return sendMessage(env, chatId, `Статус «${escapeHtml(orderName)}» змінено на ${newStatus} ✅`);
}

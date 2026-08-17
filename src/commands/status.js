import { notionApi } from "../lib/notion.js";
import { todayISO } from "../lib/date.js";

export function applyStatusUpdate(env, pageId, newStatus) {
  const props = { "Статус": { select: { name: newStatus } } };
  if (newStatus === "Здано") {
    props["Фактична дата здачі"] = { date: { start: todayISO(0) } };
  }
  return notionApi(env, `pages/${pageId}`, "PATCH", { properties: props });
}

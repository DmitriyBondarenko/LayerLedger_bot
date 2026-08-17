import { NOTION_VERSION } from "../constants.js";

export async function notionApi(env, path, method = "POST", body) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function queryOrders(env, filter, sorts) {
  const res = await notionApi(env, `databases/${env.NOTION_DATABASE_ID}/query`, "POST", {
    filter,
    sorts,
  });
  return res.results || [];
}

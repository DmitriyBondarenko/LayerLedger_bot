// ============================================================
// LayerLedger — Telegram bot (Cloudflare Worker)
// Order & income manager, backed by a Notion database.
//
// Requires 4 secrets (Cloudflare dashboard → Worker → Settings → Variables):
//   TELEGRAM_BOT_TOKEN  — token from @BotFather
//   NOTION_API_KEY      — Internal Integration Secret from Notion
//   NOTION_DATABASE_ID  — the Orders database ID
//   ALLOWED_CHAT_ID     — one or more allowed Telegram chat ids, comma-separated
//                         (e.g. "111111111,222222222")
//                         Leave as "0" at first — the bot will tell you
//                         the real chat id the first time each of you messages it.
//
// Requires a Cron Trigger (Settings → Triggers) for the daily reminder,
// e.g. "0 7 * * 1-5" (~10:00 Kyiv time in summer, UTC has no DST).
// ============================================================

import { handleUpdate } from "./router.js";
import { handleReminders } from "./reminders.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("LayerLedger bot is running.", { status: 200 });
    }
    try {
      const update = await request.json();
      await handleUpdate(env, update);
    } catch (err) {
      console.error(err);
    }
    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleReminders(env));
  },
};

# LayerLedger

A private Telegram bot that manages freelance orders and income, backed by a
Notion database. Runs as a Cloudflare Worker.

## What it does

- **`/new`** — creates an order through a step-by-step wizard (buttons for
  select fields, typed input for free text/numbers/dates).
- **`/status`** — pick an active (or already **Здано** but not fully paid)
  order, pick its new status via buttons; if you mark it **Здано**, it also
  asks for the payment status. Picking an order that's already **Здано**
  skips straight to the payment-status prompt, so you can mark it paid
  without touching status again. Marking an order **Оплачено повністю**
  while it's **Здано** automatically moves it to **Архів**.
- **`/today`**, **`/tomorrow`** — orders with a deadline today / tomorrow.
- **`/active`** — all orders that are В черзі / В роботі / На правках.
- **`/unpaid`** — orders that aren't fully paid.
- **`/report [week|month|YYYY-MM-DD YYYY-MM-DD]`** — income summary for a
  period.
- **`/cancel`** — aborts an in-progress `/new` or `/status` wizard.
- A daily cron job (weekdays, 07:00 UTC) reminds every allowed chat about
  active orders with a deadline today and/or tomorrow — sent as two separate
  messages when both apply.

The bot is restricted to an allowlist of Telegram chat ids — anyone else
messaging it just gets told their chat id, so you can add it to the
allowlist.

## Architecture

```
src/
  index.js          Worker entry point (fetch/scheduled handlers)
  router.js          Routes Telegram updates to commands/wizards
  reminders.js        Daily cron job
  constants.js         Status/priority/etc. option lists, help text
  lib/
    telegram.js         Telegram Bot API calls
    notion.js            Notion API calls
    kv.js                 Wizard draft state (Cloudflare KV)
    keyboard.js            Inline keyboard builders
    date.js                 Date helpers/formatting
    auth.js                  Allowed chat id checks
    format.js                 HTML escaping, order list formatting
  commands/
    orders.js            /today, /tomorrow, /active, /unpaid
    report.js             /report
    status.js              Notion status/payment update helpers
    new-order.js            Notion order-creation helper
  wizards/
    new-order.js           /new step machine
    status.js                /status step machine
```

Wizard state for `/new` and `/status` is stored per chat in a Cloudflare KV
namespace (`DRAFTS`) with a 30-minute TTL, since a Worker has no memory
between requests.

## Setup

### 1. Notion

1. Create an [internal integration](https://www.notion.so/my-integrations)
   and copy its secret — this is `NOTION_API_KEY`.
2. Create (or reuse) a database named **Orders** and share it with the
   integration. Copy its database id from the URL — this is
   `NOTION_DATABASE_ID`.
3. The database needs these properties (exact Ukrainian names, matching the
   option lists in `src/constants.js`):

   | Property | Type | Options |
   |---|---|---|
   | Назва | Title | — |
   | Клієнт | Text | — |
   | Тип роботи | Select | Рілс, Креатив, Моушн, Карусель, Презентація, Інше, Проєкт |
   | Джерело замовлення | Select | Інстаграм, Тредс, Реферал, Постійний клієнт |
   | Дедлайн | Date | — |
   | Пріоритет | Select | Високий, Середній, Низький |
   | Вартість замовлення | Number | — |
   | Сума передоплати | Number | — |
   | Валюта | Select | UAH, USD |
   | Коментар | Text | — |
   | Дата отримання | Date | — |
   | Статус | Select | В черзі, В роботі, На правках, Здано, Архів |
   | Статус оплати | Select | Не оплачено, Частково, Оплачено повністю |
   | Передоплата отримана | Checkbox | — |
   | Фактична дата здачі | Date | — |

   If you change these options in Notion, update the matching arrays in
   `src/constants.js` to keep the bot's buttons in sync.

### 2. Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy its
   token — this is `TELEGRAM_BOT_TOKEN`.
2. Message the bot once yourself (and anyone else who should use it) — it
   will reply with your chat id since you're not allowed yet.

### 3. Cloudflare

1. Create the KV namespace used for wizard state:
   ```
   npx wrangler kv namespace create DRAFTS
   ```
   Paste the returned id into the `[[kv_namespaces]]` block in
   `wrangler.toml`.
2. Set secrets (Worker → Settings → Variables, or `wrangler secret put`):
   - `TELEGRAM_BOT_TOKEN`
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID`
   - `ALLOWED_CHAT_ID` — comma-separated chat ids (e.g. `111,222`). Start
     with `0`, message the bot to learn each chat id, then update this.
3. Deploy:
   ```
   npx wrangler deploy
   ```
4. Point Telegram at the deployed Worker:
   ```
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<worker-url>"
   ```

The cron trigger for daily reminders is already defined in
`wrangler.toml` and gets applied on deploy — no manual dashboard setup
needed.

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
// e.g. "0 7 * * *" (~10:00 Kyiv time in summer, UTC has no DST).
// ============================================================

const NOTION_VERSION = "2022-06-28";

const STATUSES = ["В черзі", "В роботі", "На правках", "Здано", "Архів"];
const ACTIVE_STATUSES = ["В черзі", "В роботі", "На правках"];

// ---------- low-level API helpers ----------

function telegramApi(env, method, body) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sendMessage(env, chatId, text) {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
}

async function notionApi(env, path, method = "POST", body) {
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

async function queryOrders(env, filter, sorts) {
  const res = await notionApi(env, `databases/${env.NOTION_DATABASE_ID}/query`, "POST", {
    filter,
    sorts,
  });
  return res.results || [];
}

// ---------- small helpers ----------

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function allowedChatIds(env) {
  return String(env.ALLOWED_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowed(env, chatId) {
  return allowedChatIds(env).includes(String(chatId));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtOrder(page) {
  const p = page.properties;
  const name = escapeHtml(p["Назва"]?.title?.[0]?.plain_text || "(без назви)");
  const client = escapeHtml(p["Клієнт"]?.rich_text?.[0]?.plain_text || "-");
  const deadline = p["Дедлайн"]?.date?.start || "-";
  const cost = p["Вартість замовлення"]?.number ?? "-";
  const currency = p["Валюта"]?.select?.name || "";
  const status = p["Статус"]?.select?.name || "-";
  return `• <b>${name}</b> (${client})\n  Дедлайн: ${deadline} | ${cost} ${currency} | ${status}`;
}

// ---------- read commands ----------

async function handleToday(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(0) },
  });
  if (!results.length) return sendMessage(env, chatId, "На сьогодні дедлайнів немає 🎉");
  return sendMessage(env, chatId, "📅 <b>Сьогодні:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

async function handleTomorrow(env, chatId) {
  const results = await queryOrders(env, {
    property: "Дедлайн",
    date: { equals: todayISO(1) },
  });
  if (!results.length) return sendMessage(env, chatId, "На завтра дедлайнів немає 🎉");
  return sendMessage(env, chatId, "📅 <b>Завтра:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

async function handleActive(env, chatId) {
  const results = await queryOrders(
    env,
    { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    [{ property: "Дедлайн", direction: "ascending" }]
  );
  if (!results.length) return sendMessage(env, chatId, "Активних замовлень немає.");
  return sendMessage(env, chatId, "📋 <b>Активні замовлення:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

async function handleUnpaid(env, chatId) {
  const results = await queryOrders(env, {
    or: ["Не оплачено", "Частково"].map((s) => ({ property: "Статус оплати", select: { equals: s } })),
  });
  if (!results.length) return sendMessage(env, chatId, "Все оплачено ✅");
  return sendMessage(env, chatId, "💸 <b>Оплачено не повністю:</b>\n\n" + results.map(fmtOrder).join("\n\n"));
}

async function handleReport(env, chatId, args) {
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

async function handleStatusCommand(env, chatId, args) {
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

// ---------- create new order ----------

const NEW_ORDER_TEMPLATE = `Надішліть замовлення одним повідомленням у такому форматі (кожне поле з нового рядка, непотрібні рядки можна прибрати):

Назва: 
Клієнт: 
Тип роботи: Банер/Моушн/Соцмережі/Логотип/Презентація/Інше
Джерело замовлення: Біржа/Соцмережі/Реферал/Постійний клієнт/Пряме звернення
Дедлайн: YYYY-MM-DD
Пріоритет: Високий/Середній/Низький
Вартість замовлення: 
Сума передоплати: 
Валюта: UAH/USD/EUR
Коментар: `;

function parseOrderMessage(text) {
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

async function handleNewOrderMessage(env, chatId, text) {
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

// ---------- welcome message ----------

const START_MESSAGE = `Привіт! Я LayerLedger 👋
Веду облік замовлень та доходу, все зберігаю в Notion.

<b>Що я вмію:</b>

<b>/new</b> — додати нове замовлення (надішлю шаблон, заповнюєте і надсилаєте одним повідомленням)
<b>/today</b> — замовлення з дедлайном сьогодні
<b>/tomorrow</b> — замовлення з дедлайном завтра
<b>/active</b> — всі активні замовлення (в черзі, в роботі, на правках)
<b>/unpaid</b> — замовлення, які ще не оплачені повністю
<b>/report</b> — дохід за період: /report week, /report month або /report РРРР-ММ-ДД РРРР-ММ-ДД
<b>/status</b> — змінити статус: /status Назва замовлення | Новий статус

🔔 Раз на день я сам нагадаю, якщо на завтра є дедлайн.`;

// ---------- routing ----------

async function handleUpdate(env, update) {
  const message = update.message;
  if (!message || !message.text) return;
  const chatId = message.chat.id;

  if (!isAllowed(env, chatId)) {
    return sendMessage(env, chatId, `Бот приватний. Ваш chat ID: <code>${chatId}</code>`);
  }

  const text = message.text.trim();

  if (text.startsWith("Назва:")) {
    return handleNewOrderMessage(env, chatId, text);
  }

  const [command, ...args] = text.split(" ");

  switch (command) {
    case "/start":
      return sendMessage(env, chatId, START_MESSAGE);
    case "/new":
      return sendMessage(env, chatId, NEW_ORDER_TEMPLATE);
    case "/today":
      return handleToday(env, chatId);
    case "/tomorrow":
      return handleTomorrow(env, chatId);
    case "/active":
      return handleActive(env, chatId);
    case "/unpaid":
      return handleUnpaid(env, chatId);
    case "/report":
      return handleReport(env, chatId, args);
    case "/status":
      return handleStatusCommand(env, chatId, args);
    default:
      return sendMessage(env, chatId, "Не знаю такої команди. Введіть / щоб побачити список.");
  }
}

async function handleReminders(env) {
  const results = await queryOrders(env, {
    and: [
      { property: "Дедлайн", date: { equals: todayISO(1) } },
      { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
    ],
  });
  if (!results.length) return;
  const text = "⏰ <b>Нагадування — дедлайн завтра:</b>\n\n" + results.map(fmtOrder).join("\n\n");
  for (const chatId of allowedChatIds(env)) {
    await sendMessage(env, chatId, text);
  }
}

// ---------- Worker entry points ----------

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("LayerLedger bot is successfully running.", { status: 200 });
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

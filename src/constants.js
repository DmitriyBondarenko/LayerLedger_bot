export const NOTION_VERSION = "2022-06-28";

export const STATUSES = ["В черзі", "В роботі", "На правках", "Здано", "Архів"];
export const ACTIVE_STATUSES = ["В черзі", "В роботі", "На правках"];
// Display-only, button-label equivalent of STATUSES (same order/index) — never written to Notion.
export const STATUS_LABELS = ["⏳ В черзі", "🔧 В роботі", "✏️ На правках", "✅ Здано", "🗄 Архів"];

// Select-field option lists, kept in sync with the Notion "Orders" data source schema.
// Each *_LABELS array is the button-text equivalent (same order/index) — display only,
// never written to Notion; the plain arrays remain the actual Notion select values.
export const WORK_TYPES = ["Рілс", "Креатив", "Моушн", "Карусель", "Презентація", "Інше"];
export const WORK_TYPE_LABELS = ["🎬 Рілс", "🎨 Креатив", "✨ Моушн", "🎠 Карусель", "📊 Презентація", "🔹 Інше"];

export const ORDER_SOURCES = ["Біржа", "Соцмережі", "Реферал", "Постійний клієнт", "Пряме звернення"];
export const ORDER_SOURCE_LABELS = ["💼 Біржа", "📱 Соцмережі", "🤝 Реферал", "⭐ Постійний клієнт", "✉️ Пряме звернення"];

export const PRIORITIES = ["Високий", "Середній", "Низький"];
export const PRIORITY_LABELS = ["🔴 Високий", "🟡 Середній", "🟢 Низький"];

export const CURRENCIES = ["UAH", "USD"];
export const CURRENCY_LABELS = ["🇺🇦 UAH", "🇺🇸 USD"];

export const PAYMENT_STATUSES = ["Не оплачено", "Частково", "Оплачено повністю"];
export const PAYMENT_STATUS_LABELS = ["🔴 Не оплачено", "🟡 Частково", "🟢 Оплачено повністю"];

export const START_MESSAGE = `Привіт! Я LayerLedger 👋
Веду облік замовлень та доходу, все зберігаю в Notion.

<b>Що я вмію:</b>

<b>/new</b> — додати нове замовлення (проведу по кроках з кнопками)
<b>/today</b> — замовлення з дедлайном сьогодні
<b>/tomorrow</b> — замовлення з дедлайном завтра
<b>/active</b> — всі активні замовлення (в черзі, в роботі, на правках)
<b>/unpaid</b> — замовлення, які ще не оплачені повністю
<b>/report</b> — дохід за період, окремо по валютах (оберіть період кнопкою)
<b>/status</b> — змінити статус замовлення (виберіть зі списку кнопкою)
<b>/cancel</b> — скасувати поточний крок /new, /status або /report

🔔 Раз на день я сам нагадаю, якщо на завтра є дедлайн.`;

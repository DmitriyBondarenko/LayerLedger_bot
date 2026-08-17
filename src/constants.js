export const NOTION_VERSION = "2022-06-28";

export const STATUSES = ["В черзі", "В роботі", "На правках", "Здано", "Архів"];
export const ACTIVE_STATUSES = ["В черзі", "В роботі", "На правках"];

// Select-field option lists, kept in sync with the Notion "Orders" data source schema.
export const WORK_TYPES = ["Рілс", "Креатив", "Моушн", "Карусель", "Презентація", "Інше"];
export const ORDER_SOURCES = ["Біржа", "Соцмережі", "Реферал", "Постійний клієнт", "Пряме звернення"];
export const PRIORITIES = ["Високий", "Середній", "Низький"];
export const CURRENCIES = ["UAH", "USD"];

export const START_MESSAGE = `Привіт! Я LayerLedger 👋
Веду облік замовлень та доходу, все зберігаю в Notion.

<b>Що я вмію:</b>

<b>/new</b> — додати нове замовлення (проведу по кроках з кнопками)
<b>/today</b> — замовлення з дедлайном сьогодні
<b>/tomorrow</b> — замовлення з дедлайном завтра
<b>/active</b> — всі активні замовлення (в черзі, в роботі, на правках)
<b>/unpaid</b> — замовлення, які ще не оплачені повністю
<b>/report</b> — дохід за період: /report week, /report month або /report РРРР-ММ-ДД РРРР-ММ-ДД
<b>/status</b> — змінити статус замовлення (виберіть зі списку кнопкою)
<b>/cancel</b> — скасувати поточний крок /new або /status

🔔 Раз на день я сам нагадаю, якщо на завтра є дедлайн.`;

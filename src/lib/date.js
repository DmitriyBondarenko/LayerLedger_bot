export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const UA_MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "серп", "вер", "жов", "лис", "груд"];
const UA_WEEKDAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Compact weekday + day.month for date-picker buttons, e.g. "Пт 22.08".
export function formatShortDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = UA_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
}

// Formats a Notion-style "YYYY-MM-DD" string for display, e.g. "17 серп 2026".
// Parses the components directly (not `new Date(iso)`) to avoid timezone-shifted days.
export function formatDisplayDate(isoDate) {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${UA_MONTHS[month - 1]} ${year}`;
}

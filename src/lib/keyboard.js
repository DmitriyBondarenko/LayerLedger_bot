// Builds an inline keyboard where each button's callback_data is `prefix:<index>`,
// indexing back into the caller's own options array — keeps callback_data short
// and avoids ever putting free text (over Telegram's 64-byte limit) on the wire.
// `labels`, if given, supplies the button text shown to the user (e.g. with emoji)
// while `options` stays the plain values the index refers back to.
export function optionsKeyboard(options, prefix, columns = 2, labels = options) {
  const buttons = options.map((_, index) => ({
    text: labels[index],
    callback_data: `${prefix}:${index}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += columns) {
    rows.push(buttons.slice(i, i + columns));
  }
  return { inline_keyboard: rows };
}

export function actionsKeyboard(actions) {
  return { inline_keyboard: [actions.map(({ label, data }) => ({ text: label, callback_data: data }))] };
}

// Like actionsKeyboard, but wraps into rows of `columns` instead of a single row.
export function menuKeyboard(actions, columns = 2) {
  const buttons = actions.map(({ label, data }) => ({ text: label, callback_data: data }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += columns) {
    rows.push(buttons.slice(i, i + columns));
  }
  return { inline_keyboard: rows };
}

export function mergeKeyboards(...keyboards) {
  return { inline_keyboard: keyboards.flatMap((k) => k.inline_keyboard) };
}

// One button per order, callback_data carries the Notion page id directly
// ("ord:<pageId>") — a page id is short and fixed-format, so unlike the
// wizards' option/order pickers this needs no index lookup into stored state.
export function orderListKeyboard(orders) {
  return { inline_keyboard: orders.map(({ id, label }) => [{ text: label, callback_data: `ord:${id}` }]) };
}

// Builds an inline keyboard where each button's callback_data is `prefix:<index>`,
// indexing back into the caller's own options array — keeps callback_data short
// and avoids ever putting free text (over Telegram's 64-byte limit) on the wire.
export function optionsKeyboard(options, prefix, columns = 2) {
  const buttons = options.map((label, index) => ({
    text: label,
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

export function mergeKeyboards(...keyboards) {
  return { inline_keyboard: keyboards.flatMap((k) => k.inline_keyboard) };
}

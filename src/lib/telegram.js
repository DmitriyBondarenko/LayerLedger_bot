export async function telegramApi(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`Telegram API error (${method}): ${res.status}`, await res.text());
  }
  return res;
}

export function sendMessage(env, chatId, text, replyMarkup) {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function editMessageText(env, chatId, messageId, text, replyMarkup) {
  return telegramApi(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function editMessageReplyMarkup(env, chatId, messageId, replyMarkup) {
  return telegramApi(env, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export function answerCallbackQuery(env, callbackQueryId, text, showAlert = false) {
  return telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

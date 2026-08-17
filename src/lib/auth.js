export function allowedChatIds(env) {
  return String(env.ALLOWED_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowed(env, chatId) {
  return allowedChatIds(env).includes(String(chatId));
}

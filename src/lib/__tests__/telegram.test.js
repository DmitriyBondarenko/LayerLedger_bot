import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { telegramApi, sendMessage, editMessageText, editMessageReplyMarkup, answerCallbackQuery } from "../telegram.js";

const env = { TELEGRAM_BOT_TOKEN: "test-token" };

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(new Response("{}"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("telegramApi", () => {
  it("POSTs to the Telegram Bot API with the token and method in the URL", async () => {
    await telegramApi(env, "sendMessage", { chat_id: 1, text: "hi" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: 1, text: "hi" }),
      }),
    );
  });
});

describe("sendMessage", () => {
  it("sends HTML-parsed text with an optional reply markup", async () => {
    const markup = { inline_keyboard: [] };
    await sendMessage(env, 42, "Привіт", markup);
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      chat_id: 42,
      text: "Привіт",
      parse_mode: "HTML",
      reply_markup: markup,
    });
  });
});

describe("editMessageText", () => {
  it("targets a specific chat and message id", async () => {
    await editMessageText(env, 42, 99, "Оновлено", undefined);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("/editMessageText");
    expect(JSON.parse(options.body)).toMatchObject({ chat_id: 42, message_id: 99, text: "Оновлено" });
  });
});

describe("editMessageReplyMarkup", () => {
  it("sends only the reply markup", async () => {
    const markup = { inline_keyboard: [[{ text: "x", callback_data: "x" }]] };
    await editMessageReplyMarkup(env, 42, 99, markup);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("/editMessageReplyMarkup");
    expect(JSON.parse(options.body)).toEqual({ chat_id: 42, message_id: 99, reply_markup: markup });
  });
});

describe("answerCallbackQuery", () => {
  it("defaults show_alert to false", async () => {
    await answerCallbackQuery(env, "cbq1", "Готово");
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      callback_query_id: "cbq1",
      text: "Готово",
      show_alert: false,
    });
  });

  it("passes through show_alert when set", async () => {
    await answerCallbackQuery(env, "cbq1", "Помилка", true);
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({ show_alert: true });
  });
});

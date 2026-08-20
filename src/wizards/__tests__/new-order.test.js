import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/telegram.js", () => ({
  sendMessage: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(undefined),
  editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/kv.js", () => ({
  setDraft: vi.fn().mockResolvedValue(undefined),
  clearDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../commands/new-order.js", () => ({ createOrder: vi.fn() }));

import { sendMessage, editMessageText, editMessageReplyMarkup } from "../../lib/telegram.js";
import { setDraft, clearDraft } from "../../lib/kv.js";
import { createOrder } from "../../commands/new-order.js";
import { start, handleText, handleCallback } from "../new-order.js";

const env = {};
const chatId = 42;

function jsonResponse(messageId) {
  return { json: async () => ({ result: { message_id: messageId } }) };
}

beforeEach(() => {
  sendMessage.mockReset().mockResolvedValue(jsonResponse(100));
  editMessageText.mockClear();
  editMessageReplyMarkup.mockClear();
  setDraft.mockClear();
  clearDraft.mockClear();
  createOrder.mockReset();
});

describe("start", () => {
  it("clears any prior draft and sends the first step (Назва, a required text field)", async () => {
    await start(env, chatId);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    const [, , text] = sendMessage.mock.calls[0];
    expect(text).toContain("крок 1/10");
    expect(text).toContain("Назва замовлення");
    const savedDraft = setDraft.mock.calls[0][2];
    expect(savedDraft).toMatchObject({ type: "new", step: 0, data: {}, messageId: 100 });
  });
});

describe("handleText", () => {
  it("rejects empty input for a required text field and re-prompts without advancing", async () => {
    const draft = { type: "new", step: 0, data: {} };
    await handleText(env, chatId, draft, "   ");
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("обов'язкове"), expect.anything());
    expect(setDraft).not.toHaveBeenCalled();
  });

  it("accepts required text, stores it, and advances to the next step", async () => {
    const draft = { type: "new", step: 0, data: {}, messageId: 100 };
    await handleText(env, chatId, draft, "Рілс для клієнта");
    expect(draft.data["Назва"]).toBe("Рілс для клієнта");
    expect(draft.step).toBe(1);
    expect(editMessageReplyMarkup).toHaveBeenCalledWith(env, chatId, 100, { inline_keyboard: [] });
  });

  it("allows skipping an optional text field by sending nothing", async () => {
    const draft = { type: "new", step: 1, data: { "Назва": "X" } }; // step 1 = Клієнт, optional
    await handleText(env, chatId, draft, "");
    expect(draft.data["Клієнт"]).toBeUndefined();
    expect(draft.step).toBe(2);
  });

  it("rejects non-numeric input for a number field", async () => {
    const draft = { type: "new", step: 6, data: {} }; // step 6 = Вартість замовлення
    await handleText(env, chatId, draft, "not a number");
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Введіть число"), expect.anything());
    expect(draft.step).toBe(6);
  });

  it("normalizes a comma decimal separator for number fields", async () => {
    const draft = { type: "new", step: 6, data: {} };
    await handleText(env, chatId, draft, "1500,50");
    expect(draft.data["Вартість замовлення"]).toBe("1500.5");
  });

  it("rejects a malformed date and prompts the expected format", async () => {
    const draft = { type: "new", step: 4, data: {} }; // step 4 = Дедлайн
    await handleText(env, chatId, draft, "20/08/2026");
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("YYYY-MM-DD"), expect.anything());
    expect(draft.step).toBe(4);
  });

  it("accepts a well-formed date", async () => {
    const draft = { type: "new", step: 4, data: {} };
    await handleText(env, chatId, draft, "2026-09-01");
    expect(draft.data["Дедлайн"]).toBe("2026-09-01");
    expect(draft.step).toBe(5);
  });

  it("prompts to use the keyboard instead when text is sent on a select step", async () => {
    const draft = { type: "new", step: 2, data: {} }; // step 2 = Тип роботи (select)
    await handleText(env, chatId, draft, "Рілс");
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("кнопкою"), expect.anything());
    expect(draft.step).toBe(2);
    expect(draft.data["Тип роботи"]).toBeUndefined();
  });

  it("does nothing once the wizard has reached the confirm step", async () => {
    const draft = { type: "new", step: 10, data: {} };
    await handleText(env, chatId, draft, "anything");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("handleCallback", () => {
  it("cancels and clears the draft regardless of step", async () => {
    const draft = { type: "new", step: 3, data: {} };
    await handleCallback(env, chatId, 100, "w:cancel", draft);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, expect.stringContaining("скасовано"), { inline_keyboard: [] });
  });

  it("selects an option and advances the step", async () => {
    const draft = { type: "new", step: 2, data: {} }; // Тип роботи
    await handleCallback(env, chatId, 100, "w:opt:0", draft);
    expect(draft.data["Тип роботи"]).toBe("Рілс");
    expect(draft.step).toBe(3);
    expect(setDraft).toHaveBeenCalled();
  });

  it("skips an optional step via the skip action", async () => {
    const draft = { type: "new", step: 1, data: { "Назва": "X" } }; // Клієнт, optional
    await handleCallback(env, chatId, 100, "w:skip", draft);
    expect(draft.step).toBe(2);
  });

  it("ignores skip on a required step", async () => {
    const draft = { type: "new", step: 0, data: {} };
    await handleCallback(env, chatId, 100, "w:skip", draft);
    expect(draft.step).toBe(0);
    expect(setDraft).not.toHaveBeenCalled();
  });

  it("resolves a date quick-pick offset relative to today", async () => {
    const draft = { type: "new", step: 4, data: {} };
    await handleCallback(env, chatId, 100, "w:date:1", draft);
    expect(draft.data["Дедлайн"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.step).toBe(5);
  });

  it("creates the order on confirm and reports success", async () => {
    createOrder.mockResolvedValue({ object: "page", id: "p1" });
    const draft = { type: "new", step: 10, data: { "Назва": "Рілс" } };
    await handleCallback(env, chatId, 100, "w:confirm", draft);
    expect(createOrder).toHaveBeenCalledWith(env, draft.data);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, expect.stringContaining("додано"), { inline_keyboard: [] });
  });

  it("reports a Notion error on confirm without clearing silently succeeding", async () => {
    createOrder.mockResolvedValue({ object: "error", message: "boom" });
    const draft = { type: "new", step: 10, data: { "Назва": "Рілс" } };
    await handleCallback(env, chatId, 100, "w:confirm", draft);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, expect.stringContaining("Помилка"), { inline_keyboard: [] });
  });

  it("ignores any action other than confirm while on the confirm step", async () => {
    const draft = { type: "new", step: 10, data: { "Назва": "Рілс" } };
    await handleCallback(env, chatId, 100, "w:opt:0", draft);
    expect(createOrder).not.toHaveBeenCalled();
    expect(editMessageText).not.toHaveBeenCalled();
  });
});

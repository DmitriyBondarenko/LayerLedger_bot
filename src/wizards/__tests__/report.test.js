import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/telegram.js", () => ({
  sendMessage: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/kv.js", () => ({
  setDraft: vi.fn().mockResolvedValue(undefined),
  clearDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../commands/report.js", () => ({
  weekRange: vi.fn(() => ({ start: "2026-08-17", end: "2026-08-20" })),
  monthRange: vi.fn(() => ({ start: "2026-08-01", end: "2026-08-20" })),
  computeReport: vi.fn().mockResolvedValue({ start: "x", end: "y", orderCount: 0, byCurrency: {} }),
  formatReport: vi.fn(() => "FORMATTED_REPORT"),
}));

import { sendMessage, editMessageText } from "../../lib/telegram.js";
import { setDraft, clearDraft } from "../../lib/kv.js";
import { weekRange, monthRange, computeReport, formatReport } from "../../commands/report.js";
import { start, handleCallback, handleText } from "../report.js";

const env = {};
const chatId = 42;

function jsonResponse(messageId) {
  return { json: async () => ({ result: { message_id: messageId } }) };
}

beforeEach(() => {
  sendMessage.mockReset().mockResolvedValue(jsonResponse(100));
  editMessageText.mockClear();
  setDraft.mockClear();
  clearDraft.mockClear();
  computeReport.mockClear();
  formatReport.mockClear();
});

describe("start", () => {
  it("sends the period picker and saves a step-0 draft", async () => {
    await start(env, chatId);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("період"), expect.anything());
    expect(setDraft).toHaveBeenCalledWith(env, chatId, { type: "report", step: 0, messageId: 100 });
  });
});

describe("handleCallback", () => {
  it("cancels and clears the draft", async () => {
    await handleCallback(env, chatId, 100, "rp:cancel", { step: 0 });
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, "❌ Скасовано.", { inline_keyboard: [] });
  });

  it("computes and shows the week report immediately", async () => {
    await handleCallback(env, chatId, 100, "rp:week", { step: 0 });
    expect(weekRange).toHaveBeenCalled();
    expect(computeReport).toHaveBeenCalledWith(env, "2026-08-17", "2026-08-20");
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, "FORMATTED_REPORT", { inline_keyboard: [] });
  });

  it("computes and shows the month report immediately", async () => {
    await handleCallback(env, chatId, 100, "rp:month", { step: 0 });
    expect(monthRange).toHaveBeenCalled();
    expect(computeReport).toHaveBeenCalledWith(env, "2026-08-01", "2026-08-20");
  });

  it("prompts for a custom range and advances to step 1 without clearing the draft", async () => {
    const draft = { step: 0 };
    await handleCallback(env, chatId, 100, "rp:custom", draft);
    expect(draft.step).toBe(1);
    expect(clearDraft).not.toHaveBeenCalled();
    expect(setDraft).toHaveBeenCalledWith(env, chatId, draft);
    expect(editMessageText.mock.calls[0][3]).toContain("YYYY-MM-DD YYYY-MM-DD");
  });
});

describe("handleText", () => {
  it("ignores text when not on the custom-range step", async () => {
    await handleText(env, chatId, { step: 0 }, "2026-08-01 2026-08-17");
    expect(computeReport).not.toHaveBeenCalled();
  });

  it("rejects a malformed range and re-prompts", async () => {
    await handleText(env, chatId, { step: 1 }, "not a range");
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Формат"), expect.anything());
    expect(computeReport).not.toHaveBeenCalled();
  });

  it("computes and sends the report for a valid custom range", async () => {
    await handleText(env, chatId, { step: 1 }, "2026-08-01 2026-08-17");
    expect(computeReport).toHaveBeenCalledWith(env, "2026-08-01", "2026-08-17");
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, "FORMATTED_REPORT");
  });
});

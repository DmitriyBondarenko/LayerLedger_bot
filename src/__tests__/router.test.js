import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/telegram.js", () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/auth.js", () => ({ isAllowed: vi.fn() }));
vi.mock("../lib/kv.js", () => ({
  getDraft: vi.fn(),
  clearDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/orders.js", () => ({
  handleToday: vi.fn().mockResolvedValue(undefined),
  handleTomorrow: vi.fn().mockResolvedValue(undefined),
  handleActive: vi.fn().mockResolvedValue(undefined),
  handleUnpaid: vi.fn().mockResolvedValue(undefined),
  handleOrderDetail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../wizards/new-order.js", () => ({
  start: vi.fn().mockResolvedValue(undefined),
  handleText: vi.fn().mockResolvedValue(undefined),
  handleCallback: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../wizards/status.js", () => ({
  start: vi.fn().mockResolvedValue(undefined),
  handleCallback: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../wizards/report.js", () => ({
  start: vi.fn().mockResolvedValue(undefined),
  handleText: vi.fn().mockResolvedValue(undefined),
  handleCallback: vi.fn().mockResolvedValue(undefined),
}));

import { sendMessage, answerCallbackQuery } from "../lib/telegram.js";
import { isAllowed } from "../lib/auth.js";
import { getDraft, clearDraft } from "../lib/kv.js";
import { handleToday, handleOrderDetail } from "../commands/orders.js";
import * as newOrderWizard from "../wizards/new-order.js";
import * as statusWizard from "../wizards/status.js";
import * as reportWizard from "../wizards/report.js";
import { handleUpdate } from "../router.js";

const env = {};
const chatId = 42;

function textUpdate(text) {
  return { message: { chat: { id: chatId }, text } };
}

function callbackUpdate(data, extra = {}) {
  return { callback_query: { id: "cbq1", data, message: { chat: { id: chatId }, message_id: 100 }, ...extra } };
}

beforeEach(() => {
  vi.clearAllMocks();
  isAllowed.mockReturnValue(true);
});

describe("handleUpdate: message routing", () => {
  it("tells a disallowed chat its id instead of running anything", async () => {
    isAllowed.mockReturnValue(false);
    await handleUpdate(env, textUpdate("/today"));
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining(String(chatId)));
    expect(handleToday).not.toHaveBeenCalled();
  });

  it("ignores updates without message text", async () => {
    await handleUpdate(env, { message: { chat: { id: chatId } } });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("/cancel clears the draft and confirms", async () => {
    await handleUpdate(env, textUpdate("/cancel"));
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Скасовано"));
  });

  it("dispatches a known slash command", async () => {
    await handleUpdate(env, textUpdate("/today"));
    expect(handleToday).toHaveBeenCalledWith(env, chatId, []);
  });

  it("passes extra words as args to the handler", async () => {
    // /report isn't in COMMANDS' arg-taking set directly, but the dispatch always passes args.
    await handleUpdate(env, textUpdate("/today extra args"));
    expect(handleToday).toHaveBeenCalledWith(env, chatId, ["extra", "args"]);
  });

  it("replies with an unknown-command message for an unrecognized slash command", async () => {
    await handleUpdate(env, textUpdate("/bogus"));
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Не знаю"));
  });

  it("a menu-bar tap clears any in-progress wizard and runs the mapped command instead", async () => {
    await handleUpdate(env, textUpdate("📅 Сьогодні"));
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(handleToday).toHaveBeenCalledWith(env, chatId);
  });

  it("routes free text to the active /new wizard", async () => {
    getDraft.mockResolvedValue({ type: "new", step: 0, data: {} });
    await handleUpdate(env, textUpdate("Рілс для клієнта"));
    expect(newOrderWizard.handleText).toHaveBeenCalledWith(env, chatId, { type: "new", step: 0, data: {} }, "Рілс для клієнта");
  });

  it("routes free text to the active /report custom-range wizard", async () => {
    getDraft.mockResolvedValue({ type: "report", step: 1 });
    await handleUpdate(env, textUpdate("2026-08-01 2026-08-17"));
    expect(reportWizard.handleText).toHaveBeenCalledWith(env, chatId, { type: "report", step: 1 }, "2026-08-01 2026-08-17");
  });

  it("does not route free text anywhere when there's no active draft", async () => {
    getDraft.mockResolvedValue(null);
    await handleUpdate(env, textUpdate("random text"));
    expect(newOrderWizard.handleText).not.toHaveBeenCalled();
    expect(reportWizard.handleText).not.toHaveBeenCalled();
    // Falls through to command dispatch, which won't match plain text either.
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Не знаю"));
  });
});

describe("handleUpdate: callback query routing", () => {
  it("denies a disallowed chat with an alert", async () => {
    isAllowed.mockReturnValue(false);
    await handleUpdate(env, callbackUpdate("ord:page1"));
    expect(answerCallbackQuery).toHaveBeenCalledWith(env, "cbq1", "Немає доступу", true);
    expect(handleOrderDetail).not.toHaveBeenCalled();
  });

  it("routes ord: callbacks straight to order detail without needing a draft", async () => {
    await handleUpdate(env, callbackUpdate("ord:page1"));
    expect(answerCallbackQuery).toHaveBeenCalledWith(env, "cbq1");
    expect(handleOrderDetail).toHaveBeenCalledWith(env, chatId, "page1");
  });

  it("alerts when there's no draft to resume for a non-ord callback", async () => {
    getDraft.mockResolvedValue(null);
    await handleUpdate(env, callbackUpdate("w:opt:0"));
    expect(answerCallbackQuery).toHaveBeenCalledWith(env, "cbq1", expect.stringContaining("закінчилась"), true);
    expect(newOrderWizard.handleCallback).not.toHaveBeenCalled();
  });

  it("routes w: callbacks to the /new wizard when the draft matches", async () => {
    const draft = { type: "new", step: 2, data: {} };
    getDraft.mockResolvedValue(draft);
    await handleUpdate(env, callbackUpdate("w:opt:0"));
    expect(newOrderWizard.handleCallback).toHaveBeenCalledWith(env, chatId, 100, "w:opt:0", draft);
  });

  it("routes st: callbacks to the /status wizard when the draft matches", async () => {
    const draft = { type: "status", step: 0, orders: [] };
    getDraft.mockResolvedValue(draft);
    await handleUpdate(env, callbackUpdate("st:o:0"));
    expect(statusWizard.handleCallback).toHaveBeenCalledWith(env, chatId, 100, "st:o:0", draft);
  });

  it("routes rp: callbacks to the /report wizard when the draft matches", async () => {
    const draft = { type: "report", step: 0 };
    getDraft.mockResolvedValue(draft);
    await handleUpdate(env, callbackUpdate("rp:week"));
    expect(reportWizard.handleCallback).toHaveBeenCalledWith(env, chatId, 100, "rp:week", draft);
  });

  it("does not cross-route a callback prefix that doesn't match the draft's type", async () => {
    const draft = { type: "status", step: 0, orders: [] };
    getDraft.mockResolvedValue(draft);
    await handleUpdate(env, callbackUpdate("w:opt:0"));
    expect(newOrderWizard.handleCallback).not.toHaveBeenCalled();
  });
});

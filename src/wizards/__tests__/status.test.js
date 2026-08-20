import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/telegram.js", () => ({
  sendMessage: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/kv.js", () => ({
  setDraft: vi.fn().mockResolvedValue(undefined),
  clearDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../commands/orders.js", () => ({ queryStatusChangeableOrders: vi.fn() }));
vi.mock("../../commands/status.js", () => ({
  applyStatusUpdate: vi.fn().mockResolvedValue(undefined),
  applyPaymentUpdate: vi.fn().mockResolvedValue(undefined),
}));

import { sendMessage, editMessageText } from "../../lib/telegram.js";
import { setDraft, clearDraft } from "../../lib/kv.js";
import { queryStatusChangeableOrders } from "../../commands/orders.js";
import { applyStatusUpdate, applyPaymentUpdate } from "../../commands/status.js";
import { start, handleCallback } from "../status.js";

const env = {};
const chatId = 42;

function notionPage(id, name, status, deadline) {
  return {
    id,
    properties: {
      "Назва": { title: [{ plain_text: name }] },
      "Статус": { select: { name: status } },
      "Дедлайн": deadline ? { date: { start: deadline } } : {},
    },
  };
}

function jsonResponse(messageId) {
  return { json: async () => ({ result: { message_id: messageId } }) };
}

beforeEach(() => {
  sendMessage.mockReset().mockResolvedValue(jsonResponse(100));
  editMessageText.mockClear();
  setDraft.mockClear();
  clearDraft.mockClear();
  queryStatusChangeableOrders.mockReset();
  applyStatusUpdate.mockClear();
  applyPaymentUpdate.mockClear();
});

describe("start", () => {
  it("shows an empty state when there's nothing to change", async () => {
    queryStatusChangeableOrders.mockResolvedValue([]);
    await start(env, chatId);
    expect(sendMessage).toHaveBeenCalledWith(env, chatId, expect.stringContaining("Немає замовлень"));
    expect(setDraft).not.toHaveBeenCalled();
  });

  it("lists eligible orders and saves a step-0 draft", async () => {
    queryStatusChangeableOrders.mockResolvedValue([notionPage("1", "Order A", "В роботі", "2026-08-25")]);
    await start(env, chatId);
    const draft = setDraft.mock.calls[0][2];
    expect(draft).toMatchObject({ type: "status", step: 0, messageId: 100 });
    expect(draft.orders[0]).toMatchObject({ id: "1", name: "Order A", status: "В роботі", deadline: "2026-08-25" });
  });
});

describe("handleCallback: cancel", () => {
  it("shows a generic cancel message before step 2", async () => {
    const draft = { step: 0, orders: [] };
    await handleCallback(env, chatId, 100, "st:cancel", draft);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText).toHaveBeenCalledWith(env, chatId, 100, "❌ Скасовано.", { inline_keyboard: [] });
  });

  it("clarifies that status was already changed when cancelling at the payment step", async () => {
    const draft = { step: 2, statusJustChanged: true, selectedOrderName: "Order A" };
    await handleCallback(env, chatId, 100, "st:cancel", draft);
    expect(editMessageText.mock.calls[0][3]).toContain("вже змінено на Здано");
  });

  it("says payment wasn't updated when cancelling on an already-Здано order", async () => {
    const draft = { step: 2, statusJustChanged: false, selectedOrderName: "Order A" };
    await handleCallback(env, chatId, 100, "st:cancel", draft);
    expect(editMessageText.mock.calls[0][3]).toContain("не оновлено");
  });
});

describe("handleCallback: step 0 (order selection)", () => {
  it("jumps straight to the payment step for an order that's already Здано", async () => {
    const draft = { step: 0, orders: [{ id: "1", name: "Order A", status: "Здано" }] };
    await handleCallback(env, chatId, 100, "st:o:0", draft);
    expect(draft.step).toBe(2);
    expect(draft.statusJustChanged).toBe(false);
    expect(setDraft).toHaveBeenCalled();
    expect(editMessageText.mock.calls[0][3]).toContain("вже");
  });

  it("goes to the status step for a non-Здано order", async () => {
    const draft = { step: 0, orders: [{ id: "1", name: "Order A", status: "В роботі" }] };
    await handleCallback(env, chatId, 100, "st:o:0", draft);
    expect(draft.step).toBe(1);
    expect(editMessageText.mock.calls[0][3]).toContain("Оберіть новий статус");
  });

  it("ignores an out-of-range order index", async () => {
    const draft = { step: 0, orders: [] };
    await handleCallback(env, chatId, 100, "st:o:5", draft);
    expect(setDraft).not.toHaveBeenCalled();
    expect(editMessageText).not.toHaveBeenCalled();
  });
});

describe("handleCallback: step 1 (status selection)", () => {
  it("applies the new status and, for a non-Здано status, finishes the wizard", async () => {
    const draft = { step: 1, selectedOrderId: "1", selectedOrderName: "Order A" };
    await handleCallback(env, chatId, 100, "st:s:1", draft); // STATUSES[1] = "В роботі"
    expect(applyStatusUpdate).toHaveBeenCalledWith(env, "1", "В роботі");
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(editMessageText.mock.calls[0][3]).toContain("змінено на В роботі");
  });

  it("routes to the payment step instead of finishing when the new status is Здано", async () => {
    const draft = { step: 1, selectedOrderId: "1", selectedOrderName: "Order A" };
    await handleCallback(env, chatId, 100, "st:s:3", draft); // STATUSES[3] = "Здано"
    expect(applyStatusUpdate).toHaveBeenCalledWith(env, "1", "Здано");
    expect(clearDraft).not.toHaveBeenCalled();
    expect(draft.step).toBe(2);
    expect(draft.statusJustChanged).toBe(true);
    expect(editMessageText.mock.calls[0][3]).toContain("Оплату отримано повністю?");
  });
});

describe("handleCallback: step 2 (payment)", () => {
  it("skipping payment finishes the wizard without an archive note", async () => {
    const draft = { step: 2, selectedOrderId: "1", selectedOrderName: "Order A", statusJustChanged: true };
    await handleCallback(env, chatId, 100, "st:pskip", draft);
    expect(clearDraft).toHaveBeenCalledWith(env, chatId);
    expect(applyPaymentUpdate).not.toHaveBeenCalled();
    expect(editMessageText.mock.calls[0][3]).toContain("Оплату не оновлено");
  });

  it("applies a partial payment without archiving", async () => {
    const draft = { step: 2, selectedOrderId: "1", selectedOrderName: "Order A", statusJustChanged: false };
    await handleCallback(env, chatId, 100, "st:p:1", draft); // PAYMENT_STATUSES[1] = "Частково"
    expect(applyPaymentUpdate).toHaveBeenCalledWith(env, "1", "Частково");
    expect(applyStatusUpdate).not.toHaveBeenCalled();
    expect(editMessageText.mock.calls[0][3]).not.toContain("заархівовано");
  });

  it("marking fully paid also archives the order", async () => {
    const draft = { step: 2, selectedOrderId: "1", selectedOrderName: "Order A", statusJustChanged: true };
    await handleCallback(env, chatId, 100, "st:p:2", draft); // PAYMENT_STATUSES[2] = "Оплачено повністю"
    expect(applyPaymentUpdate).toHaveBeenCalledWith(env, "1", "Оплачено повністю");
    expect(applyStatusUpdate).toHaveBeenCalledWith(env, "1", "Архів");
    expect(editMessageText.mock.calls[0][3]).toContain("заархівовано");
  });

  it("ignores an out-of-range payment index", async () => {
    const draft = { step: 2, selectedOrderId: "1", selectedOrderName: "Order A" };
    await handleCallback(env, chatId, 100, "st:p:9", draft);
    expect(applyPaymentUpdate).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
  });
});

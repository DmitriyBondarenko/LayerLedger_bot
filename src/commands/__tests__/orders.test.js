import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/notion.js", () => ({ queryOrders: vi.fn(), getPage: vi.fn() }));
vi.mock("../../lib/telegram.js", () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }));

import { queryOrders, getPage } from "../../lib/notion.js";
import { sendMessage } from "../../lib/telegram.js";
import {
  toOrderButtons,
  queryActiveOrders,
  queryStatusChangeableOrders,
  handleToday,
  handleTomorrow,
  handleActive,
  handleUnpaid,
  handleOrderDetail,
} from "../orders.js";
import { ACTIVE_STATUSES } from "../../constants.js";

const env = {};

function page(id, name, extra = {}) {
  return {
    id,
    properties: {
      "Назва": { title: [{ plain_text: name }] },
      ...extra,
    },
  };
}

beforeEach(() => {
  queryOrders.mockReset();
  getPage.mockReset();
  sendMessage.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toOrderButtons", () => {
  it("labels each order with just its name when no hint is given", () => {
    expect(toOrderButtons([page("1", "Order A")])).toEqual([{ id: "1", label: "Order A" }]);
  });

  it("appends the hint's return value when given", () => {
    const buttons = toOrderButtons([page("1", "Order A")], () => "extra");
    expect(buttons).toEqual([{ id: "1", label: "Order A — extra" }]);
  });
});

describe("queryActiveOrders", () => {
  it("filters on the active statuses, sorted by deadline ascending", async () => {
    queryOrders.mockResolvedValue([]);
    await queryActiveOrders(env);
    expect(queryOrders).toHaveBeenCalledWith(
      env,
      { or: ACTIVE_STATUSES.map((s) => ({ property: "Статус", select: { equals: s } })) },
      [{ property: "Дедлайн", direction: "ascending" }],
    );
  });
});

describe("queryStatusChangeableOrders", () => {
  it("includes active statuses plus Здано orders that aren't fully paid", async () => {
    queryOrders.mockResolvedValue([]);
    await queryStatusChangeableOrders(env);
    const [, filter] = queryOrders.mock.calls[0];
    expect(filter.or).toHaveLength(ACTIVE_STATUSES.length + 1);
    expect(filter.or.at(-1)).toEqual({
      and: [
        { property: "Статус", select: { equals: "Здано" } },
        { property: "Статус оплати", select: { does_not_equal: "Оплачено повністю" } },
      ],
    });
  });
});

describe("handleToday / handleTomorrow", () => {
  it("shows a friendly empty state when there are no deadlines today", async () => {
    queryOrders.mockResolvedValue([]);
    await handleToday(env, 42);
    expect(sendMessage).toHaveBeenCalledWith(env, 42, expect.stringContaining("немає"));
  });

  it("lists orders with a deadline today as buttons", async () => {
    queryOrders.mockResolvedValue([page("1", "Order A", { "Статус": { select: { name: "В роботі" } } })]);
    await handleToday(env, 42);
    const [, , , keyboard] = sendMessage.mock.calls[0];
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe("ord:1");
    expect(keyboard.inline_keyboard[0][0].text).toContain("Order A");
  });

  it("queries tomorrow's date for handleTomorrow", async () => {
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
    queryOrders.mockResolvedValue([]);
    await handleTomorrow(env, 42);
    const [, filter] = queryOrders.mock.calls[0];
    expect(filter.date.equals).toBe("2026-08-21");
  });
});

describe("handleActive", () => {
  it("shows a friendly empty state", async () => {
    queryOrders.mockResolvedValue([]);
    await handleActive(env, 42);
    expect(sendMessage).toHaveBeenCalledWith(env, 42, expect.stringContaining("немає"));
  });

  it("includes deadline and status in the button label", async () => {
    queryOrders.mockResolvedValue([
      page("1", "Order A", { "Дедлайн": { date: { start: "2026-08-25" } }, "Статус": { select: { name: "В роботі" } } }),
    ]);
    await handleActive(env, 42);
    const [, , , keyboard] = sendMessage.mock.calls[0];
    expect(keyboard.inline_keyboard[0][0].text).toContain("25 серп 2026");
    expect(keyboard.inline_keyboard[0][0].text).toContain("🔧 В роботі");
  });

  it("labels a missing deadline explicitly", async () => {
    queryOrders.mockResolvedValue([page("1", "Order A", { "Статус": { select: { name: "В черзі" } } })]);
    await handleActive(env, 42);
    const [, , , keyboard] = sendMessage.mock.calls[0];
    expect(keyboard.inline_keyboard[0][0].text).toContain("без дедлайну");
  });
});

describe("handleUnpaid", () => {
  it("shows a friendly all-paid state", async () => {
    queryOrders.mockResolvedValue([]);
    await handleUnpaid(env, 42);
    expect(sendMessage).toHaveBeenCalledWith(env, 42, expect.stringContaining("оплачено"));
  });

  it("includes amount and currency in the button label", async () => {
    queryOrders.mockResolvedValue([
      page("1", "Order A", {
        "Вартість замовлення": { number: 1000 },
        "Валюта": { select: { name: "UAH" } },
        "Статус": { select: { name: "В роботі" } },
      }),
    ]);
    await handleUnpaid(env, 42);
    const [, , , keyboard] = sendMessage.mock.calls[0];
    expect(keyboard.inline_keyboard[0][0].text).toContain("1000 UAH");
  });
});

describe("handleOrderDetail", () => {
  it("sends the formatted order details when found", async () => {
    getPage.mockResolvedValue(page("1", "Order A", { "Статус": { select: { name: "В роботі" } } }));
    await handleOrderDetail(env, 42, "1");
    expect(sendMessage).toHaveBeenCalledWith(env, 42, expect.stringContaining("Order A"));
  });

  it("sends a not-found message when the page lookup errors", async () => {
    getPage.mockResolvedValue({ object: "error" });
    await handleOrderDetail(env, 42, "missing");
    expect(sendMessage).toHaveBeenCalledWith(env, 42, expect.stringContaining("Не вдалося"));
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/notion.js", () => ({ queryOrders: vi.fn() }));

import { queryOrders } from "../../lib/notion.js";
import { weekRange, monthRange, computeReport, formatReport } from "../report.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("weekRange", () => {
  it("returns Monday of the current week through today (mid-week)", () => {
    // 2026-08-20 is a Thursday.
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
    expect(weekRange()).toEqual({ start: "2026-08-17", end: "2026-08-20" });
  });

  it("returns the same day for both bounds when today is Monday", () => {
    vi.setSystemTime(new Date("2026-08-17T12:00:00Z"));
    expect(weekRange()).toEqual({ start: "2026-08-17", end: "2026-08-17" });
  });

  it("handles Sunday correctly (week starts the prior Monday)", () => {
    // 2026-08-23 is a Sunday.
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z"));
    expect(weekRange()).toEqual({ start: "2026-08-17", end: "2026-08-23" });
  });
});

describe("monthRange", () => {
  it("returns the 1st of the current month through today", () => {
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
    expect(monthRange()).toEqual({ start: "2026-08-01", end: "2026-08-20" });
  });

  it("pads single-digit months", () => {
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(monthRange()).toEqual({ start: "2026-01-01", end: "2026-01-05" });
  });
});

function page({ currency, cost, prepaid, paymentStatus }) {
  return {
    properties: {
      "Валюта": currency ? { select: { name: currency } } : {},
      "Вартість замовлення": { number: cost },
      "Сума передоплати": { number: prepaid },
      "Статус оплати": paymentStatus ? { select: { name: paymentStatus } } : {},
    },
  };
}

describe("computeReport", () => {
  beforeEach(() => {
    queryOrders.mockReset();
  });

  it("queries orders received within [start, end] inclusive", async () => {
    queryOrders.mockResolvedValue([]);
    await computeReport({}, "2026-08-01", "2026-08-17");
    expect(queryOrders).toHaveBeenCalledWith({}, {
      and: [
        { property: "Дата отримання", date: { on_or_after: "2026-08-01" } },
        { property: "Дата отримання", date: { on_or_before: "2026-08-17" } },
      ],
    });
  });

  it("groups totals by currency, using cost as paid when fully paid, prepaid otherwise", async () => {
    queryOrders.mockResolvedValue([
      page({ currency: "UAH", cost: 1000, prepaid: 300, paymentStatus: "Частково" }),
      page({ currency: "UAH", cost: 500, prepaid: 0, paymentStatus: "Оплачено повністю" }),
      page({ currency: "USD", cost: 200, prepaid: 0, paymentStatus: "Не оплачено" }),
    ]);
    const report = await computeReport({}, "2026-08-01", "2026-08-17");
    expect(report.orderCount).toBe(3);
    expect(report.byCurrency.UAH).toEqual({ count: 2, total: 1500, paid: 800 });
    expect(report.byCurrency.USD).toEqual({ count: 1, total: 200, paid: 0 });
  });

  it("falls back to '—' for missing currency and 0 for missing amounts", async () => {
    queryOrders.mockResolvedValue([page({ currency: undefined, cost: undefined, prepaid: undefined, paymentStatus: undefined })]);
    const report = await computeReport({}, "2026-08-01", "2026-08-17");
    expect(report.byCurrency["—"]).toEqual({ count: 1, total: 0, paid: 0 });
  });
});

describe("formatReport", () => {
  it("shows an empty state when there are no orders", () => {
    const text = formatReport({ start: "2026-08-01", end: "2026-08-17", orderCount: 0, byCurrency: {} });
    expect(text).toContain("Замовлень немає");
  });

  it("renders per-currency totals including the outstanding balance", () => {
    const text = formatReport({
      start: "2026-08-01",
      end: "2026-08-17",
      orderCount: 2,
      byCurrency: { UAH: { count: 2, total: 1500, paid: 800 } },
    });
    expect(text).toContain("<b>UAH</b>");
    expect(text).toContain("Замовлень: 2");
    expect(text).toContain("Загальна сума: 1500");
    expect(text).toContain("Оплачено: 800");
    expect(text).toContain("Залишилось отримати: 700");
  });
});

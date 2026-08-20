import { describe, it, expect } from "vitest";
import { todayISO, formatShortDate, formatDisplayDate } from "../date.js";

describe("todayISO", () => {
  it("returns today's date in YYYY-MM-DD format", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("applies a positive offset", () => {
    const today = new Date();
    const expected = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1))
      .toISOString()
      .slice(0, 10);
    expect(todayISO(1)).toBe(expected);
  });

  it("applies a negative offset", () => {
    const today = new Date();
    const expected = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
      .toISOString()
      .slice(0, 10);
    expect(todayISO(-1)).toBe(expected);
  });
});

describe("formatShortDate", () => {
  it("formats a known Friday", () => {
    // 2026-08-21 is a Friday.
    expect(formatShortDate("2026-08-21")).toBe("Пт 21.08");
  });

  it("formats a known Sunday", () => {
    // 2026-08-23 is a Sunday.
    expect(formatShortDate("2026-08-23")).toBe("Нд 23.08");
  });

  it("pads single-digit day and month", () => {
    expect(formatShortDate("2026-01-05")).toBe("Пн 05.01");
  });
});

describe("formatDisplayDate", () => {
  it("returns null for falsy input", () => {
    expect(formatDisplayDate(null)).toBeNull();
    expect(formatDisplayDate(undefined)).toBeNull();
    expect(formatDisplayDate("")).toBeNull();
  });

  it("formats a full ISO date with Ukrainian month name", () => {
    expect(formatDisplayDate("2026-08-17")).toBe("17 серп 2026");
  });

  it("formats January correctly", () => {
    expect(formatDisplayDate("2026-01-01")).toBe("1 січ 2026");
  });

  it("formats December correctly", () => {
    expect(formatDisplayDate("2026-12-31")).toBe("31 груд 2026");
  });

  it("does not shift the day due to timezone parsing", () => {
    // Regression guard: must parse components directly, not `new Date(iso)`.
    expect(formatDisplayDate("2026-03-01")).toBe("1 бер 2026");
  });

  it("returns the raw string when it can't be parsed", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});

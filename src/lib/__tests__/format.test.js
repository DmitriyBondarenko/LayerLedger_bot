import { describe, it, expect } from "vitest";
import { statusLabel, paymentStatusLabel, escapeHtml, orderName, fmtOrderDetail } from "../format.js";

describe("statusLabel", () => {
  it("maps a known status to its emoji label", () => {
    expect(statusLabel("В роботі")).toBe("🔧 В роботі");
  });

  it("falls back to the raw name for an unknown status", () => {
    expect(statusLabel("Щось інше")).toBe("Щось інше");
  });

  it("falls back to '-' for empty input", () => {
    expect(statusLabel("")).toBe("-");
    expect(statusLabel(undefined)).toBe("-");
  });
});

describe("paymentStatusLabel", () => {
  it("maps a known payment status to its emoji label", () => {
    expect(paymentStatusLabel("Частково")).toBe("🟡 Частково");
  });

  it("falls back to '-' for empty input", () => {
    expect(paymentStatusLabel(null)).toBe("-");
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >", () => {
    expect(escapeHtml("<b>Tom & Jerry</b>")).toBe("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;");
  });

  it("coerces non-string input", () => {
    expect(escapeHtml(42)).toBe("42");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Привіт світ")).toBe("Привіт світ");
  });
});

describe("orderName", () => {
  it("extracts the title plain_text", () => {
    const page = { properties: { "Назва": { title: [{ plain_text: "Рілс для клієнта" }] } } };
    expect(orderName(page)).toBe("Рілс для клієнта");
  });

  it("falls back when title is empty", () => {
    const page = { properties: { "Назва": { title: [] } } };
    expect(orderName(page)).toBe("(без назви)");
  });

  it("falls back when the property is missing entirely", () => {
    const page = { properties: {} };
    expect(orderName(page)).toBe("(без назви)");
  });
});

describe("fmtOrderDetail", () => {
  function buildPage(overrides = {}) {
    return {
      properties: {
        "Назва": { title: [{ plain_text: "Тестове замовлення" }] },
        "Клієнт": { rich_text: [{ plain_text: "Іван" }] },
        "Тип роботи": { select: { name: "Рілс" } },
        "Джерело замовлення": { select: { name: "Інстаграм" } },
        "Дедлайн": { date: { start: "2026-08-25" } },
        "Пріоритет": { select: { name: "Високий" } },
        "Вартість замовлення": { number: 1500 },
        "Валюта": { select: { name: "UAH" } },
        "Сума передоплати": { number: 500 },
        "Дата отримання": { date: { start: "2026-08-18" } },
        "Статус": { select: { name: "В роботі" } },
        "Статус оплати": { select: { name: "Частково" } },
        "Фактична дата здачі": { date: null },
        "Коментар": { rich_text: [{ plain_text: "Терміново" }] },
        ...overrides,
      },
    };
  }

  it("includes all populated fields with escaping and labels", () => {
    const text = fmtOrderDetail(buildPage());
    expect(text).toContain("🧾 <b>Тестове замовлення</b>");
    expect(text).toContain("👤 Клієнт: Іван");
    expect(text).toContain("🏷 Тип роботи: Рілс");
    expect(text).toContain("📅 Дедлайн: 25 серп 2026");
    expect(text).toContain("💵 Вартість: 1500 UAH");
    expect(text).toContain("💳 Передоплата: 500 UAH");
    expect(text).toContain("🔄 Статус: 🔧 В роботі");
    expect(text).toContain("💰 Оплата: 🟡 Частково");
    expect(text).toContain("💬 Коментар: Терміново");
    expect(text).not.toContain("✅ Здано:");
  });

  it("omits optional fields that are absent", () => {
    const page = buildPage({
      "Клієнт": { rich_text: [] },
      "Коментар": { rich_text: [] },
    });
    const text = fmtOrderDetail(page);
    expect(text).not.toContain("👤 Клієнт:");
    expect(text).not.toContain("💬 Коментар:");
  });

  it("escapes HTML in name, client and comment", () => {
    const page = buildPage({
      "Назва": { title: [{ plain_text: "<script>alert(1)</script>" }] },
      "Клієнт": { rich_text: [{ plain_text: "A & B" }] },
    });
    const text = fmtOrderDetail(page);
    expect(text).toContain("🧾 <b>&lt;script&gt;alert(1)&lt;/script&gt;</b>");
    expect(text).toContain("👤 Клієнт: A &amp; B");
  });
});

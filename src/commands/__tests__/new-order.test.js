import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/notion.js", () => ({ notionApi: vi.fn().mockResolvedValue({ id: "page1" }) }));

import { notionApi } from "../../lib/notion.js";
import { buildOrderProperties, createOrder } from "../new-order.js";

describe("buildOrderProperties", () => {
  it("sets the required defaults for a minimal order", () => {
    const props = buildOrderProperties({ "Назва": "Рілс" });
    expect(props["Назва"]).toEqual({ title: [{ text: { content: "Рілс" } }] });
    expect(props["Статус"]).toEqual({ select: { name: "В черзі" } });
    expect(props["Статус оплати"]).toEqual({ select: { name: "Не оплачено" } });
    expect(props["Передоплата отримана"]).toEqual({ checkbox: false });
    expect(props["Дата отримання"].date.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("omits optional fields that weren't provided", () => {
    const props = buildOrderProperties({ "Назва": "Рілс" });
    expect(props["Клієнт"]).toBeUndefined();
    expect(props["Коментар"]).toBeUndefined();
    expect(props["Дедлайн"]).toBeUndefined();
  });

  it("includes optional fields when provided", () => {
    const props = buildOrderProperties({
      "Назва": "Рілс",
      "Клієнт": "Іван",
      "Тип роботи": "Рілс",
      "Джерело замовлення": "Інстаграм",
      "Дедлайн": "2026-09-01",
      "Пріоритет": "Високий",
      "Вартість замовлення": "1000",
      "Валюта": "UAH",
      "Коментар": "Терміново",
    });
    expect(props["Клієнт"]).toEqual({ rich_text: [{ text: { content: "Іван" } }] });
    expect(props["Тип роботи"]).toEqual({ select: { name: "Рілс" } });
    expect(props["Джерело замовлення"]).toEqual({ select: { name: "Інстаграм" } });
    expect(props["Дедлайн"]).toEqual({ date: { start: "2026-09-01" } });
    expect(props["Пріоритет"]).toEqual({ select: { name: "Високий" } });
    expect(props["Вартість замовлення"]).toEqual({ number: 1000 });
    expect(props["Валюта"]).toEqual({ select: { name: "UAH" } });
    expect(props["Коментар"]).toEqual({ rich_text: [{ text: { content: "Терміново" } }] });
  });

  it("marks prepayment received and switches payment status to 'Частково' when prepaid > 0", () => {
    const props = buildOrderProperties({ "Назва": "Рілс", "Сума передоплати": "200" });
    expect(props["Сума передоплати"]).toEqual({ number: 200 });
    expect(props["Передоплата отримана"]).toEqual({ checkbox: true });
    expect(props["Статус оплати"]).toEqual({ select: { name: "Частково" } });
  });

  it("does not mark prepayment received when the amount is zero", () => {
    const props = buildOrderProperties({ "Назва": "Рілс", "Сума передоплати": "0" });
    expect(props["Передоплата отримана"]).toEqual({ checkbox: false });
    expect(props["Статус оплати"]).toEqual({ select: { name: "Не оплачено" } });
  });
});

describe("createOrder", () => {
  it("POSTs a page under the configured database with built properties", async () => {
    const env = { NOTION_DATABASE_ID: "db1" };
    await createOrder(env, { "Назва": "Рілс" });
    expect(notionApi).toHaveBeenCalledWith(
      env,
      "pages",
      "POST",
      expect.objectContaining({
        parent: { database_id: "db1" },
        properties: expect.objectContaining({ "Назва": { title: [{ text: { content: "Рілс" } }] } }),
      }),
    );
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/notion.js", () => ({ notionApi: vi.fn().mockResolvedValue({ id: "page1" }) }));

import { notionApi } from "../../lib/notion.js";
import { applyStatusUpdate, applyPaymentUpdate } from "../status.js";

const env = {};

describe("applyStatusUpdate", () => {
  it("patches the status property", async () => {
    await applyStatusUpdate(env, "page1", "В роботі");
    expect(notionApi).toHaveBeenCalledWith(env, "pages/page1", "PATCH", {
      properties: { "Статус": { select: { name: "В роботі" } } },
    });
  });

  it("also stamps today's delivery date when moving to Здано", async () => {
    await applyStatusUpdate(env, "page1", "Здано");
    const [, , , body] = notionApi.mock.calls.at(-1);
    expect(body.properties["Статус"]).toEqual({ select: { name: "Здано" } });
    expect(body.properties["Фактична дата здачі"].date.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not stamp a delivery date for other statuses", async () => {
    await applyStatusUpdate(env, "page1", "Архів");
    const [, , , body] = notionApi.mock.calls.at(-1);
    expect(body.properties["Фактична дата здачі"]).toBeUndefined();
  });
});

describe("applyPaymentUpdate", () => {
  it("patches the payment status property", async () => {
    await applyPaymentUpdate(env, "page1", "Оплачено повністю");
    expect(notionApi).toHaveBeenCalledWith(env, "pages/page1", "PATCH", {
      properties: { "Статус оплати": { select: { name: "Оплачено повністю" } } },
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notionApi, queryOrders, getPage } from "../notion.js";

const env = { NOTION_API_KEY: "secret", NOTION_DATABASE_ID: "db1" };

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notionApi", () => {
  it("POSTs with auth header, version header, and JSON body", async () => {
    await notionApi(env, "pages", "POST", { foo: "bar" });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.notion.com/v1/pages");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer secret");
    expect(options.headers["Notion-Version"]).toBeTruthy();
    expect(JSON.parse(options.body)).toEqual({ foo: "bar" });
  });

  it("omits the body when none is given (e.g. GET)", async () => {
    await notionApi(env, "pages/123", "GET");
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  it("returns the parsed JSON response", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ id: "abc" })));
    expect(await notionApi(env, "pages/abc", "GET")).toEqual({ id: "abc" });
  });
});

describe("queryOrders", () => {
  it("POSTs to the database query endpoint with filter and sorts", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ results: [{ id: "1" }] })));
    const results = await queryOrders(env, { property: "x" }, [{ property: "y", direction: "ascending" }]);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.notion.com/v1/databases/db1/query");
    expect(JSON.parse(options.body)).toEqual({ filter: { property: "x" }, sorts: [{ property: "y", direction: "ascending" }] });
    expect(results).toEqual([{ id: "1" }]);
  });

  it("returns an empty array when the response has no results", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({})));
    expect(await queryOrders(env, {})).toEqual([]);
  });
});

describe("getPage", () => {
  it("GETs the page by id", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ id: "abc" })));
    await getPage(env, "abc");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.notion.com/v1/pages/abc");
    expect(options.method).toBe("GET");
  });
});

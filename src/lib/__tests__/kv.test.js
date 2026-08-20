import { describe, it, expect, vi } from "vitest";
import { getDraft, setDraft, clearDraft } from "../kv.js";

function mockEnv() {
  return {
    DRAFTS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("getDraft", () => {
  it("parses stored JSON keyed by chat id", async () => {
    const env = mockEnv();
    env.DRAFTS.get.mockResolvedValue('{"step":"name","name":"Order"}');
    const draft = await getDraft(env, 123);
    expect(env.DRAFTS.get).toHaveBeenCalledWith("draft:123");
    expect(draft).toEqual({ step: "name", name: "Order" });
  });

  it("returns null when nothing is stored", async () => {
    const env = mockEnv();
    env.DRAFTS.get.mockResolvedValue(null);
    expect(await getDraft(env, 123)).toBeNull();
  });
});

describe("setDraft", () => {
  it("stringifies the draft and sets a 30-minute TTL", async () => {
    const env = mockEnv();
    await setDraft(env, 123, { step: "name" });
    expect(env.DRAFTS.put).toHaveBeenCalledWith("draft:123", '{"step":"name"}', {
      expirationTtl: 1800,
    });
  });
});

describe("clearDraft", () => {
  it("deletes the chat's draft key", async () => {
    const env = mockEnv();
    await clearDraft(env, 123);
    expect(env.DRAFTS.delete).toHaveBeenCalledWith("draft:123");
  });
});

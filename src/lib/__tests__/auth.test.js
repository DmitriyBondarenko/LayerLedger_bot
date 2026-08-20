import { describe, it, expect } from "vitest";
import { allowedChatIds, isAllowed } from "../auth.js";

describe("allowedChatIds", () => {
  it("splits a comma-separated list and trims whitespace", () => {
    expect(allowedChatIds({ ALLOWED_CHAT_ID: "111, 222,333" })).toEqual(["111", "222", "333"]);
  });

  it("returns an empty array when unset", () => {
    expect(allowedChatIds({})).toEqual([]);
  });

  it("filters out empty entries", () => {
    expect(allowedChatIds({ ALLOWED_CHAT_ID: "111,,222," })).toEqual(["111", "222"]);
  });
});

describe("isAllowed", () => {
  const env = { ALLOWED_CHAT_ID: "111,222" };

  it("returns true for an allowed chat id, comparing as strings", () => {
    expect(isAllowed(env, 111)).toBe(true);
    expect(isAllowed(env, "222")).toBe(true);
  });

  it("returns false for a chat id not on the list", () => {
    expect(isAllowed(env, 999)).toBe(false);
  });

  it("returns false when no allowlist is configured", () => {
    expect(isAllowed({}, 111)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  optionsKeyboard,
  actionsKeyboard,
  menuKeyboard,
  mergeKeyboards,
  replyKeyboard,
  orderListKeyboard,
} from "../keyboard.js";

describe("optionsKeyboard", () => {
  it("indexes callback_data back into the options array", () => {
    const kb = optionsKeyboard(["A", "B", "C"], "opt");
    expect(kb.inline_keyboard.flat()).toEqual([
      { text: "A", callback_data: "opt:0" },
      { text: "B", callback_data: "opt:1" },
      { text: "C", callback_data: "opt:2" },
    ]);
  });

  it("wraps into rows of `columns`", () => {
    const kb = optionsKeyboard(["A", "B", "C"], "opt", 2);
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    expect(kb.inline_keyboard[1]).toHaveLength(1);
  });

  it("uses labels for text while keeping index tied to options", () => {
    const kb = optionsKeyboard(["a", "b"], "opt", 2, ["🔴 a", "🟢 b"]);
    expect(kb.inline_keyboard[0]).toEqual([
      { text: "🔴 a", callback_data: "opt:0" },
      { text: "🟢 b", callback_data: "opt:1" },
    ]);
  });
});

describe("actionsKeyboard", () => {
  it("puts all actions in a single row", () => {
    const kb = actionsKeyboard([
      { label: "Так", data: "yes" },
      { label: "Ні", data: "no" },
    ]);
    expect(kb.inline_keyboard).toEqual([
      [
        { text: "Так", callback_data: "yes" },
        { text: "Ні", callback_data: "no" },
      ],
    ]);
  });
});

describe("menuKeyboard", () => {
  it("wraps actions into rows of `columns`", () => {
    const actions = [
      { label: "1", data: "a" },
      { label: "2", data: "b" },
      { label: "3", data: "c" },
    ];
    const kb = menuKeyboard(actions, 2);
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    expect(kb.inline_keyboard[1]).toHaveLength(1);
  });
});

describe("mergeKeyboards", () => {
  it("concatenates rows from multiple keyboards", () => {
    const a = { inline_keyboard: [[{ text: "1", callback_data: "1" }]] };
    const b = { inline_keyboard: [[{ text: "2", callback_data: "2" }]] };
    expect(mergeKeyboards(a, b).inline_keyboard).toEqual([
      [{ text: "1", callback_data: "1" }],
      [{ text: "2", callback_data: "2" }],
    ]);
  });
});

describe("replyKeyboard", () => {
  it("builds a resizable keyboard with plain text buttons", () => {
    const kb = replyKeyboard([{ label: "/new" }, { label: "/status" }], 2);
    expect(kb).toEqual({
      keyboard: [[{ text: "/new" }, { text: "/status" }]],
      resize_keyboard: true,
    });
  });
});

describe("orderListKeyboard", () => {
  it("builds one row per order with page id in callback_data", () => {
    const kb = orderListKeyboard([
      { id: "abc123", label: "Order 1" },
      { id: "def456", label: "Order 2" },
    ]);
    expect(kb.inline_keyboard).toEqual([
      [{ text: "Order 1", callback_data: "ord:abc123" }],
      [{ text: "Order 2", callback_data: "ord:def456" }],
    ]);
  });
});

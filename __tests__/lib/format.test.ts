import { describe, expect, it } from "vitest";

import { clamp, formatNumber, toTitleCase, wrapText } from "@/helpers/format";

describe("format helpers", () => {
  it("clamps values inside bounds", () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(3, 0, 5)).toBe(3);
  });

  it("formats decimals without trailing zeros", () => {
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(1.25)).toBe("1.25");
  });

  it("converts strings to title case", () => {
    expect(toTitleCase("prompt")).toBe("Prompt");
    expect(toTitleCase("")).toBe("");
  });

  it("wraps text preserving lines", () => {
    expect(wrapText("hello world", 5)).toEqual(["hello", "world"]);
    expect(wrapText("a\nb", 10)).toEqual(["a", "b"]);
  });

  it("returns a blank line for empty text and preserves blank lines", () => {
    expect(wrapText("", 5)).toEqual([""]);
    expect(wrapText("a\n\nb", 5)).toEqual(["a", "", "b"]);
  });

  it("splits long words when they exceed the width", () => {
    expect(wrapText("abcdefgh", 3)).toEqual(["abc", "def", "gh"]);
  });
});

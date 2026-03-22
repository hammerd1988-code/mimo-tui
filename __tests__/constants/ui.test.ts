import { describe, expect, it } from "vitest";

import {
  APP_BACKGROUND_COLOR,
  CONVERSATION_HEIGHT,
  CONVERSATION_HELP_TEXT,
  CONVERSATION_STATIC_LINES,
  DEFAULT_HEADER_HELP_TEXT,
} from "@/constants/ui";

describe("ui constants", () => {
  it("defines the expected layout constants", () => {
    expect(APP_BACKGROUND_COLOR).toBe("#000");
    expect(CONVERSATION_HEIGHT).toBe(38);
    expect(CONVERSATION_STATIC_LINES).toBe(4);
  });

  it("defines help text shown in the interface", () => {
    expect(CONVERSATION_HELP_TEXT).toContain("Ctrl+F");
    expect(CONVERSATION_HELP_TEXT).toContain("Ctrl+Y");
    expect(DEFAULT_HEADER_HELP_TEXT).toContain("{focusLabel}");
    expect(DEFAULT_HEADER_HELP_TEXT).toContain("Ctrl+C");
  });
});

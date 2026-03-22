import { describe, expect, it } from "vitest";

import { ANSI_COLOR_MAP } from "@/constants/terminal";

describe("terminal constants", () => {
  it("defines ANSI color mappings used by the renderer", () => {
    expect(ANSI_COLOR_MAP[30]).toBe("black");
    expect(ANSI_COLOR_MAP[36]).toBe("cyan");
    expect(ANSI_COLOR_MAP[90]).toBe("gray");
    expect(ANSI_COLOR_MAP[97]).toBe("white");
  });
});

import { describe, expect, it } from "vitest";

import { ROLE_COLOR, ROLE_LABEL } from "@/constants/conversation";

describe("conversation constants", () => {
  it("defines role colors and labels", () => {
    expect(ROLE_COLOR.user).toBe("magenta");
    expect(ROLE_COLOR.assistant).toBe("green");
    expect(ROLE_LABEL.assistant).toBe("MiMo");
    expect(ROLE_LABEL.meta).toBe("");
  });
});

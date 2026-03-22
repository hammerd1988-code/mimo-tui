import { describe, expect, it } from "vitest";

import { API_URL } from "@/constants/api";

describe("api constants", () => {
  it("defines the MiMo API URL", () => {
    expect(API_URL).toBe("https://api.xiaomimimo.com/v1/chat/completions");
  });
});

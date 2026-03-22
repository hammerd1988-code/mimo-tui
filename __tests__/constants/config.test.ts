import { describe, expect, it } from "vitest";

import {
  APP_DIRECTORY_NAME,
  CONFIG_FILE_NAME,
  DATABASE_FILE_NAME,
  MIMO_CONFIG_EXAMPLE,
} from "@/constants/config";

describe("config constants", () => {
  it("defines static config file names", () => {
    expect(APP_DIRECTORY_NAME).toBe("mimo");
    expect(CONFIG_FILE_NAME).toBe("config.json");
    expect(DATABASE_FILE_NAME).toBe("chat_context.db");
  });

  it("defines the example config file payload", () => {
    expect(MIMO_CONFIG_EXAMPLE).toContain('"mimo_api_key"');
    expect(MIMO_CONFIG_EXAMPLE).toContain('"your-api-key-here"');
  });
});

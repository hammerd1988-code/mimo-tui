import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env helpers", () => {
  const testEnvName = "MIMO_TEST_ENV";

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns null when an optional env var is missing", async () => {
    const { getOptionalEnv } = await import("../../src/config/env");

    expect(getOptionalEnv(testEnvName)).toBeNull();
  });

  it("trims optional env var values", async () => {
    vi.stubEnv(testEnvName, "  test-key  ");
    const { getOptionalEnv } = await import("../../src/config/env");

    expect(getOptionalEnv(testEnvName)).toBe("test-key");
  });

  it("returns null for optional env vars that become empty after trim", async () => {
    vi.stubEnv(testEnvName, "   ");
    const { getOptionalEnv } = await import("../../src/config/env");

    expect(getOptionalEnv(testEnvName)).toBeNull();
  });

  it("throws when a required env var is missing", async () => {
    const { getRequiredEnv } = await import("../../src/config/env");

    expect(() => getRequiredEnv(testEnvName)).toThrow(
      `${testEnvName} is not set`,
    );
  });

  it("returns trimmed values for required env vars", async () => {
    vi.stubEnv(testEnvName, "  required-key  ");
    const { getRequiredEnv } = await import("../../src/config/env");

    expect(getRequiredEnv(testEnvName)).toBe("required-key");
  });

  it("loads the local env file successfully", async () => {
    const onError = vi.fn();
    const loader = vi.fn();
    const { loadLocalEnvFile } = await import("../../src/config/env");

    expect(loadLocalEnvFile({ loader, onError })).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores ENOENT while loading the local env file", async () => {
    const onError = vi.fn();
    const loader = vi.fn(() => {
      const error = new Error("missing");
      Object.assign(error, { code: "ENOENT" });

      throw error;
    });

    const { loadLocalEnvFile } = await import("../../src/config/env");

    expect(loadLocalEnvFile({ loader, onError })).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports unexpected env loading errors", async () => {
    const onError = vi.fn();

    const loader = vi.fn(() => {
      throw new Error("broken env");
    });

    const { loadLocalEnvFile } = await import("../../src/config/env");

    expect(loadLocalEnvFile({ loader, onError })).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      "Failed to load .env file: broken env",
    );
  });

  it("uses the default console reporter for unknown env loading failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadLocalEnvFile } = await import("../../src/config/env");

    expect(
      loadLocalEnvFile({
        loader: () => {
          throw "broken";
        },
      }),
    ).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to load .env file: unknown error",
    );
  });
});

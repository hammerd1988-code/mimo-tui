import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("mimo-paths", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("resolves config roots for linux, macOS and windows", async () => {
    const { getConfigRootDirectory } =
      await import("../../src/config/mimo-paths");

    expect(
      getConfigRootDirectory({
        env: { XDG_CONFIG_HOME: "/tmp/mimo-config-home" },
        homeDirectory: "/home/test",
        platform: "linux",
      }),
    ).toBe("/tmp/mimo-config-home");

    expect(
      getConfigRootDirectory({
        env: {},
        homeDirectory: "/home/test",
        platform: "linux",
      }),
    ).toBe("/home/test/.config");

    expect(
      getConfigRootDirectory({
        env: {},
        homeDirectory: "/Users/test",
        platform: "darwin",
      }),
    ).toBe("/Users/test/Library/Application Support");

    expect(
      getConfigRootDirectory({
        env: { APPDATA: "C:/Users/test/AppData/Roaming" },
        homeDirectory: "C:/Users/test",
        platform: "win32",
      }),
    ).toBe("C:/Users/test/AppData/Roaming");

    expect(
      getConfigRootDirectory({
        env: {},
        homeDirectory: "C:/Users/test",
        platform: "win32",
      }),
    ).toBe("C:/Users/test/AppData/Roaming");
  });

  it("resolves data roots for linux, macOS and windows", async () => {
    const { getDataRootDirectory } =
      await import("../../src/config/mimo-paths");

    expect(
      getDataRootDirectory({
        env: { XDG_DATA_HOME: "/tmp/mimo-data-home" },
        homeDirectory: "/home/test",
        platform: "linux",
      }),
    ).toBe("/tmp/mimo-data-home");

    expect(
      getDataRootDirectory({
        env: {},
        homeDirectory: "/home/test",
        platform: "linux",
      }),
    ).toBe("/home/test/.local/share");

    expect(
      getDataRootDirectory({
        env: {},
        homeDirectory: "/Users/test",
        platform: "darwin",
      }),
    ).toBe("/Users/test/Library/Application Support");

    expect(
      getDataRootDirectory({
        env: {
          APPDATA: "C:/Users/test/AppData/Roaming",
          LOCALAPPDATA: "C:/Users/test/AppData/Local",
        },
        homeDirectory: "C:/Users/test",
        platform: "win32",
      }),
    ).toBe("C:/Users/test/AppData/Local");

    expect(
      getDataRootDirectory({
        env: { APPDATA: "C:/Users/test/AppData/Roaming" },
        homeDirectory: "C:/Users/test",
        platform: "win32",
      }),
    ).toBe("C:/Users/test/AppData/Roaming");

    expect(
      getDataRootDirectory({
        env: {},
        homeDirectory: "C:/Users/test",
        platform: "win32",
      }),
    ).toBe("C:/Users/test/AppData/Local");
  });

  it("builds config and database paths from the resolved roots", async () => {
    const {
      getMimoConfigDirectory,
      getMimoConfigPath,
      getMimoDataDirectory,
      getMimoDatabasePath,
    } = await import("../../src/config/mimo-paths");

    const options = {
      env: {
        XDG_CONFIG_HOME: "/tmp/mimo-config-home",
        XDG_DATA_HOME: "/tmp/mimo-data-home",
      },
      homeDirectory: "/home/test",
      platform: "linux" as const,
    };

    expect(getMimoConfigDirectory(options)).toBe("/tmp/mimo-config-home/mimo");
    expect(getMimoConfigPath(options)).toBe(
      "/tmp/mimo-config-home/mimo/config.json",
    );
    expect(getMimoDataDirectory(options)).toBe("/tmp/mimo-data-home/mimo");
    expect(getMimoDatabasePath(options)).toBe(
      "/tmp/mimo-data-home/mimo/chat_context.db",
    );
  });
});

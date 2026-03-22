import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("mimo-config", () => {
  let tempConfigHome = "";

  beforeEach(async () => {
    tempConfigHome = await mkdtemp(join(tmpdir(), "mimo-config-"));

    vi.resetModules();
    vi.stubEnv("MIMO_API_KEY", "");
    vi.stubEnv("XDG_CONFIG_HOME", tempConfigHome);
  });

  afterEach(async () => {
    vi.doUnmock("node:fs/promises");
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();

    await rm(tempConfigHome, { force: true, recursive: true });
  });

  it("reports a missing config file", async () => {
    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await expect(loadConfiguredApiKey()).resolves.toMatchObject({
      path: MIMO_CONFIG_PATH,
      status: "missing",
    });
  });

  it("reports invalid json config files", async () => {
    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await mkdir(dirname(MIMO_CONFIG_PATH), { recursive: true });
    await writeFile(MIMO_CONFIG_PATH, "{invalid", "utf8");

    await expect(loadConfiguredApiKey()).resolves.toMatchObject({
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    });
  });

  it("reports unexpected config read failures", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual =
        await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises",
        );

      return {
        ...actual,
        readFile: vi.fn(async () => {
          throw { code: "EACCES" };
        }),
      };
    });

    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await expect(loadConfiguredApiKey()).resolves.toEqual({
      message: "Failed to read config file: unknown error",
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    });
  });

  it("reports config read failures from Error instances", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual =
        await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises",
        );

      return {
        ...actual,
        readFile: vi.fn(async () => {
          throw new Error("permission denied");
        }),
      };
    });

    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await expect(loadConfiguredApiKey()).resolves.toEqual({
      message: "Failed to read config file: permission denied",
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    });
  });

  it("reports config files without a valid mimo_api_key", async () => {
    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await mkdir(dirname(MIMO_CONFIG_PATH), { recursive: true });
    await writeFile(MIMO_CONFIG_PATH, '{ "mimo_api_key": "   " }\n', "utf8");

    await expect(loadConfiguredApiKey()).resolves.toMatchObject({
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    });
  });

  it("reports non-Error JSON parsing failures", async () => {
    const { loadConfiguredApiKey, MIMO_CONFIG_PATH } =
      await import("../../src/config/mimo-config");

    await mkdir(dirname(MIMO_CONFIG_PATH), { recursive: true });
    await writeFile(MIMO_CONFIG_PATH, '{ "mimo_api_key": "secret" }\n', "utf8");

    vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw "invalid";
    });

    await expect(loadConfiguredApiKey()).resolves.toEqual({
      message: "Config file is not valid JSON: unknown error",
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    });
  });

  it("saves and loads the API key from config.json", async () => {
    const { loadConfiguredApiKey, saveApiKeyConfig } =
      await import("../../src/config/mimo-config");

    const savedPath = await saveApiKeyConfig("  secret-key  ");
    const fileContent = JSON.parse(await readFile(savedPath, "utf8")) as {
      mimo_api_key: string;
    };

    expect(fileContent).toEqual({ mimo_api_key: "secret-key" });

    await expect(loadConfiguredApiKey()).resolves.toMatchObject({
      apiKey: "secret-key",
      path: savedPath,
      source: "file",
      status: "ready",
    });

    if (process.platform !== "win32") {
      const mode = (await stat(savedPath)).mode & 0o777;

      expect(mode).toBe(0o600);
    }
  });

  it("prefers MIMO_API_KEY from the environment when present", async () => {
    vi.stubEnv("MIMO_API_KEY", "env-key");
    const { loadConfiguredApiKey } =
      await import("../../src/config/mimo-config");

    await expect(loadConfiguredApiKey()).resolves.toMatchObject({
      apiKey: "env-key",
      source: "env",
      status: "ready",
    });
  });

  it("rejects empty api keys on save", async () => {
    const { saveApiKeyConfig } = await import("../../src/config/mimo-config");

    await expect(saveApiKeyConfig("   ")).rejects.toThrow(
      "API key cannot be empty",
    );
  });

  it("skips chmod when saving on Windows", async () => {
    const chmodMock = vi.fn();
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const readFileMock = vi.fn();
    const writeFileMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock("node:fs/promises", () => ({
      chmod: chmodMock,
      mkdir: mkdirMock,
      readFile: readFileMock,
      writeFile: writeFileMock,
    }));

    vi.spyOn(process, "platform", "get").mockReturnValue("win32");

    const { MIMO_CONFIG_DIRECTORY, MIMO_CONFIG_PATH, saveApiKeyConfig } =
      await import("../../src/config/mimo-config");

    await expect(saveApiKeyConfig("win-key")).resolves.toBe(MIMO_CONFIG_PATH);

    expect(mkdirMock).toHaveBeenCalledWith(MIMO_CONFIG_DIRECTORY, {
      recursive: true,
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      MIMO_CONFIG_PATH,
      expect.stringContaining('"mimo_api_key": "win-key"'),
      expect.objectContaining({
        encoding: "utf8",
        mode: 0o600,
      }),
    );

    expect(chmodMock).not.toHaveBeenCalled();
  });
});

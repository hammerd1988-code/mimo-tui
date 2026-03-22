import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";

import { getOptionalEnv } from "@/config/env";
import { getMimoConfigDirectory, getMimoConfigPath } from "@/config/mimo-paths";
import { ApiKeyLookupResult, MimoConfigFile } from "@/types/config";

const normalizeApiKey = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : null;
};

export const MIMO_CONFIG_DIRECTORY = getMimoConfigDirectory();
export const MIMO_CONFIG_PATH = getMimoConfigPath();

export const loadConfiguredApiKey = async (): Promise<ApiKeyLookupResult> => {
  const envApiKey = normalizeApiKey(getOptionalEnv("MIMO_API_KEY"));

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      path: MIMO_CONFIG_PATH,
      source: "env",
      status: "ready",
    };
  }

  let rawConfig = "";

  try {
    rawConfig = await readFile(MIMO_CONFIG_PATH, "utf8");
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;

    if (errorCode === "ENOENT") {
      return {
        message: "Config file not found.",
        path: MIMO_CONFIG_PATH,
        status: "missing",
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : "unknown error";

    return {
      message: `Failed to read config file: ${errorMessage}`,
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    };
  }

  let parsedConfig: MimoConfigFile;

  try {
    parsedConfig = JSON.parse(rawConfig) as MimoConfigFile;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";

    return {
      message: `Config file is not valid JSON: ${errorMessage}`,
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    };
  }

  const apiKey = normalizeApiKey(parsedConfig.mimo_api_key);

  if (!apiKey) {
    return {
      message: 'Config file must contain a non-empty "mimo_api_key" string.',
      path: MIMO_CONFIG_PATH,
      status: "invalid",
    };
  }

  return {
    apiKey,
    path: MIMO_CONFIG_PATH,
    source: "file",
    status: "ready",
  };
};

export const saveApiKeyConfig = async (apiKey: string) => {
  const normalizedApiKey = normalizeApiKey(apiKey);

  if (!normalizedApiKey) {
    throw new Error("API key cannot be empty");
  }

  await mkdir(MIMO_CONFIG_DIRECTORY, { recursive: true });

  await writeFile(
    MIMO_CONFIG_PATH,
    `${JSON.stringify({ mimo_api_key: normalizedApiKey }, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  if (process.platform !== "win32") {
    await chmod(MIMO_CONFIG_PATH, 0o600);
  }

  return MIMO_CONFIG_PATH;
};

import { loadEnvFile } from "node:process";

export const loadLocalEnvFile = ({
  loader = loadEnvFile,
  onError = (message: string) => console.error(message),
}: {
  loader?: () => void;
  onError?: (message: string) => void;
} = {}) => {
  try {
    loader();

    return true;
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;

    if (errorCode !== "ENOENT") {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";

      onError(`Failed to load .env file: ${errorMessage}`);
    }

    return false;
  }
};

loadLocalEnvFile();

export const getOptionalEnv = (name: string): string | null => {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const getRequiredEnv = (name: string): string => {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
};

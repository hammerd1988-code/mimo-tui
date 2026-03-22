import { homedir } from "node:os";
import { join } from "node:path";

import {
  APP_DIRECTORY_NAME,
  CONFIG_FILE_NAME,
  DATABASE_FILE_NAME,
} from "@/constants/config";
import { MimoPathOptions } from "@/types/config";

export const getConfigRootDirectory = ({
  env = process.env,
  homeDirectory = homedir(),
  platform = process.platform,
}: MimoPathOptions = {}) => {
  if (platform === "win32") {
    return env.APPDATA ?? join(homeDirectory, "AppData", "Roaming");
  }

  if (platform === "darwin") {
    return join(homeDirectory, "Library", "Application Support");
  }

  return env.XDG_CONFIG_HOME ?? join(homeDirectory, ".config");
};

export const getDataRootDirectory = ({
  env = process.env,
  homeDirectory = homedir(),
  platform = process.platform,
}: MimoPathOptions = {}) => {
  if (platform === "win32") {
    return (
      env.LOCALAPPDATA ?? env.APPDATA ?? join(homeDirectory, "AppData", "Local")
    );
  }

  if (platform === "darwin") {
    return join(homeDirectory, "Library", "Application Support");
  }

  return env.XDG_DATA_HOME ?? join(homeDirectory, ".local", "share");
};

export const getMimoConfigDirectory = (options?: MimoPathOptions) =>
  join(getConfigRootDirectory(options), APP_DIRECTORY_NAME);

export const getMimoConfigPath = (options?: MimoPathOptions) =>
  join(getMimoConfigDirectory(options), CONFIG_FILE_NAME);

export const getMimoDataDirectory = (options?: MimoPathOptions) =>
  join(getDataRootDirectory(options), APP_DIRECTORY_NAME);

export const getMimoDatabasePath = (options?: MimoPathOptions) =>
  join(getMimoDataDirectory(options), DATABASE_FILE_NAME);

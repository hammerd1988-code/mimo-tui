export type MimoConfigFile = {
  mimo_api_key?: string;
};

export type ApiKeyLookupResult =
  | {
      apiKey: string;
      path: string;
      source: "env" | "file";
      status: "ready";
    }
  | {
      message: string;
      path: string;
      status: "missing" | "invalid";
    };

export type MimoPathOptions = {
  env?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
};

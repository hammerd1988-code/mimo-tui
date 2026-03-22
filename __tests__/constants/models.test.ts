import { describe, expect, it } from "vitest";

import {
  CHAT_MODELS,
  createDefaultSettings,
  DEFAULT_MODEL,
  DEFAULT_SETTINGS,
  MODEL_ORDER,
  TEXT_RESPONSE_FORMATS,
  TEXT_SETTING_KEYS,
  TTS_RESPONSE_FORMATS,
  TTS_SETTING_KEYS,
  TTS_VOICES,
} from "@/constants/models";

describe("models constants", () => {
  it("defines the expected model and settings constants", () => {
    expect(DEFAULT_MODEL).toBe("mimo-v2-pro");

    expect(MODEL_ORDER).toEqual([
      "mimo-v2-flash",
      "mimo-v2-pro",
      "mimo-v2-omni",
      "mimo-v2-tts",
    ]);

    expect(TEXT_SETTING_KEYS).toContain("thinking");
    expect(TTS_SETTING_KEYS).toContain("voice");
    expect(TEXT_RESPONSE_FORMATS).toEqual(["text", "json_object"]);
    expect(TTS_RESPONSE_FORMATS).toEqual(["wav", "mp3", "pcm16"]);
    expect(TTS_VOICES).toEqual(["mimo_default", "default_en", "default_zh"]);
  });

  it("creates default settings for text and tts models", () => {
    expect(DEFAULT_SETTINGS).toEqual(createDefaultSettings(DEFAULT_MODEL));

    expect(createDefaultSettings("mimo-v2-pro")).toMatchObject({
      model: "mimo-v2-pro",
      responseFormat: "text",
      stream: true,
      voice: "mimo_default",
    });

    expect(createDefaultSettings("mimo-v2-tts")).toMatchObject({
      model: "mimo-v2-tts",
      responseFormat: "mp3",
      stream: false,
      voice: "default_en",
    });
  });

  it("contains profiles for every supported model", () => {
    expect(Object.keys(CHAT_MODELS).sort()).toEqual(MODEL_ORDER.slice().sort());
  });
});

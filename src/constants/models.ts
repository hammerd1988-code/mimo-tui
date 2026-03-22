import {
  ModelId,
  ModelProfile,
  ResponseFormatType,
  Settings,
  TtsVoice,
} from "@/types/mimo";

export const DEFAULT_MODEL: ModelId = "mimo-v2-pro";

export const MODEL_ORDER: ModelId[] = [
  "mimo-v2-flash",
  "mimo-v2-pro",
  "mimo-v2-omni",
  "mimo-v2-tts",
];

export const TEXT_SETTING_KEYS = [
  "model",
  "thinking",
  "stream",
  "responseFormat",
  "temperature",
  "topP",
  "maxCompletionTokens",
  "frequencyPenalty",
  "presencePenalty",
] as const;

export const TTS_SETTING_KEYS = [
  "model",
  "stream",
  "responseFormat",
  "voice",
  "maxCompletionTokens",
] as const;

export const TEXT_RESPONSE_FORMATS: ResponseFormatType[] = [
  "text",
  "json_object",
];

export const TTS_RESPONSE_FORMATS: ResponseFormatType[] = [
  "wav",
  "mp3",
  "pcm16",
];

export const TTS_VOICES: TtsVoice[] = [
  "mimo_default",
  "default_en",
  "default_zh",
];

export const CHAT_MODELS: Record<ModelId, ModelProfile> = {
  "mimo-v2-flash": {
    category: "General-purpose text generation",
    contextLength: "256K",
    defaultMaxCompletionTokens: 65_536,
    defaultTemperature: 0.3,
    defaultThinking: "disabled",
    defaultTopP: 0.95,
    features: [
      "Text generation",
      "Thinking",
      "Streaming",
      "Function call",
      "JSON",
    ],
    maxOutput: "64K",
  },
  "mimo-v2-omni": {
    category: "Multimodal understanding",
    contextLength: "256K",
    defaultMaxCompletionTokens: 32_768,
    defaultTemperature: 1.0,
    defaultThinking: "enabled",
    defaultTopP: 0.95,
    features: ["Multimodal", "Thinking", "Streaming", "Function call", "JSON"],
    maxOutput: "128K",
  },
  "mimo-v2-pro": {
    category: "General-purpose text generation",
    contextLength: "1M",
    defaultMaxCompletionTokens: 131_072,
    defaultTemperature: 1.0,
    defaultThinking: "enabled",
    defaultTopP: 0.95,
    features: [
      "Text generation",
      "Thinking",
      "Streaming",
      "Function call",
      "JSON",
    ],
    maxOutput: "128K",
  },
  "mimo-v2-tts": {
    category: "Speech synthesis",
    contextLength: "8K",
    defaultMaxCompletionTokens: 8_192,
    defaultTemperature: 0.6,
    defaultThinking: "disabled",
    defaultTopP: 0.95,
    features: ["Speech synthesis", "Streaming audio"],
    maxOutput: "8K",
  },
};

export const createDefaultSettings = (model: ModelId): Settings => {
  const profile = CHAT_MODELS[model];
  const isTtsModel = model === "mimo-v2-tts";

  return {
    frequencyPenalty: 0,
    maxCompletionTokens: profile.defaultMaxCompletionTokens,
    model,
    presencePenalty: 0,
    responseFormat: isTtsModel ? "mp3" : "text",
    stream: isTtsModel ? false : true,
    systemPrompt:
      "You are MiMo, an AI assistant developed by Xiaomi. Be clear, accurate, and concise.",
    temperature: profile.defaultTemperature,
    thinking: profile.defaultThinking,
    topP: profile.defaultTopP,
    voice: isTtsModel ? "default_en" : "mimo_default",
  };
};

export const DEFAULT_SETTINGS = createDefaultSettings(DEFAULT_MODEL);

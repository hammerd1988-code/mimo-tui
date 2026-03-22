import {
  CHAT_MODELS,
  MODEL_ORDER,
  TEXT_RESPONSE_FORMATS,
  TTS_RESPONSE_FORMATS,
  TTS_VOICES,
} from "@/constants/models";
import { clamp } from "@/helpers/format";
import { ChangeSettingContext, SettingKey } from "@/types/app";

const cycleValue = <T>(
  items: readonly T[],
  currentValue: T,
  direction: 1 | -1,
) =>
  items[
    (items.indexOf(currentValue) + direction + items.length) % items.length
  ];

const settingChangeHandlers: Record<
  SettingKey,
  (context: ChangeSettingContext) => void
> = {
  model: ({ applyModelDefaults, direction, settingsRef }) => {
    const nextModel =
      MODEL_ORDER[
        (MODEL_ORDER.indexOf(settingsRef.current.model) +
          direction +
          MODEL_ORDER.length) %
          MODEL_ORDER.length
      ];

    applyModelDefaults(nextModel);
  },
  thinking: ({ setSettings }) => {
    setSettings((current) => ({
      ...current,
      thinking: current.thinking === "enabled" ? "disabled" : "enabled",
    }));
  },
  stream: ({ setSettings }) => {
    setSettings((current) => {
      const nextStream = !current.stream;

      if (current.model !== "mimo-v2-tts") {
        return { ...current, stream: nextStream };
      }

      return {
        ...current,
        responseFormat: nextStream
          ? "pcm16"
          : current.responseFormat === "pcm16"
            ? "wav"
            : current.responseFormat,
        stream: nextStream,
      };
    });
  },
  responseFormat: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      responseFormat:
        current.model === "mimo-v2-tts"
          ? cycleValue(
              current.stream
                ? TTS_RESPONSE_FORMATS.filter((format) => format === "pcm16")
                : TTS_RESPONSE_FORMATS.filter((format) => format !== "pcm16"),
              current.stream ? "pcm16" : current.responseFormat,
              direction,
            )
          : cycleValue(
              TEXT_RESPONSE_FORMATS,
              current.responseFormat,
              direction,
            ),
    }));
  },
  voice: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      voice: cycleValue(TTS_VOICES, current.voice, direction),
    }));
  },
  temperature: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      temperature: clamp(current.temperature + direction * 0.1, 0, 1.5),
    }));
  },
  topP: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      topP: clamp(current.topP + direction * 0.05, 0.01, 1),
    }));
  },
  maxCompletionTokens: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      maxCompletionTokens: clamp(
        current.maxCompletionTokens + direction * 1024,
        256,
        CHAT_MODELS[current.model].defaultMaxCompletionTokens,
      ),
    }));
  },
  frequencyPenalty: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      frequencyPenalty: clamp(
        current.frequencyPenalty + direction * 0.2,
        -2,
        2,
      ),
    }));
  },
  presencePenalty: ({ direction, setSettings }) => {
    setSettings((current) => ({
      ...current,
      presencePenalty: clamp(current.presencePenalty + direction * 0.2, -2, 2),
    }));
  },
};

export const changeSettingValue = (
  settingKey: SettingKey | undefined,
  context: ChangeSettingContext,
) => {
  if (!settingKey) {
    return;
  }

  settingChangeHandlers[settingKey](context);
};

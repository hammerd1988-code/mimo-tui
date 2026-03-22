import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { API_URL } from "@/constants/api";
import {
  ChatHistoryMessage,
  OpenAIResponse,
  OpenAIStreamChunk,
  Settings,
} from "@/types/mimo";

const createAudioFilePath = (extension: string) =>
  join(homedir(), `mimo-tts-${Date.now()}.${extension}`);

const toWavBuffer = (pcm16Data: Buffer, sampleRate = 24_000, channels = 1) => {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + pcm16Data.length);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcm16Data.length, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(pcm16Data.length, 40);

  pcm16Data.copy(buffer, 44);

  return buffer;
};

const parseSseEvent = (eventBlock: string) => {
  const dataLines = eventBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n");

  if (payload === "[DONE]") {
    return null;
  }

  return JSON.parse(payload) as OpenAIStreamChunk;
};

const normalizeAssistantContent = (payload: OpenAIResponse) => {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }

  return "";
};

export const buildRequestBody = (
  history: ChatHistoryMessage[],
  currentPrompt: string,
  active: Settings,
  persistedContextPrompt = "",
) => {
  const systemPrompt = persistedContextPrompt
    ? `${active.systemPrompt}\n\nPersisted conversation context:\n${persistedContextPrompt}`
    : active.systemPrompt;

  const messages: ChatHistoryMessage[] =
    active.model === "mimo-v2-tts"
      ? [
          {
            content: currentPrompt,
            role: "assistant",
          },
        ]
      : [
          {
            content: systemPrompt,
            role: "system",
          },
          ...history,
          {
            content: currentPrompt,
            role: "user",
          },
        ];

  const body: Record<string, unknown> = {
    max_completion_tokens: active.maxCompletionTokens,
    messages,
    model: active.model,
    stream: active.stream,
  };

  if (active.model === "mimo-v2-tts") {
    body.audio = {
      format: active.stream ? "pcm16" : active.responseFormat,
      voice: active.voice,
    };

    return body;
  }

  body.frequency_penalty = active.frequencyPenalty;
  body.presence_penalty = active.presencePenalty;
  body.temperature = active.temperature;
  body.thinking = {
    type: active.thinking,
  };
  body.top_p = active.topP;

  if (active.responseFormat !== "text") {
    body.response_format = {
      type: active.responseFormat,
    };
  }

  return body;
};

export const createMiMoRequest = (
  body: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal,
) =>
  fetch(API_URL, {
    body: JSON.stringify(body),
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    method: "POST",
    signal,
  });

export const readTtsStreamResponse = async (
  response: Response,
  signal: AbortSignal,
  {
    createAudioFilePathFn = createAudioFilePath,
    writeFileFn = writeFile,
  }: {
    createAudioFilePathFn?: (extension: string) => string;
    writeFileFn?: typeof writeFile;
  } = {},
) => {
  if (!response.body) {
    throw new Error("MiMo TTS response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Buffer[] = [];
  let buffer = "";

  while (true) {
    if (signal.aborted) {
      throw new DOMException("Response aborted", "AbortError");
    }

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");

    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const chunk = parseSseEvent(block);

      if (!chunk) {
        continue;
      }

      if (chunk.error?.message) {
        throw new Error(chunk.error.message);
      }

      const audioData = chunk.choices?.[0]?.delta?.audio?.data;

      if (!audioData) {
        continue;
      }

      chunks.push(Buffer.from(audioData, "base64"));
    }
  }

  const filePath = createAudioFilePathFn("wav");
  const wavBuffer = toWavBuffer(Buffer.concat(chunks));

  await writeFileFn(filePath, wavBuffer);

  return filePath;
};

export const readTtsJsonResponse = async (
  response: Response,
  format: "mp3" | "wav",
  {
    createAudioFilePathFn = createAudioFilePath,
    writeFileFn = writeFile,
  }: {
    createAudioFilePathFn?: (extension: string) => string;
    writeFileFn?: typeof writeFile;
  } = {},
) => {
  const payload = (await response.json()) as OpenAIResponse;

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const audioData = payload.choices?.[0]?.message?.audio?.data;

  if (!audioData) {
    throw new Error("MiMo TTS did not return audio data");
  }

  const filePath = createAudioFilePathFn(format);

  await writeFileFn(filePath, Buffer.from(audioData, "base64"));

  return filePath;
};

export const readStreamResponse = async ({
  response,
  assistantId,
  signal,
  onFirstChunk,
  onText,
}: {
  response: Response;
  assistantId: number;
  signal: AbortSignal;
  onFirstChunk: () => void;
  onText: (assistantId: number, text: string) => void;
}) => {
  if (!response.body) {
    throw new Error("MiMo response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let collected = "";
  let lastRenderedText = "";
  let lastRenderAt = 0;

  while (true) {
    if (signal.aborted) {
      throw new DOMException("Response aborted", "AbortError");
    }

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");

    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const chunk = parseSseEvent(block);

      if (!chunk) {
        continue;
      }

      if (chunk.error?.message) {
        throw new Error(chunk.error.message);
      }

      const delta = chunk.choices?.[0]?.delta?.content ?? "";

      if (!delta) {
        continue;
      }

      if (collected.length === 0) {
        onFirstChunk();
      }

      collected += delta;

      const now = Date.now();
      const shouldFlush =
        now - lastRenderAt >= 48 ||
        delta.includes("\n") ||
        collected.length - lastRenderedText.length >= 24;

      if (shouldFlush) {
        onText(assistantId, collected);

        lastRenderedText = collected;
        lastRenderAt = now;
      }
    }
  }

  if (collected !== lastRenderedText) {
    onText(assistantId, collected);
  }

  return collected;
};

export const readJsonResponse = async (
  response: Response,
  assistantId: number,
  onText: (assistantId: number, text: string) => void,
) => {
  const payload = (await response.json()) as OpenAIResponse;

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const text = normalizeAssistantContent(payload);

  onText(assistantId, text);

  return text;
};

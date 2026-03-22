import { homedir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/constants/models";
import {
  buildRequestBody,
  createMiMoRequest,
  readJsonResponse,
  readTtsJsonResponse,
  readTtsStreamResponse,
  readStreamResponse,
} from "@/lib/mimo-api";

describe("mimo-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("builds the request body for text models with persisted context", () => {
    const body = buildRequestBody(
      [{ content: "previous", role: "user" }],
      "current",
      DEFAULT_SETTINGS,
      "USER: previous",
    ) as {
      messages: Array<{ content: string; role: string }>;
      response_format?: { type: string };
    };

    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[0]?.content).toContain(
      "Persisted conversation context",
    );
    expect(body.messages[body.messages.length - 1]).toEqual({
      content: "current",
      role: "user",
    });
    expect(body.response_format).toBeUndefined();
  });

  it("builds the request body for tts models", () => {
    const body = buildRequestBody([], "speak", {
      ...DEFAULT_SETTINGS,
      model: "mimo-v2-tts",
      responseFormat: "wav",
      stream: false,
      voice: "default_en",
    }) as {
      audio?: { format: string; voice: string };
      messages: Array<{ content: string; role: string }>;
    };

    expect(body.messages).toEqual([{ content: "speak", role: "assistant" }]);
    expect(body.audio).toEqual({ format: "wav", voice: "default_en" });
  });

  it("builds response_format for json output and pcm16 for streaming tts", () => {
    const jsonBody = buildRequestBody([], "current", {
      ...DEFAULT_SETTINGS,
      responseFormat: "json_object",
    }) as {
      response_format?: { type: string };
    };

    const ttsBody = buildRequestBody([], "speak", {
      ...DEFAULT_SETTINGS,
      model: "mimo-v2-tts",
      responseFormat: "mp3",
      stream: true,
      voice: "default_zh",
    }) as {
      audio?: { format: string; voice: string };
    };

    expect(jsonBody.response_format).toEqual({ type: "json_object" });
    expect(ttsBody.audio).toEqual({ format: "pcm16", voice: "default_zh" });
  });

  it("passes headers and payload to fetch when creating requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const signal = new AbortController().signal;

    await createMiMoRequest({ ok: true }, "secret-key", signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.xiaomimimo.com/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({ ok: true }),
        headers: {
          "api-key": "secret-key",
          "content-type": "application/json",
        },
        method: "POST",
        signal,
      }),
    );
  });

  it("normalizes JSON responses with array content", async () => {
    const onText = vi.fn();

    const response = new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: [{ text: "hello " }, {}, { text: "world" }],
            },
          },
        ],
      }),
    );

    await expect(readJsonResponse(response, 7, onText)).resolves.toBe(
      "hello world",
    );

    expect(onText).toHaveBeenCalledWith(7, "hello world");
  });

  it("handles string and error JSON responses", async () => {
    const onText = vi.fn();

    await expect(
      readJsonResponse(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "plain text" } }],
          }),
        ),
        7,
        onText,
      ),
    ).resolves.toBe("plain text");

    await expect(
      readJsonResponse(
        new Response(JSON.stringify({ error: { message: "bad response" } })),
        7,
        onText,
      ),
    ).rejects.toThrow("bad response");
  });

  it("normalizes empty JSON responses to an empty string", async () => {
    const onText = vi.fn();

    await expect(
      readJsonResponse(
        new Response(JSON.stringify({ choices: [{ message: {} }] })),
        9,
        onText,
      ),
    ).resolves.toBe("");
    expect(onText).toHaveBeenCalledWith(9, "");
  });

  it("streams SSE text chunks and flushes the final content", async () => {
    const encoder = new TextEncoder();

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"world\\n"}}]}\n\n',
            ),
          );
          controller.close();
        },
      }),
    );

    const onFirstChunk = vi.fn();
    const onText = vi.fn();

    const text = await readStreamResponse({
      assistantId: 3,
      onFirstChunk,
      onText,
      response,
      signal: new AbortController().signal,
    });

    expect(text).toBe("Hello world\n");
    expect(onFirstChunk).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenLastCalledWith(3, "Hello world\n");
  });

  it("rejects invalid streaming text responses", async () => {
    const onFirstChunk = vi.fn();
    const onText = vi.fn();

    await expect(
      readStreamResponse({
        assistantId: 1,
        onFirstChunk,
        onText,
        response: new Response(null),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("MiMo response body is empty");

    const errorResponse = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"error":{"message":"stream failed"}}\n\n',
            ),
          );
          controller.close();
        },
      }),
    );

    await expect(
      readStreamResponse({
        assistantId: 1,
        onFirstChunk,
        onText,
        response: errorResponse,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("stream failed");
  });

  it("aborts streaming text responses when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      readStreamResponse({
        assistantId: 1,
        onFirstChunk: vi.fn(),
        onText: vi.fn(),
        response: new Response(
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        ),
        signal: controller.signal,
      }),
    ).rejects.toThrow("Response aborted");
  });

  it("ignores empty stream events and flushes the final text at the end", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: ping\n\n"));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{}}]}\n\n'),
          );
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
            ),
          );
          controller.close();
        },
      }),
    );

    const onFirstChunk = vi.fn();
    const onText = vi.fn();

    const text = await readStreamResponse({
      assistantId: 5,
      onFirstChunk,
      onText,
      response,
      signal: new AbortController().signal,
    });

    expect(text).toBe("ok");
    expect(onFirstChunk).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith(5, "ok");
  });

  it("writes streamed tts audio to disk", async () => {
    const writeFileSpy = vi.fn().mockResolvedValue(undefined);

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      audio: { data: Buffer.from("abc").toString("base64") },
                    },
                  },
                ],
              })}\n\n`,
            ),
          );
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    );

    const filePath = await readTtsStreamResponse(
      response,
      new AbortController().signal,
      {
        createAudioFilePathFn: () => "/tmp/mimo-tts-stream.wav",
        writeFileFn: writeFileSpy,
      },
    );

    expect(filePath).toBe("/tmp/mimo-tts-stream.wav");
    expect(writeFileSpy).toHaveBeenCalledWith(
      "/tmp/mimo-tts-stream.wav",
      expect.any(Buffer),
    );
  });

  it("uses the default audio path generator for json tts files", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const writeFileSpy = vi.fn().mockResolvedValue(undefined);

    const filePath = await readTtsJsonResponse(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                audio: { data: Buffer.from("abc").toString("base64") },
              },
            },
          ],
        }),
      ),
      "wav",
      {
        writeFileFn: writeFileSpy,
      },
    );

    expect(filePath).toBe(`${homedir()}/mimo-tts-123456.wav`);
    expect(writeFileSpy).toHaveBeenCalledWith(
      `${homedir()}/mimo-tts-123456.wav`,
      expect.any(Buffer),
    );
  });

  it("rejects invalid streamed tts responses", async () => {
    await expect(
      readTtsStreamResponse(new Response(null), new AbortController().signal),
    ).rejects.toThrow("MiMo TTS response body is empty");

    const errorResponse = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"error":{"message":"tts failed"}}\n\n',
            ),
          );
          controller.close();
        },
      }),
    );

    await expect(
      readTtsStreamResponse(errorResponse, new AbortController().signal),
    ).rejects.toThrow("tts failed");
  });

  it("ignores empty tts stream events and aborts when requested", async () => {
    const writeFileSpy = vi.fn().mockResolvedValue(undefined);

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: ping\n\n"));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{}}]}\n\n'),
          );

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      audio: { data: Buffer.from("abc").toString("base64") },
                    },
                  },
                ],
              })}\n\n`,
            ),
          );

          controller.close();
        },
      }),
    );

    const filePath = await readTtsStreamResponse(
      response,
      new AbortController().signal,
      {
        createAudioFilePathFn: () => "/tmp/tts.wav",
        writeFileFn: writeFileSpy,
      },
    );

    expect(filePath).toBe("/tmp/tts.wav");
    expect(writeFileSpy).toHaveBeenCalledWith(
      "/tmp/tts.wav",
      expect.any(Buffer),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      readTtsStreamResponse(
        new Response(
          new ReadableStream({
            start(streamController) {
              streamController.close();
            },
          }),
        ),
        controller.signal,
      ),
    ).rejects.toThrow("Response aborted");
  });

  it("handles stream splits without a trailing block", async () => {
    const originalSplit = String.prototype.split;

    vi.spyOn(String.prototype, "split").mockImplementation(function (
      this: string,
      separator: string | RegExp,
      limit?: number,
    ) {
      if (separator === "\n\n" && String(this) === "force-empty") {
        return [];
      }

      return Reflect.apply(originalSplit, String(this), [
        separator,
        limit,
      ]) as string[];
    } as typeof String.prototype.split);

    const text = await readStreamResponse({
      assistantId: 6,
      onFirstChunk: vi.fn(),
      onText: vi.fn(),
      response: new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("force-empty"));
            controller.close();
          },
        }),
      ),
      signal: new AbortController().signal,
    });

    const writeFileSpy = vi.fn().mockResolvedValue(undefined);

    const filePath = await readTtsStreamResponse(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("force-empty"));
            controller.close();
          },
        }),
      ),
      new AbortController().signal,
      {
        createAudioFilePathFn: () => "/tmp/no-trailing-block.wav",
        writeFileFn: writeFileSpy,
      },
    );

    expect(text).toBe("");
    expect(filePath).toBe("/tmp/no-trailing-block.wav");
    expect(writeFileSpy).toHaveBeenCalledWith(
      "/tmp/no-trailing-block.wav",
      expect.any(Buffer),
    );
  });

  it("writes json tts audio to disk and handles failures", async () => {
    const writeFileSpy = vi.fn().mockResolvedValue(undefined);

    const filePath = await readTtsJsonResponse(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                audio: { data: Buffer.from("abc").toString("base64") },
              },
            },
          ],
        }),
      ),
      "mp3",
      {
        createAudioFilePathFn: () => "/tmp/mimo-tts-json.mp3",
        writeFileFn: writeFileSpy,
      },
    );

    expect(filePath).toBe("/tmp/mimo-tts-json.mp3");
    expect(writeFileSpy).toHaveBeenCalledWith(
      "/tmp/mimo-tts-json.mp3",
      expect.any(Buffer),
    );

    await expect(
      readTtsJsonResponse(
        new Response(JSON.stringify({ error: { message: "json failed" } })),
        "wav",
      ),
    ).rejects.toThrow("json failed");

    await expect(
      readTtsJsonResponse(
        new Response(JSON.stringify({ choices: [{ message: {} }] })),
        "wav",
      ),
    ).rejects.toThrow("MiMo TTS did not return audio data");
  });
});

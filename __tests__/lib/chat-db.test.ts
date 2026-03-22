import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersistedContextRow } from "@/types/mimo";

describe("chat-db", () => {
  let originalCwd = "";
  let tempCwd = "";
  let tempDataHome = "";
  let chatDbModule: typeof import("../../src/lib/chat-db") | null = null;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempCwd = await mkdtemp(join(tmpdir(), "mimo-cwd-"));
    tempDataHome = await mkdtemp(join(tmpdir(), "mimo-data-"));

    vi.resetModules();
    vi.stubEnv("XDG_DATA_HOME", tempDataHome);
  });

  afterEach(async () => {
    chatDbModule?.closeChatDatabase();
    chatDbModule = null;
    process.chdir(originalCwd);

    if (process.platform !== "win32") {
      await chmod(tempCwd, 0o755);
    }

    vi.unstubAllEnvs();
    vi.resetModules();

    await rm(tempCwd, { force: true, recursive: true });
    await rm(tempDataHome, { force: true, recursive: true });
  });

  it("stores the SQLite database in the user data directory instead of cwd", async () => {
    if (process.platform !== "win32") {
      await chmod(tempCwd, 0o555);
    }

    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    const { getMimoDatabasePath } = await import("../../src/config/mimo-paths");

    chatDbModule.initChatDatabase();

    const conversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content: "hello",
      conversationId,
      role: "user",
    });

    expect(chatDbModule.getConversationRows(conversationId)).toHaveLength(1);
    expect(getMimoDatabasePath()).toBe(
      join(tempDataHome, "mimo", "chat_context.db"),
    );
    expect((await stat(getMimoDatabasePath())).isFile()).toBe(true);
  });

  it("returns the latest conversation id and summaries", async () => {
    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    chatDbModule.initChatDatabase();

    const firstConversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content: "first prompt",
      conversationId: firstConversationId,
      role: "user",
    });

    const secondConversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content: "second prompt",
      conversationId: secondConversationId,
      role: "user",
    });

    expect(chatDbModule.getLatestConversationId()).toBe(secondConversationId);
    expect(chatDbModule.getConversationSummaries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: firstConversationId,
          title: "first prompt",
        }),
        expect.objectContaining({
          conversationId: secondConversationId,
          title: "second prompt",
        }),
      ]),
    );
  });

  it("uses fallback titles for empty conversation summaries", async () => {
    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    chatDbModule.initChatDatabase();

    const conversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content: "   ",
      conversationId,
      role: "assistant",
    });

    expect(chatDbModule.getConversationSummaries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId,
          title: "New chat",
        }),
      ]),
    );
  });

  it("increments sequence numbers and truncates long conversation titles", async () => {
    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    chatDbModule.initChatDatabase();

    const conversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content:
        "This is a very long first prompt that should be truncated in the summary title.",
      conversationId,
      role: "user",
    });

    chatDbModule.appendContextMessage({
      content: "follow up",
      conversationId,
      role: "assistant",
    });

    expect(chatDbModule.getConversationRows(conversationId)).toEqual([
      expect.objectContaining({ seq: 1 }),
      expect.objectContaining({ seq: 2 }),
    ]);

    expect(chatDbModule.getConversationSummaries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId,
          title: "This is a very long first prompt ...",
        }),
      ]),
    );
  });

  it("deletes conversations and removes their rows", async () => {
    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    chatDbModule.initChatDatabase();

    const conversationId = chatDbModule.createConversationId();
    chatDbModule.appendContextMessage({
      content: "to delete",
      conversationId,
      role: "user",
    });

    expect(chatDbModule.getConversationRows(conversationId)).toHaveLength(1);
    chatDbModule.deleteConversation(conversationId);
    expect(chatDbModule.getConversationRows(conversationId)).toHaveLength(0);
  });

  it("builds persisted context prompts from the most recent rows", async () => {
    chatDbModule = await import("../../src/lib/chat-db");

    const prompt = chatDbModule.buildPersistedContextPrompt(
      [
        {
          content: "old",
          conversation_id: "chat_1_old",
          created_at: "",
          id: 1,
          role: "user",
          seq: 1,
          tokens: 1,
        },
        {
          content: "new",
          conversation_id: "chat_1_old",
          created_at: "",
          id: 2,
          role: "assistant",
          seq: 2,
          tokens: 1,
        },
      ],
      1,
    );

    expect(prompt).toBe("ASSISTANT: new");
  });

  it("returns an empty prompt when there are no persisted rows", async () => {
    chatDbModule = await import("../../src/lib/chat-db");

    expect(chatDbModule.buildPersistedContextPrompt([])).toBe("");
  });

  it("maps rows to transcript and chat history", async () => {
    chatDbModule = await import("../../src/lib/chat-db");
    const conversationId = "chat_1_rows" as const;

    const rows = [
      {
        content: "system note",
        conversation_id: conversationId,
        created_at: "",
        id: 1,
        role: "system" as const,
        seq: 1,
        tokens: 1,
      },
      {
        content: "meta note",
        conversation_id: conversationId,
        created_at: "",
        id: 2,
        role: "meta" as unknown as "assistant",
        seq: 2,
        tokens: 1,
      },
      {
        content: "assistant note",
        conversation_id: conversationId,
        created_at: "",
        id: 3,
        role: "assistant" as const,
        seq: 3,
        tokens: 1,
      },
      {
        content: "user note",
        conversation_id: conversationId,
        created_at: "",
        id: 4,
        role: "user" as const,
        seq: 4,
        tokens: 1,
      },
    ];

    expect(
      chatDbModule.rowsToTranscript(rows as unknown as PersistedContextRow[]),
    ).toEqual([
      { id: 1, role: "system", text: "system note" },
      { id: 2, role: "meta", text: "meta note" },
      { id: 3, role: "assistant", text: "assistant note" },
      { id: 4, role: "user", text: "user note" },
    ]);
    expect(
      chatDbModule.rowsToChatHistory(rows as unknown as PersistedContextRow[]),
    ).toEqual([
      { content: "system note", role: "system" },
      { content: "assistant note", role: "assistant" },
      { content: "user note", role: "user" },
    ]);
  });

  it("returns null when there is no latest conversation", async () => {
    process.chdir(tempCwd);
    chatDbModule = await import("../../src/lib/chat-db");
    chatDbModule.initChatDatabase();

    expect(chatDbModule.getLatestConversationId()).toBeNull();
  });
});

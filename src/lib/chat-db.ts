import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getMimoDatabasePath } from "@/config/mimo-paths";
import {
  ConversationId,
  ConversationSummary,
  PersistedContextRow,
  Role,
} from "@/types/mimo";

let db: DatabaseSync | null = null;

const getDb = () => {
  if (db) {
    return db;
  }

  const databasePath = getMimoDatabasePath();

  mkdirSync(dirname(databasePath), { recursive: true });
  db = new DatabaseSync(databasePath);

  return db;
};

const estimateTokens = (content: string) =>
  Math.max(1, Math.ceil(content.length / 4));

const toConversationTitle = (content: string) => {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return "New chat";
  }

  return normalized.length > 36 ? `${normalized.slice(0, 33)}...` : normalized;
};

export const initChatDatabase = () => {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT DEFAULT 'default',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER DEFAULT 0,
      seq INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_conv ON context (conversation_id, seq);
  `);
};

export const createConversationId = (): ConversationId =>
  `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const appendContextMessage = ({
  content,
  conversationId,
  role,
}: {
  content: string;
  conversationId: ConversationId;
  role: "assistant" | "system" | "user";
}) => {
  const { nextSeq } = getDb()
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM context WHERE conversation_id = ?",
    )
    .get(conversationId) as { nextSeq: number };

  getDb()
    .prepare(
      `
      INSERT INTO context (conversation_id, role, content, tokens, seq)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(conversationId, role, content, estimateTokens(content), nextSeq);
};

export const deleteConversation = (conversationId: ConversationId) => {
  getDb()
    .prepare(
      `
      DELETE FROM context
      WHERE conversation_id = ?
    `,
    )
    .run(conversationId);
};

export const getConversationRows = (
  conversationId: ConversationId,
  limit = 200,
) =>
  getDb()
    .prepare(
      `
        SELECT id, conversation_id, role, content, tokens, seq, created_at
        FROM context
        WHERE conversation_id = ?
        ORDER BY seq ASC
        LIMIT ?
      `,
    )
    .all(conversationId, limit) as PersistedContextRow[];

export const getLatestConversationId = () =>
  (
    getDb()
      .prepare(
        `
          SELECT conversation_id
          FROM context
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get() as { conversation_id?: ConversationId } | undefined
  )?.conversation_id ?? null;

export const getConversationSummaries = (limit = 12) => {
  const rows = getDb()
    .prepare(
      `
        SELECT
          c.conversation_id AS conversationId,
          COUNT(*) AS messageCount,
          MAX(c.created_at) AS updatedAt,
          COALESCE(
            (
              SELECT content
              FROM context first_user
              WHERE first_user.conversation_id = c.conversation_id
                AND first_user.role = 'user'
              ORDER BY first_user.seq ASC
              LIMIT 1
            ),
            (
              SELECT content
              FROM context first_any
              WHERE first_any.conversation_id = c.conversation_id
              ORDER BY first_any.seq ASC
              LIMIT 1
            ),
            c.conversation_id
          ) AS title
        FROM context c
        GROUP BY c.conversation_id
        ORDER BY updatedAt DESC
        LIMIT ?
      `,
    )
    .all(limit) as Array<{
    conversationId: ConversationId;
    messageCount: number;
    title: string;
    updatedAt: string;
  }>;

  return rows.map((row) => ({
    ...row,
    title: toConversationTitle(row.title),
  })) as ConversationSummary[];
};

export const buildPersistedContextPrompt = (
  rows: PersistedContextRow[],
  limit = 16,
) => {
  const recentRows = rows.slice(-limit);

  if (recentRows.length === 0) {
    return "";
  }

  return recentRows
    .map((row) => `${row.role.toUpperCase()}: ${row.content}`)
    .join("\n");
};

export const rowsToTranscript = (rows: PersistedContextRow[]) =>
  rows.map((row) => ({
    id: row.id,
    role: row.role as Role,
    text: row.content,
  }));

export const rowsToChatHistory = (rows: PersistedContextRow[]) =>
  rows
    .filter(
      (
        row,
      ): row is PersistedContextRow & {
        role: "assistant" | "system" | "user";
      } =>
        row.role === "assistant" ||
        row.role === "system" ||
        row.role === "user",
    )
    .map((row) => ({
      content: row.content,
      role: row.role,
    }));

export const closeChatDatabase = () => {
  db?.close();
  db = null;
};

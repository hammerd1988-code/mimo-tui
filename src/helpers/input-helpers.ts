import { Key } from "ink";

import { ApiKeySetupMessage, FocusTarget } from "@/types/mimo";

export const normalizeInput = (value: string) => value.replace(/\r\n?/g, "\n");

export const isBackspaceKey = (input: string, key: Key) =>
  key.backspace || key.delete || input === "\b" || input === "\x7f";

export const isPlainInput = (input: string, key: Key) =>
  !key.ctrl && !key.meta && !key.escape && input.length > 0;

export const insertAtCursor = (value: string, cursor: number, input: string) =>
  value.slice(0, cursor) + input + value.slice(cursor);

export const removeBeforeCursor = (value: string, cursor: number) =>
  value.slice(0, Math.max(0, cursor - 1)) + value.slice(cursor);

export const removeAtCursor = (value: string, cursor: number) =>
  value.slice(0, cursor) + value.slice(cursor + 1);

export const cycleFocus = (focus: FocusTarget): FocusTarget => {
  const focusOrder: FocusTarget[] = [
    "prompt",
    "settings",
    "history",
    "conversation",
  ];

  const currentIndex = focusOrder.indexOf(focus);

  return focusOrder[(currentIndex + 1) % focusOrder.length];
};

export const createMissingApiKeyMessage = (
  configPath: string,
): ApiKeySetupMessage =>
  `Create ${configPath} or press E to save the API key now.`;

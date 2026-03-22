import { Dispatch, SetStateAction } from "react";
import { useInput, type Key } from "ink";

import {
  createMissingApiKeyMessage,
  cycleFocus,
  insertAtCursor,
  isBackspaceKey,
  isPlainInput,
  normalizeInput,
  removeAtCursor,
  removeBeforeCursor,
} from "@/helpers/input-helpers";
import { AppInputDependencies } from "@/types/app";
import { ApiKeySetupMode, FocusTarget } from "@/types/mimo";

const updateTextValue = ({
  cursor,
  input,
  key,
  onChange,
  onCursorChange,
  value,
}: {
  cursor: number;
  input: string;
  key: Key;
  onChange: Dispatch<SetStateAction<string>>;
  onCursorChange: Dispatch<SetStateAction<number>>;
  value: string;
}) => {
  if (key.leftArrow) {
    onCursorChange((current) => Math.max(current - 1, 0));

    return true;
  }

  if (key.rightArrow) {
    onCursorChange((current) => Math.min(current + 1, value.length));

    return true;
  }

  if (key.home) {
    onCursorChange(0);

    return true;
  }

  if (key.end) {
    onCursorChange(value.length);

    return true;
  }

  if (isBackspaceKey(input, key)) {
    if (cursor === 0) {
      return true;
    }

    onChange((current) => removeBeforeCursor(current, cursor));
    onCursorChange((current) => Math.max(current - 1, 0));

    return true;
  }

  if (key.ctrl && input === "d") {
    if (cursor >= value.length) {
      return true;
    }

    onChange((current) => removeAtCursor(current, cursor));

    return true;
  }

  if (isPlainInput(input, key)) {
    const normalizedInput = normalizeInput(input);

    onChange((current) => insertAtCursor(current, cursor, normalizedInput));
    onCursorChange((current) => current + normalizedInput.length);

    return true;
  }

  return false;
};

export const useAppInput = ({
  abortControllerRef,
  apiKeyInput,
  apiKeyInputCursor,
  apiKeySetupMode,
  changeSetting,
  configPath,
  conversationFocusMode,
  conversationViewportStart,
  copyLastAssistantResponse,
  deleteSelectedConversation,
  displayedConversationSummaries,
  exit,
  focus,
  isLoading,
  loadApiKeyConfiguration,
  loadConversation,
  maxConversationStart,
  nextEntryIdRef,
  prompt,
  promptCursor,
  saveApiKeyAndContinue,
  selectedConversationIndex,
  sendPrompt,
  setApiKeyInput,
  setApiKeyInputCursor,
  setApiKeySetupMessage,
  setApiKeySetupMode,
  setConversationFocusMode,
  setConversationViewportStart,
  setFocus,
  setPrompt,
  setPromptCursor,
  setSelectedConversationIndex,
  setSelectedSetting,
  setStatus,
  setTranscript,
  settingKeys,
  startNewChat,
}: AppInputDependencies) => {
  const handleGlobalInterrupt = (input: string, key: Key) => {
    if (!(key.ctrl && input === "c")) {
      return false;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();

      return true;
    }

    exit();

    return true;
  };

  const handleApiKeyEntering = (input: string, key: Key) => {
    if (key.escape) {
      setApiKeyInput("");
      setApiKeyInputCursor(0);
      setApiKeySetupMode("missing");
      setApiKeySetupMessage(createMissingApiKeyMessage(configPath));

      return true;
    }

    if (key.return) {
      void saveApiKeyAndContinue();

      return true;
    }

    return updateTextValue({
      cursor: apiKeyInputCursor,
      input,
      key,
      onChange: setApiKeyInput,
      onCursorChange: setApiKeyInputCursor,
      value: apiKeyInput,
    });
  };

  const handleApiKeyMissing = (input: string, key: Key) => {
    if (!isPlainInput(input, key)) {
      return false;
    }

    const command = input.toLowerCase();

    const handlers: Record<string, () => void> = {
      e: () => {
        setApiKeyInput("");
        setApiKeyInputCursor(0);
        setApiKeySetupMode("entering");
        setApiKeySetupMessage("Type your MiMo API key and press Enter.");
      },
      q: () => {
        exit();
      },
      r: () => {
        void loadApiKeyConfiguration();
      },
    };

    const handler = handlers[command];

    if (!handler) {
      return false;
    }

    handler();

    return true;
  };

  const handleApiKeySetup = (input: string, key: Key) => {
    const currentMode = apiKeySetupMode as Exclude<ApiKeySetupMode, "ready">;

    const apiKeyHandlers: Record<
      Exclude<ApiKeySetupMode, "ready">,
      () => boolean
    > = {
      checking: () => true,
      entering: () => handleApiKeyEntering(input, key),
      missing: () => handleApiKeyMissing(input, key),
    };

    return apiKeyHandlers[currentMode]();
  };

  const handleReadyShortcuts = (input: string, key: Key) => {
    if (key.ctrl && input === "n") {
      if (!isLoading) {
        startNewChat();
      }

      return true;
    }

    if (key.ctrl && input === "f") {
      setConversationFocusMode((current) => !current);
      setFocus("conversation");
      setStatus(
        conversationFocusMode
          ? "Conversation focus mode off"
          : "Conversation focus mode on",
      );

      return true;
    }

    if (key.ctrl && input === "y") {
      if (!isLoading) {
        void copyLastAssistantResponse();
      }

      return true;
    }

    if (key.ctrl && input === "r") {
      if (!isLoading) {
        const id = nextEntryIdRef.current;

        nextEntryIdRef.current += 1;

        setTranscript([{ id, role: "meta", text: "Conversation cleared." }]);
        setConversationViewportStart(null);
        setStatus("Conversation cleared");
      }

      return true;
    }

    if (key.tab) {
      if (conversationFocusMode) {
        setFocus("conversation");
      } else {
        setFocus((current) => cycleFocus(current));
      }

      return true;
    }

    return false;
  };

  const handleConversationInput = (_input: string, key: Key) => {
    if (!(key.upArrow || key.pageUp || key.downArrow || key.pageDown)) {
      return false;
    }

    const step = key.pageUp || key.pageDown ? 8 : 1;

    const currentStart =
      conversationViewportStart === null
        ? maxConversationStart
        : conversationViewportStart;

    if (key.upArrow || key.pageUp) {
      setConversationViewportStart(Math.max(0, currentStart - step));

      return true;
    }

    const nextStart = Math.min(maxConversationStart, currentStart + step);

    setConversationViewportStart(
      nextStart >= maxConversationStart ? null : nextStart,
    );

    return true;
  };

  const handlePromptInput = (input: string, key: Key) => {
    if (key.ctrl && input === "j") {
      setPrompt((value) => insertAtCursor(value, promptCursor, "\n"));
      setPromptCursor((current) => current + 1);

      return true;
    }

    if (key.return) {
      void sendPrompt();

      return true;
    }

    return updateTextValue({
      cursor: promptCursor,
      input,
      key,
      onChange: setPrompt,
      onCursorChange: setPromptCursor,
      value: prompt,
    });
  };

  const handleSettingsInput = (_input: string, key: Key) => {
    if (key.upArrow) {
      setSelectedSetting(
        (current) => (current - 1 + settingKeys.length) % settingKeys.length,
      );

      return true;
    }

    if (key.downArrow) {
      setSelectedSetting((current) => (current + 1) % settingKeys.length);

      return true;
    }

    if (key.leftArrow) {
      changeSetting(-1);

      return true;
    }

    if (key.rightArrow) {
      changeSetting(1);

      return true;
    }

    return false;
  };

  const handleHistoryInput = (_input: string, key: Key) => {
    if (displayedConversationSummaries.length === 0) {
      return false;
    }

    if (key.upArrow) {
      setSelectedConversationIndex(
        (current) =>
          (current - 1 + displayedConversationSummaries.length) %
          displayedConversationSummaries.length,
      );

      return true;
    }

    if (key.downArrow) {
      setSelectedConversationIndex(
        (current) => (current + 1) % displayedConversationSummaries.length,
      );

      return true;
    }

    if (key.return) {
      const targetConversation =
        displayedConversationSummaries[selectedConversationIndex];

      if (targetConversation) {
        loadConversation(targetConversation.conversationId);
      }

      return true;
    }

    if (key.ctrl && key.delete) {
      deleteSelectedConversation();

      return true;
    }

    return false;
  };

  useInput((input, key) => {
    if (handleGlobalInterrupt(input, key)) {
      return;
    }

    if (apiKeySetupMode !== "ready") {
      handleApiKeySetup(input, key);

      return;
    }

    if (handleReadyShortcuts(input, key)) {
      return;
    }

    const focusHandlers: Record<
      FocusTarget,
      (input: string, key: Key) => boolean
    > = {
      conversation: handleConversationInput,
      history: handleHistoryInput,
      prompt: handlePromptInput,
      settings: handleSettingsInput,
    };

    focusHandlers[focus](input, key);
  });
};

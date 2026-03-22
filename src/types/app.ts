import { Dispatch, SetStateAction } from "react";

import {
  ApiKeySetupMessage,
  ApiKeySetupMode,
  AppStatus,
  ConversationId,
  ConversationSummary,
  FocusTarget,
  ModelId,
  Settings,
  TranscriptEntry,
} from "@/types/mimo";

export type SettingKey =
  | "model"
  | "thinking"
  | "stream"
  | "responseFormat"
  | "voice"
  | "temperature"
  | "topP"
  | "maxCompletionTokens"
  | "frequencyPenalty"
  | "presencePenalty";

export type SettingsRef = {
  current: Settings;
};

export type ChangeSettingContext = {
  applyModelDefaults: (model: ModelId) => void;
  direction: 1 | -1;
  setSettings: Dispatch<SetStateAction<Settings>>;
  settingsRef: SettingsRef;
};

export type AppInputDependencies = {
  abortControllerRef: { current: AbortController | null };
  apiKeyInput: string;
  apiKeyInputCursor: number;
  apiKeySetupMode: ApiKeySetupMode;
  changeSetting: (direction: 1 | -1) => void;
  configPath: string;
  conversationFocusMode: boolean;
  conversationViewportStart: number | null;
  copyLastAssistantResponse: () => Promise<void>;
  deleteSelectedConversation: () => void;
  displayedConversationSummaries: ConversationSummary[];
  exit: () => void;
  focus: FocusTarget;
  isLoading: boolean;
  loadApiKeyConfiguration: () => Promise<void>;
  loadConversation: (conversationId: ConversationId) => void;
  maxConversationStart: number;
  nextEntryIdRef: { current: number };
  prompt: string;
  promptCursor: number;
  saveApiKeyAndContinue: () => Promise<void>;
  selectedConversationIndex: number;
  sendPrompt: () => Promise<void>;
  setApiKeyInput: Dispatch<SetStateAction<string>>;
  setApiKeyInputCursor: Dispatch<SetStateAction<number>>;
  setApiKeySetupMessage: Dispatch<SetStateAction<ApiKeySetupMessage>>;
  setApiKeySetupMode: Dispatch<SetStateAction<ApiKeySetupMode>>;
  setConversationFocusMode: Dispatch<SetStateAction<boolean>>;
  setConversationViewportStart: Dispatch<SetStateAction<number | null>>;
  setFocus: Dispatch<SetStateAction<FocusTarget>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setPromptCursor: Dispatch<SetStateAction<number>>;
  setSelectedConversationIndex: Dispatch<SetStateAction<number>>;
  setSelectedSetting: Dispatch<SetStateAction<number>>;
  setStatus: Dispatch<SetStateAction<AppStatus>>;
  setTranscript: Dispatch<SetStateAction<TranscriptEntry[]>>;
  settingKeys: readonly string[];
  startNewChat: () => void;
};

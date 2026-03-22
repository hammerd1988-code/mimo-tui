import { useEffect, useMemo, useRef, useState } from "react";
import clipboard from "clipboardy";
import { Box, useApp, useStdout } from "ink";

import {
  loadConfiguredApiKey,
  MIMO_CONFIG_PATH,
  saveApiKeyConfig,
} from "@/config/mimo-config";
import { MIMO_CONFIG_EXAMPLE } from "@/constants/config";
import {
  CHAT_MODELS,
  createDefaultSettings,
  DEFAULT_SETTINGS,
  TEXT_SETTING_KEYS,
  TTS_SETTING_KEYS,
} from "@/constants/models";
import { ConfigSetupScreen } from "@/components/ConfigSetupScreen";
import { ConversationPanel } from "@/components/ConversationPanel";
import { HeaderBar } from "@/components/HeaderBar";
import { PromptPanel } from "@/components/PromptPanel";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { Spinner } from "@/components/Spinner";
import {
  APP_BACKGROUND_COLOR,
  CONVERSATION_PANEL_WIDTH_RATIO,
  CONVERSATION_HEIGHT,
  CONVERSATION_HELP_TEXT,
  CONVERSATION_STATIC_LINES,
  VISIBLE_HISTORY_ITEMS,
} from "@/constants/ui";
import { clamp, formatNumber, toTitleCase, wrapText } from "@/helpers/format";
import {
  createConversationRows,
  createEmptyConversationRows,
} from "@/helpers/conversation-renderer";
import {
  appendContextMessage,
  buildPersistedContextPrompt,
  createConversationId,
  deleteConversation,
  getConversationRows,
  getConversationSummaries,
  getLatestConversationId,
  initChatDatabase,
  rowsToChatHistory,
  rowsToTranscript,
} from "@/lib/chat-db";
import {
  buildRequestBody,
  createMiMoRequest,
  readJsonResponse,
  readStreamResponse,
  readTtsJsonResponse,
  readTtsStreamResponse,
} from "@/lib/mimo-api";
import { normalizeInput } from "@/helpers/input-helpers";
import { changeSettingValue } from "@/helpers/settings-actions";
import { useAppInput } from "@/hooks/use-app-input";
import {
  ApiKeySetupMessage,
  ApiKeySetupMode,
  AppStatus,
  ChatHistoryMessage,
  ConversationId,
  ConversationSummary,
  ConversationRow,
  FocusTarget,
  ModelId,
  Role,
  Settings,
  TranscriptEntry,
} from "@/types/mimo";

export const App = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeySetupMode, setApiKeySetupMode] =
    useState<ApiKeySetupMode>("checking");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyInputCursor, setApiKeyInputCursor] = useState(0);
  const [apiKeySetupMessage, setApiKeySetupMessage] =
    useState<ApiKeySetupMessage>("Checking MiMo API key configuration...");
  const [isChatBootstrapped, setIsChatBootstrapped] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [conversationFocusMode, setConversationFocusMode] = useState(false);
  const [focus, setFocus] = useState<FocusTarget>("prompt");
  const [prompt, setPrompt] = useState<string>("");
  const [promptCursor, setPromptCursor] = useState(0);
  const [selectedSetting, setSelectedSetting] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<AppStatus>("Ready");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [conversationId, setConversationId] = useState<ConversationId | null>(
    null,
  );
  const [conversationSummaries, setConversationSummaries] = useState<
    ConversationSummary[]
  >([]);
  const [persistedContextPrompt, setPersistedContextPrompt] =
    useState<string>("");
  const [conversationViewportStart, setConversationViewportStart] = useState<
    number | null
  >(null);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const historyRef = useRef<ChatHistoryMessage[]>([]);
  const nextEntryIdRef = useRef(2);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setPromptCursor((current) => Math.min(current, prompt.length));
  }, [prompt]);

  useEffect(() => {
    setApiKeyInputCursor((current) => Math.min(current, apiKeyInput.length));
  }, [apiKeyInput]);

  const loadApiKeyConfiguration = async () => {
    setApiKeySetupMode("checking");

    const configResult = await loadConfiguredApiKey();

    if (configResult.status === "ready") {
      setApiKey(configResult.apiKey);
      setApiKeySetupMode("ready");
      setApiKeySetupMessage(
        configResult.source === "env"
          ? "Using MIMO_API_KEY from the environment."
          : `Using config file at ${configResult.path}.`,
      );

      return;
    }

    setApiKey(null);
    setApiKeySetupMode("missing");
    setApiKeySetupMessage(
      `${configResult.message} Create ${configResult.path} or press E to save the API key now.`,
    );
  };

  const saveApiKeyAndContinue = async () => {
    const normalizedApiKey = apiKeyInput.trim();

    if (!normalizedApiKey) {
      setApiKeySetupMessage("API key cannot be empty.");

      return;
    }

    try {
      const savedConfigPath = await saveApiKeyConfig(normalizedApiKey);

      setApiKeyInput("");
      setApiKeyInputCursor(0);
      setApiKeySetupMessage(`Config saved to ${savedConfigPath}. Loading...`);

      await loadApiKeyConfiguration();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";

      setApiKeySetupMode("entering");
      setApiKeySetupMessage(`Failed to save config: ${errorMessage}`);
    }
  };

  useEffect(() => {
    void loadApiKeyConfiguration();
  }, []);

  useEffect(() => {
    if (!apiKey || isChatBootstrapped) {
      return;
    }

    initChatDatabase();

    const latestConversationId = getLatestConversationId();

    if (latestConversationId) {
      const rows = getConversationRows(latestConversationId);

      setConversationId(latestConversationId);
      setTranscript(rowsToTranscript(rows));

      historyRef.current = rowsToChatHistory(rows);

      setPersistedContextPrompt(buildPersistedContextPrompt(rows));

      nextEntryIdRef.current =
        rows.length > 0 ? Math.max(...rows.map((row) => row.id)) + 1 : 2;
    } else {
      const newConversationId = createConversationId();

      setConversationId(newConversationId);

      historyRef.current = [];

      setPersistedContextPrompt("");

      nextEntryIdRef.current = 2;
    }

    setConversationSummaries(getConversationSummaries());
    setIsChatBootstrapped(true);
  }, [apiKey, isChatBootstrapped]);

  const selectedModelProfile = CHAT_MODELS[settings.model];
  const isTtsModel = settings.model === "mimo-v2-tts";
  const settingKeys = isTtsModel ? TTS_SETTING_KEYS : TEXT_SETTING_KEYS;

  const promptPlaceholder = isTtsModel
    ? "Type the text to convert to speech"
    : "Type your prompt";

  const promptLineCount = Math.max(
    1,
    normalizeInput(prompt).split("\n").length,
  );

  useEffect(() => {
    setSelectedSetting((current) => Math.min(current, settingKeys.length - 1));
  }, [settingKeys.length]);

  const conversationPanelWidthRatio = conversationFocusMode
    ? 1
    : CONVERSATION_PANEL_WIDTH_RATIO;

  const conversationContentWidth = Math.max(
    32,
    Math.floor((stdout?.columns ?? 120) * conversationPanelWidthRatio) - 8,
  );

  const conversationHelpLines = useMemo(
    () => wrapText(CONVERSATION_HELP_TEXT, conversationContentWidth),
    [conversationContentWidth],
  );

  const conversationRows = useMemo<ConversationRow[]>(() => {
    return transcript.flatMap((entry) =>
      createConversationRows({
        entry,
        isLoading,
        width: conversationContentWidth,
      }),
    );
  }, [conversationContentWidth, isLoading, transcript]);

  const visibleConversationLines = Math.max(
    8,
    CONVERSATION_HEIGHT -
      2 -
      (CONVERSATION_STATIC_LINES + conversationHelpLines.length),
  );

  const maxConversationStart = Math.max(
    0,
    conversationRows.length - visibleConversationLines,
  );

  const clampedConversationStart =
    conversationViewportStart === null
      ? maxConversationStart
      : clamp(conversationViewportStart, 0, maxConversationStart);

  const clampedConversationEnd = Math.min(
    conversationRows.length,
    clampedConversationStart + visibleConversationLines,
  );

  const visibleConversationRows = useMemo(
    () =>
      conversationRows.slice(clampedConversationStart, clampedConversationEnd),
    [clampedConversationEnd, clampedConversationStart, conversationRows],
  );

  const paddedConversationRows = useMemo(() => {
    const missingRows = Math.max(
      0,
      visibleConversationLines - visibleConversationRows.length,
    );

    return [
      ...visibleConversationRows,
      ...createEmptyConversationRows(missingRows, conversationContentWidth),
    ];
  }, [
    conversationContentWidth,
    visibleConversationLines,
    visibleConversationRows,
  ]);

  const settingItems = useMemo(
    () =>
      isTtsModel
        ? [
            `Model: ${settings.model}`,
            `Stream: ${settings.stream ? "on" : "off"}`,
            `Response Format: ${settings.responseFormat}`,
            `Voice: ${settings.voice}`,
            `Max Tokens: ${settings.maxCompletionTokens}`,
          ]
        : [
            `Model: ${settings.model}`,
            `Thinking: ${settings.thinking}`,
            `Stream: ${settings.stream ? "on" : "off"}`,
            `Response Format: ${settings.responseFormat}`,
            `Temperature: ${formatNumber(settings.temperature)}`,
            `Top P: ${formatNumber(settings.topP)}`,
            `Max Tokens: ${settings.maxCompletionTokens}`,
            `Frequency Penalty: ${formatNumber(settings.frequencyPenalty)}`,
            `Presence Penalty: ${formatNumber(settings.presencePenalty)}`,
          ],
    [isTtsModel, settings],
  );

  const settingsLineWidth = useMemo(
    () => Math.max(...settingItems.map((item) => item.length)) + 2,
    [settingItems],
  );

  const displayedConversationSummaries = useMemo(() => {
    if (!conversationId) {
      return conversationSummaries;
    }

    if (
      conversationSummaries.some(
        (summary) => summary.conversationId === conversationId,
      )
    ) {
      return conversationSummaries;
    }

    return [
      {
        conversationId,
        messageCount: 0,
        title: "New chat",
        updatedAt: new Date().toISOString(),
      },
      ...conversationSummaries,
    ];
  }, [conversationId, conversationSummaries]);

  const historyWindowStart = useMemo(() => {
    const maxStart = Math.max(
      0,
      displayedConversationSummaries.length - VISIBLE_HISTORY_ITEMS,
    );

    if (selectedConversationIndex < VISIBLE_HISTORY_ITEMS) {
      return 0;
    }

    if (selectedConversationIndex >= maxStart) {
      return maxStart;
    }

    return selectedConversationIndex - (VISIBLE_HISTORY_ITEMS - 1);
  }, [displayedConversationSummaries.length, selectedConversationIndex]);

  const visibleHistoryItems = useMemo(
    () =>
      displayedConversationSummaries.slice(
        historyWindowStart,
        historyWindowStart + VISIBLE_HISTORY_ITEMS,
      ),
    [displayedConversationSummaries, historyWindowStart],
  );

  const showHistoryMoreAbove = historyWindowStart > 0;

  const showHistoryMoreBelow =
    historyWindowStart + VISIBLE_HISTORY_ITEMS <
    displayedConversationSummaries.length;

  const refreshConversationSummaries = () => {
    setConversationSummaries(getConversationSummaries());
  };

  const copyLastAssistantResponse = async () => {
    const lastAssistantEntry = [...transcript]
      .reverse()
      .find(
        (entry) => entry.role === "assistant" && entry.text.trim().length > 0,
      );

    if (!lastAssistantEntry) {
      setStatus("Nothing to copy");

      return;
    }

    try {
      await clipboard.write(lastAssistantEntry.text);

      setStatus("Last response copied");
    } catch {
      setStatus("Copy failed");
    }
  };

  const loadConversation = (
    targetConversationId: ConversationId,
    nextFocus: FocusTarget = "prompt",
  ) => {
    const rows = getConversationRows(targetConversationId);

    setConversationId(targetConversationId);
    setFocus(nextFocus);
    setTranscript(rowsToTranscript(rows));

    historyRef.current = rowsToChatHistory(rows);

    setPersistedContextPrompt(buildPersistedContextPrompt(rows));
    setConversationViewportStart(null);
    setPrompt("");
    setPromptCursor(0);
    setIsLoading(false);
    setStatus("Chat loaded");

    nextEntryIdRef.current =
      rows.length > 0 ? Math.max(...rows.map((row) => row.id)) + 1 : 2;
  };

  const deleteSelectedConversation = () => {
    const targetConversation =
      displayedConversationSummaries[selectedConversationIndex];

    if (!targetConversation) {
      return;
    }

    deleteConversation(targetConversation.conversationId);

    const nextConversationSummaries = getConversationSummaries();

    const nextSelectedIndex = Math.min(
      selectedConversationIndex,
      Math.max(0, nextConversationSummaries.length - 1),
    );

    setConversationSummaries(nextConversationSummaries);
    setSelectedConversationIndex(nextSelectedIndex);
    setFocus("history");
    setStatus("Chat deleted");

    if (targetConversation.conversationId === conversationId) {
      const nextConversation = nextConversationSummaries[nextSelectedIndex];

      if (nextConversation) {
        loadConversation(nextConversation.conversationId, "history");
      } else {
        startNewChat("history");
      }
    }
  };

  const startNewChat = (nextFocus: FocusTarget = "prompt") => {
    const newConversationId = createConversationId();

    setConversationId(newConversationId);
    setFocus(nextFocus);
    setTranscript([]);

    historyRef.current = [];

    setPersistedContextPrompt("");
    setConversationViewportStart(null);
    setPrompt("");
    setPromptCursor(0);
    setSelectedConversationIndex(0);
    setStatus("New chat");

    nextEntryIdRef.current = 2;

    refreshConversationSummaries();
  };

  const addTranscriptEntry = (role: Role, text: string) => {
    const id = nextEntryIdRef.current;
    nextEntryIdRef.current += 1;

    setTranscript((current) => [...current, { id, role, text }]);

    return id;
  };

  const updateTranscriptEntry = (id: number, text: string) => {
    setTranscript((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, text } : entry)),
    );
  };

  const removeTranscriptEntry = (id: number) => {
    setTranscript((current) => current.filter((entry) => entry.id !== id));
  };

  const sendPrompt = async () => {
    const currentPrompt = prompt.trim();

    if (!currentPrompt || isLoading || !apiKey) {
      return;
    }

    if (["exit", "quit"].includes(currentPrompt.toLowerCase())) {
      exit();

      return;
    }

    const activeSettings = settingsRef.current;
    const isTtsMode = activeSettings.model === "mimo-v2-tts";

    const userHistoryEntry: ChatHistoryMessage = {
      content: currentPrompt,
      role: "user",
    };

    const nextUserId = nextEntryIdRef.current;
    const nextAssistantId = nextUserId + 1;

    const projectedRows = [
      ...conversationRows,
      ...createConversationRows({
        entry: {
          id: nextUserId,
          role: "user",
          text: currentPrompt,
        },
        isLoading: false,
        width: conversationContentWidth,
      }),
      ...createConversationRows({
        entry: {
          id: nextAssistantId,
          role: "assistant",
          text: "",
        },
        isLoading: false,
        width: conversationContentWidth,
      }),
    ];

    const nextViewportStart = Math.max(
      0,
      projectedRows.length - visibleConversationLines,
    );

    const userId = addTranscriptEntry("user", currentPrompt);
    const assistantId = addTranscriptEntry("assistant", "");

    const initialStatus =
      isTtsMode || activeSettings.thinking === "disabled"
        ? "Waiting"
        : "Thinking";

    setPrompt("");
    setPromptCursor(0);
    setIsLoading(true);
    setStatus(initialStatus);
    setConversationViewportStart(nextViewportStart);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await createMiMoRequest(
        buildRequestBody(
          historyRef.current,
          currentPrompt,
          activeSettings,
          persistedContextPrompt,
        ),
        apiKey,
        abortController.signal,
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `MiMo request failed (${response.status}): ${errorText}`,
        );
      }

      if (isTtsMode) {
        const filePath = activeSettings.stream
          ? await readTtsStreamResponse(response, abortController.signal)
          : await readTtsJsonResponse(
              response,
              activeSettings.responseFormat === "mp3" ? "mp3" : "wav",
            );

        const audioSavedMessage = `TTS output saved to ${filePath}\nCtrl+Click to play audio`;

        updateTranscriptEntry(assistantId, audioSavedMessage);
        setFocus("conversation");
        setStatus("Audio saved");

        return;
      }

      const text = activeSettings.stream
        ? await readStreamResponse({
            response,
            assistantId,
            signal: abortController.signal,
            onFirstChunk: () => {
              setFocus("conversation");
              setStatus("Responding");
            },
            onText: updateTranscriptEntry,
          })
        : await readJsonResponse(response, assistantId, updateTranscriptEntry);

      historyRef.current = [
        ...historyRef.current,
        userHistoryEntry,
        {
          content: text || "[Empty response]",
          role: "assistant",
        },
      ];

      if (!text) {
        updateTranscriptEntry(assistantId, "[Empty response]");
      }

      if (!conversationId) {
        throw new Error("Missing conversation id");
      }

      appendContextMessage({
        content: currentPrompt,
        conversationId,
        role: "user",
      });

      appendContextMessage({
        content: text || "[Empty response]",
        conversationId,
        role: "assistant",
      });

      refreshConversationSummaries();

      setFocus("conversation");
      setStatus("Ready");
    } catch (error) {
      const aborted =
        error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error && error.name === "AbortError";

      removeTranscriptEntry(userId);
      removeTranscriptEntry(assistantId);

      if (aborted) {
        addTranscriptEntry("meta", "Response aborted.");
        setStatus("Response aborted");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        addTranscriptEntry("meta", errorMessage);
        setStatus("Request failed");
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const applyModelDefaults = (model: ModelId) => {
    const profile = CHAT_MODELS[model];
    const defaults = createDefaultSettings(model);

    const shouldStartNewChat =
      model === "mimo-v2-tts" && settingsRef.current.model !== "mimo-v2-tts";

    setSettings((current) => ({
      ...current,
      maxCompletionTokens: profile.defaultMaxCompletionTokens,
      model,
      responseFormat:
        model === "mimo-v2-tts"
          ? defaults.responseFormat
          : current.responseFormat === "text" ||
              current.responseFormat === "json_object"
            ? current.responseFormat
            : "text",
      stream: model === "mimo-v2-tts" ? defaults.stream : true,
      temperature: profile.defaultTemperature,
      thinking: profile.defaultThinking,
      topP: profile.defaultTopP,
      voice: model === "mimo-v2-tts" ? defaults.voice : current.voice,
    }));

    if (shouldStartNewChat) {
      startNewChat("settings");
    }
  };

  const changeSetting = (direction: 1 | -1) => {
    changeSettingValue(settingKeys[selectedSetting], {
      applyModelDefaults,
      direction,
      setSettings,
      settingsRef,
    });
  };

  useAppInput({
    abortControllerRef,
    apiKeyInput,
    apiKeyInputCursor,
    apiKeySetupMode,
    changeSetting,
    configPath: MIMO_CONFIG_PATH,
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
  });

  if (apiKeySetupMode !== "ready") {
    return (
      <Box backgroundColor={APP_BACKGROUND_COLOR} flexDirection="column">
        <HeaderBar
          focusLabel="Setup"
          helpText="Setup | E enter key | R reload | Q quit | Ctrl+C exit"
        />

        <ConfigSetupScreen
          configMessage={apiKeySetupMessage}
          configPath={MIMO_CONFIG_PATH}
          exampleJson={MIMO_CONFIG_EXAMPLE}
          inputMode={apiKeySetupMode === "entering"}
          keyInput={apiKeyInput}
          keyInputCursor={apiKeyInputCursor}
        />
      </Box>
    );
  }

  return (
    <Box backgroundColor={APP_BACKGROUND_COLOR} flexDirection="column">
      <HeaderBar focusLabel={toTitleCase(focus)} />

      <Box backgroundColor={APP_BACKGROUND_COLOR} width="100%">
        <ConversationPanel
          focused={focus === "conversation"}
          fullWidth={conversationFocusMode}
          helpLines={conversationHelpLines}
          hideChrome={conversationFocusMode}
          rows={paddedConversationRows}
          showMoreAbove={clampedConversationStart > 0}
          showMoreBelow={clampedConversationEnd < conversationRows.length}
          visibleConversationLines={visibleConversationLines}
        />

        {!conversationFocusMode ? (
          <>
            <Box backgroundColor={APP_BACKGROUND_COLOR} width={0} />

            <SettingsSidebar
              currentConversationId={conversationId}
              focused={focus === "settings"}
              historyFocused={focus === "history"}
              historyItems={visibleHistoryItems}
              historyOffset={historyWindowStart}
              showHistoryMoreAbove={showHistoryMoreAbove}
              showHistoryMoreBelow={showHistoryMoreBelow}
              selectedConversationIndex={selectedConversationIndex}
              selectedModelProfile={selectedModelProfile}
              selectedSetting={selectedSetting}
              settingItems={settingItems}
              settingsLineWidth={settingsLineWidth}
            />
          </>
        ) : null}
      </Box>

      <PromptPanel
        focus={focus}
        placeholder={promptPlaceholder}
        prompt={prompt}
        promptLineCount={promptLineCount}
        promptCursor={promptCursor}
      />

      <Box backgroundColor={APP_BACKGROUND_COLOR} marginTop={1}>
        <Spinner active={isLoading} label={status === "Ready" ? "" : status} />
      </Box>
    </Box>
  );
};

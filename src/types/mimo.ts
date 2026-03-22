export type ModelId =
  | "mimo-v2-flash"
  | "mimo-v2-omni"
  | "mimo-v2-pro"
  | "mimo-v2-tts";

export type ThinkingMode = "disabled" | "enabled";

export type TextResponseFormatType = "json_object" | "text";

export type TtsResponseFormatType = "mp3" | "pcm16" | "wav";

export type ResponseFormatType = TextResponseFormatType | TtsResponseFormatType;

export type TtsVoice = "default_en" | "default_zh" | "mimo_default";

export type Role = "assistant" | "meta" | "system" | "user";

export type FocusTarget = "conversation" | "history" | "prompt" | "settings";

export type ConversationId = `chat_${number}_${string}`;

export type ApiKeySetupMode = "checking" | "entering" | "missing" | "ready";

export type ApiKeySetupMessage =
  | "API key cannot be empty."
  | "Checking MiMo API key configuration..."
  | "Type your MiMo API key and press Enter."
  | "Using MIMO_API_KEY from the environment."
  | `Config saved to ${string}. Loading...`
  | `Create ${string} or press E to save the API key now.`
  | `Failed to save config: ${string}`
  | `Using config file at ${string}.`
  | `${string} Create ${string} or press E to save the API key now.`;

export type AppStatus =
  | "Audio saved"
  | "Chat deleted"
  | "Chat loaded"
  | "Conversation cleared"
  | "Conversation focus mode off"
  | "Conversation focus mode on"
  | "Copy failed"
  | "Last response copied"
  | "New chat"
  | "Nothing to copy"
  | "Ready"
  | "Request failed"
  | "Responding"
  | "Response aborted"
  | "Thinking"
  | "Waiting";

export type ChatHistoryMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type TranscriptEntry = {
  id: number;
  role: Role;
  text: string;
};

export type PersistedContextRow = {
  content: string;
  conversation_id: ConversationId;
  created_at: string;
  id: number;
  role: "assistant" | "system" | "user";
  seq: number;
  tokens: number;
};

export type ConversationSummary = {
  conversationId: ConversationId;
  messageCount: number;
  title: string;
  updatedAt: string;
};

export type ConversationSegment = {
  backgroundColor?: string;
  bold?: boolean;
  color?: string;
  href?: string;
  text: string;
  underline?: boolean;
};

export type ConversationRow = {
  key: string;
  segments: ConversationSegment[];
};

export type Settings = {
  frequencyPenalty: number;
  maxCompletionTokens: number;
  model: ModelId;
  presencePenalty: number;
  responseFormat: ResponseFormatType;
  stream: boolean;
  systemPrompt: string;
  temperature: number;
  thinking: ThinkingMode;
  topP: number;
  voice: TtsVoice;
};

export type OpenAIResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
      };
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string;
      };
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type ModelProfile = {
  category: string;
  contextLength: string;
  defaultMaxCompletionTokens: number;
  defaultTemperature: number;
  defaultThinking: ThinkingMode;
  defaultTopP: number;
  features: string[];
  maxOutput: string;
};

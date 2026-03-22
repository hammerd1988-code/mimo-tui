export const APP_BACKGROUND_COLOR = "#000";
export const CONVERSATION_HEIGHT = 38;
export const CONVERSATION_STATIC_LINES = 4;
export const VISIBLE_HISTORY_ITEMS = 5;
export const SIDEBAR_WIDTH_RATIO = 0.23;
export const CONVERSATION_PANEL_WIDTH_RATIO = 1 - SIDEBAR_WIDTH_RATIO;
export const SIDEBAR_WIDTH_PERCENT = `${SIDEBAR_WIDTH_RATIO * 100}%`;
export const CONVERSATION_PANEL_WIDTH_PERCENT = `${CONVERSATION_PANEL_WIDTH_RATIO * 100}%`;

export const CONVERSATION_HELP_TEXT =
  "Tab to switch focus. Up/Down to scroll. PageUp/PageDown to jump. Ctrl+F to toggle conversation focus mode. Ctrl+Y to copy last message to clipboard. Ctrl+R to clear the conversation. Ctrl+C to abort a response or exit.";

export const DEFAULT_HEADER_HELP_TEXT =
  "Focus: {focusLabel} | Tab switch | Ctrl+N new chat | Ctrl+F focus mode | Ctrl+Y copy | Ctrl+R clear | Ctrl+C abort/exit";

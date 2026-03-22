import { Box, Text } from "ink";

import {
  APP_BACKGROUND_COLOR,
  CONVERSATION_HEIGHT,
  CONVERSATION_PANEL_WIDTH_PERCENT,
} from "@/constants/ui";
import { ConversationRow } from "@/types/mimo";

const isTerminalControlCharacter = (character: string) => {
  const code = character.charCodeAt(0);

  return (code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f);
};

const sanitizeTerminalText = (value: string) =>
  Array.from(value)
    .filter((character) => !isTerminalControlCharacter(character))
    .join("");

const sanitizeTerminalHref = (href?: string) => {
  if (!href) {
    return undefined;
  }

  const sanitizedHref = sanitizeTerminalText(href).trim();

  if (!sanitizedHref) {
    return undefined;
  }

  try {
    const url = new URL(sanitizedHref);

    return url.protocol === "file:" ||
      url.protocol === "http:" ||
      url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

const toTerminalLink = (text: string, href?: string) => {
  const safeHref = sanitizeTerminalHref(href);
  const safeText = sanitizeTerminalText(text);

  return safeHref
    ? `\u001B]8;;${safeHref}\u0007${safeText}\u001B]8;;\u0007`
    : safeText;
};

export const ConversationPanel = ({
  focused,
  fullWidth = false,
  hideChrome = false,
  helpLines,
  rows,
  visibleConversationLines,
  showMoreAbove,
  showMoreBelow,
}: {
  focused: boolean;
  fullWidth?: boolean;
  hideChrome?: boolean;
  helpLines: string[];
  rows: ConversationRow[];
  visibleConversationLines: number;
  showMoreAbove: boolean;
  showMoreBelow: boolean;
}) => (
  <Box
    backgroundColor={APP_BACKGROUND_COLOR}
    borderColor={hideChrome ? undefined : focused ? "#00FF00" : "gray"}
    borderStyle={hideChrome ? undefined : "round"}
    flexDirection="column"
    height={CONVERSATION_HEIGHT}
    paddingX={1}
    width={fullWidth ? "100%" : CONVERSATION_PANEL_WIDTH_PERCENT}
  >
    <Box
      backgroundColor={APP_BACKGROUND_COLOR}
      flexDirection="column"
      flexShrink={0}
    >
      <Text bold color="white">
        Conversation
      </Text>

      {helpLines.map((line, index) => (
        <Text key={`conversation-help-${index}`} color="gray">
          {line}
        </Text>
      ))}

      <Text color="gray">{showMoreAbove ? "↑ More above" : " "}</Text>
    </Box>

    <Box
      backgroundColor={APP_BACKGROUND_COLOR}
      flexDirection="column"
      height={visibleConversationLines}
      marginTop={1}
    >
      {rows.length > 0 ? (
        rows.map((row) => (
          <Box
            key={row.key}
            backgroundColor={APP_BACKGROUND_COLOR}
            flexShrink={0}
            height={1}
          >
            <Text wrap="truncate">
              {row.segments.map((segment, index) => (
                <Text
                  key={`${row.key}-${index}`}
                  backgroundColor={segment.backgroundColor}
                  bold={segment.bold}
                  color={segment.color}
                  underline={segment.underline}
                >
                  {toTerminalLink(segment.text || " ", segment.href)}
                </Text>
              ))}
            </Text>
          </Box>
        ))
      ) : (
        <Box backgroundColor={APP_BACKGROUND_COLOR} flexShrink={0} height={1}>
          <Text color="gray" wrap="truncate">
            No messages yet.
          </Text>
        </Box>
      )}
    </Box>

    <Text color="gray">{showMoreBelow ? "↓ More below" : " "}</Text>
  </Box>
);

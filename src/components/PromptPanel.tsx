import { Box, Text } from "ink";

import { PromptLine } from "@/components/PromptLine";
import { APP_BACKGROUND_COLOR } from "@/constants/ui";
import { FocusTarget } from "@/types/mimo";

export const PromptPanel = ({
  focus,
  placeholder,
  prompt,
  promptLineCount,
  promptCursor,
}: {
  focus: FocusTarget;
  placeholder: string;
  prompt: string;
  promptLineCount: number;
  promptCursor: number;
}) => (
  <Box
    backgroundColor={APP_BACKGROUND_COLOR}
    borderStyle="round"
    borderColor={focus === "prompt" ? "#00FF00" : "gray"}
    flexDirection="column"
    height={promptLineCount + 3}
    paddingX={1}
  >
    <Text>
      <Text bold color="white">
        Prompt:
      </Text>

      <Text color="gray"> Press Enter to send or Ctrl+J for a new line</Text>
    </Text>

    <PromptLine
      focus={focus}
      placeholder={placeholder}
      prompt={prompt}
      promptCursor={promptCursor}
    />
  </Box>
);

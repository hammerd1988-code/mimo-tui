import { Box, Text } from "ink";

import { APP_BACKGROUND_COLOR, DEFAULT_HEADER_HELP_TEXT } from "@/constants/ui";

export const HeaderBar = ({
  focusLabel,
  helpText = DEFAULT_HEADER_HELP_TEXT.replace("{focusLabel}", focusLabel),
}: {
  focusLabel: string;
  helpText?: string;
}) => (
  <Box
    backgroundColor={APP_BACKGROUND_COLOR}
    borderStyle="round"
    borderColor="#ef6c00"
    justifyContent="space-between"
    paddingX={1}
  >
    <Text bold color="white">
      MiMo TUI
    </Text>

    <Text color="gray">{helpText}</Text>
  </Box>
);

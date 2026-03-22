import { Box, Text } from "ink";

import { APP_BACKGROUND_COLOR } from "@/constants/ui";
import { PromptLine } from "@/components/PromptLine";

export const ConfigSetupScreen = ({
  configMessage,
  configPath,
  exampleJson,
  inputMode,
  keyInput,
  keyInputCursor,
}: {
  configMessage: string;
  configPath: string;
  exampleJson: string;
  inputMode: boolean;
  keyInput: string;
  keyInputCursor: number;
}) => {
  const maskedApiKey = "*".repeat(keyInput.length);

  return (
    <Box backgroundColor={APP_BACKGROUND_COLOR} flexDirection="column">
      <Box
        backgroundColor={APP_BACKGROUND_COLOR}
        borderStyle="round"
        borderColor="#ef6c00"
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="white">
          API Key Setup
        </Text>

        <Text color="gray">{configMessage}</Text>
        <Text color="gray">Config path:</Text>
        <Text color="#00FF00" wrap="wrap">
          {configPath}
        </Text>

        <Text color="gray">Expected JSON:</Text>

        {exampleJson.split("\n").map((line, index) => (
          <Text key={`config-example-${index}`} color="#00FF00">
            {line}
          </Text>
        ))}
      </Box>

      <Box
        backgroundColor={APP_BACKGROUND_COLOR}
        borderStyle="round"
        borderColor={inputMode ? "#00FF00" : "gray"}
        flexDirection="column"
        marginTop={1}
        paddingX={1}
      >
        <Text bold color="white">
          {inputMode ? "Enter API key" : "Options"}
        </Text>

        {inputMode ? (
          <>
            <Text color="gray">
              Paste your MiMo API key and press Enter to save.
            </Text>

            <PromptLine
              focus="prompt"
              placeholder="Paste your MiMo API key"
              prompt={maskedApiKey}
              promptCursor={keyInputCursor}
            />

            <Text color="gray">Esc cancel | Enter save | Ctrl+C exit</Text>
          </>
        ) : (
          <>
            <Text color="gray">E enter and save the API key</Text>
            <Text color="gray">R reload after creating the JSON file</Text>
            <Text color="gray">Q quit</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

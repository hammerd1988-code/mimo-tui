import { Box, Text } from "ink";

import { BlinkingCursor } from "@/components/BlinkingCursor";
import { FocusTarget } from "@/types/mimo";

export const PromptLine = ({
  focus,
  placeholder,
  prompt,
  promptCursor,
}: {
  focus: FocusTarget;
  placeholder: string;
  prompt: string;
  promptCursor: number;
}) => {
  if (prompt.length === 0) {
    return (
      <Text>
        <BlinkingCursor active={focus === "prompt"} />

        <Text color="gray">{placeholder}</Text>
      </Text>
    );
  }

  const normalizedPrompt = prompt.replace(/\r\n?/g, "\n");
  const beforeCursor = normalizedPrompt.slice(0, promptCursor);
  const beforeCursorLines = beforeCursor.split("\n");
  const cursorLineIndex = beforeCursorLines.length - 1;
  const cursorColumn =
    beforeCursorLines[beforeCursorLines.length - 1]?.length ?? 0;
  const lines = normalizedPrompt.split("\n");

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => {
        if (focus !== "prompt" || index !== cursorLineIndex) {
          return (
            <Text key={`prompt-line-${index}`} color="white">
              {line || " "}
            </Text>
          );
        }

        const currentCharacter = line[cursorColumn];
        const beforeCharacter = line.slice(0, cursorColumn);
        const afterCharacter = line.slice(
          cursorColumn + (currentCharacter ? 1 : 0),
        );

        return (
          <Text key={`prompt-line-${index}`} color="white">
            {beforeCharacter}
            {currentCharacter ? (
              <Text backgroundColor="white" color="black">
                {currentCharacter}
              </Text>
            ) : (
              <Text backgroundColor="white" color="black">
                {" "}
              </Text>
            )}
            {afterCharacter}
          </Text>
        );
      })}
    </Box>
  );
};

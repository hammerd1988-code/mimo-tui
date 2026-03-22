import { Box, Text } from "ink";

import { APP_BACKGROUND_COLOR } from "@/constants/ui";
import {
  ConversationId,
  ConversationSummary,
  ModelProfile,
} from "@/types/mimo";

export const SettingsSidebar = ({
  currentConversationId,
  historyFocused,
  historyItems,
  historyOffset,
  showHistoryMoreAbove,
  showHistoryMoreBelow,
  selectedConversationIndex,
  focused,
  selectedModelProfile,
  selectedSetting,
  settingItems,
  settingsLineWidth,
}: {
  currentConversationId: ConversationId | null;
  historyFocused: boolean;
  historyItems: ConversationSummary[];
  historyOffset: number;
  showHistoryMoreAbove: boolean;
  showHistoryMoreBelow: boolean;
  selectedConversationIndex: number;
  focused: boolean;
  selectedModelProfile: ModelProfile;
  selectedSetting: number;
  settingItems: string[];
  settingsLineWidth: number;
}) => (
  <Box
    backgroundColor={APP_BACKGROUND_COLOR}
    flexDirection="column"
    width="23%"
  >
    <Box
      backgroundColor={APP_BACKGROUND_COLOR}
      borderStyle="round"
      borderColor={focused ? "#00FF00" : "gray"}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="white">
        Settings
      </Text>

      <Box
        backgroundColor={APP_BACKGROUND_COLOR}
        flexDirection="column"
        marginTop={1}
      >
        {settingItems.map((item, index) => (
          <Text
            key={item}
            backgroundColor={index === selectedSetting ? "#00FF00" : undefined}
            color={index === selectedSetting ? "black" : "white"}
          >
            {`${index === selectedSetting ? "›" : " "} ${item}`.padEnd(
              settingsLineWidth,
              " ",
            )}
          </Text>
        ))}
      </Box>
    </Box>

    <Box
      backgroundColor={APP_BACKGROUND_COLOR}
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="white">
        Model Details
      </Text>

      <Text color="gray">Category: {selectedModelProfile.category}</Text>
      <Text color="gray">Context: {selectedModelProfile.contextLength}</Text>
      <Text color="gray">Max output: {selectedModelProfile.maxOutput}</Text>
      <Text color="gray">Features:</Text>

      {selectedModelProfile.features.map((feature) => (
        <Text key={feature} color="#00FF00">{`• ${feature}`}</Text>
      ))}
    </Box>

    <Box
      backgroundColor={APP_BACKGROUND_COLOR}
      borderStyle="round"
      borderColor={historyFocused ? "#00FF00" : "gray"}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="white">
        Chats
      </Text>

      <Text color="gray">
        Enter to open. Ctrl+Delete to remove. Ctrl+N new chat.
      </Text>

      <Text color="gray">{showHistoryMoreAbove ? "↑ More above" : " "}</Text>

      <Box backgroundColor={APP_BACKGROUND_COLOR} flexDirection="column">
        {historyItems.map((item, index) => {
          const absoluteIndex = historyOffset + index;
          const isSelected = absoluteIndex === selectedConversationIndex;
          const isActive = item.conversationId === currentConversationId;

          return (
            <Text
              key={item.conversationId}
              backgroundColor={isSelected ? "#00FF00" : undefined}
              color={isSelected ? "black" : isActive ? "#00FF00" : "white"}
              wrap="truncate"
            >
              {`${isSelected ? "›" : " "} ${item.title}`}
            </Text>
          );
        })}
      </Box>

      <Text color="gray">{showHistoryMoreBelow ? "↓ More below" : " "}</Text>
    </Box>
  </Box>
);

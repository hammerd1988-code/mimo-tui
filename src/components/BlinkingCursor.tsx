import { useEffect, useState } from "react";
import { Text } from "ink";

export const BlinkingCursor = ({ active }: { active: boolean }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) {
      setVisible(false);

      return;
    }

    const interval = setInterval(() => {
      setVisible((current) => !current);
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [active]);

  return <Text color="white">{visible ? "█" : " "}</Text>;
};

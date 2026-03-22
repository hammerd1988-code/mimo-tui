import { useEffect, useState } from "react";
import { Text } from "ink";

export const Spinner = ({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) => {
  const frames = ["·  ", "●  ", "● · ", "● ● ", "● ● ·", "● ● ●"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);

      return;
    }

    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, 180);

    return () => {
      clearInterval(interval);
    };
  }, [active]);

  return (
    <Text color={active ? "cyan" : "gray"}>
      {active ? `${label} ${frames[index]}` : label}
    </Text>
  );
};

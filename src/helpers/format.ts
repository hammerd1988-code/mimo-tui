export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

export const toTitleCase = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

export const wrapText = (text: string, width: number) => {
  if (!text) {
    return [""];
  }

  return text.split("\n").flatMap((rawLine) => {
    if (rawLine.length === 0) {
      return [""];
    }

    const words = rawLine.split(/(\s+)/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine + word;

      if (nextLine.length <= width) {
        currentLine = nextLine;

        continue;
      }

      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trimEnd());
        currentLine = word.trimStart();

        continue;
      }

      let remainder = word;

      while (remainder.length > width) {
        lines.push(remainder.slice(0, width));
        remainder = remainder.slice(width);
      }

      currentLine = remainder;
    }

    lines.push(currentLine.trimEnd());

    return lines;
  });
};

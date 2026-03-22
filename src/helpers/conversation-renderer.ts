import { pathToFileURL } from "node:url";

import { highlight } from "cli-highlight";
import { marked } from "marked";

import { ROLE_COLOR, ROLE_LABEL } from "@/constants/conversation";
import { ANSI_COLOR_MAP } from "@/constants/terminal";
import { MarkdownToken } from "@/types/conversation";
import {
  ConversationRow,
  ConversationSegment,
  TranscriptEntry,
} from "@/types/mimo";

const pushWrappedSegments = (
  rows: ConversationRow[],
  keyPrefix: string,
  segments: ConversationSegment[],
  width: number,
) => {
  let currentLine: ConversationSegment[] = [];
  let currentLength = 0;
  let lineIndex = rows.length;

  const flushLine = () => {
    rows.push({
      key: `${keyPrefix}-${lineIndex}`,
      segments: currentLine.length > 0 ? currentLine : [{ text: "" }],
    });

    currentLine = [];
    currentLength = 0;
    lineIndex += 1;
  };

  for (const segment of segments) {
    const pieces = segment.text.split("\n");

    for (const [pieceIndex, piece] of pieces.entries()) {
      let remaining = piece;

      while (remaining.length > 0) {
        const available = Math.max(1, width - currentLength);
        const slice = remaining.slice(0, available);

        currentLine.push({
          ...segment,
          text: slice,
        });

        currentLength += slice.length;
        remaining = remaining.slice(slice.length);

        if (currentLength >= width) {
          flushLine();
        }
      }

      if (pieceIndex < pieces.length - 1) {
        flushLine();
      }
    }
  }

  if (currentLine.length > 0) {
    flushLine();
  }
};

const getSegmentLength = (segment: ConversationSegment) => segment.text.length;

const padRowToWidth = (
  row: ConversationRow,
  width: number,
): ConversationRow => {
  const currentWidth = row.segments.reduce(
    (total, segment) => total + getSegmentLength(segment),
    0,
  );

  if (currentWidth >= width) {
    return row;
  }

  return {
    ...row,
    segments: [...row.segments, { text: " ".repeat(width - currentWidth) }],
  };
};

const ANSI_SEGMENT_PATTERN = new RegExp(String.raw`\x1b\[[0-9;]*m`, "g");

const isTerminalControlCharacter = (character: string) => {
  const code = character.charCodeAt(0);

  return (
    (code >= 0x00 && code <= 0x08) ||
    (code >= 0x0b && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f)
  );
};

const sanitizeTerminalText = (text: string) =>
  Array.from(text)
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

const ansiToSegments = (text: string): ConversationSegment[] => {
  const segments: ConversationSegment[] = [];
  let lastIndex = 0;
  let currentStyle: Omit<ConversationSegment, "text"> = { color: "white" };

  const pushText = (value: string) => {
    if (!value) {
      return;
    }

    segments.push({
      ...currentStyle,
      text: value,
    });
  };

  const applyAnsiCode = (
    style: Omit<ConversationSegment, "text">,
    code: number,
  ) => {
    switch (code) {
      case 0:
        return { color: "white" };

      case 1:
        return { ...style, bold: true };

      case 4:
        return { ...style, underline: true };

      case 22:
        return { ...style, bold: undefined };

      case 24:
        return { ...style, underline: undefined };

      case 39:
        return { ...style, color: "white" };

      default:
        return ANSI_COLOR_MAP[code]
          ? { ...style, color: ANSI_COLOR_MAP[code] }
          : style;
    }
  };

  for (const match of text.matchAll(ANSI_SEGMENT_PATTERN)) {
    const start = match.index as number;

    pushText(text.slice(lastIndex, start));

    const rawCodes = match[0].slice(2, -1);
    const codes = rawCodes.length > 0 ? rawCodes.split(";").map(Number) : [0];

    for (const code of codes) {
      currentStyle = applyAnsiCode(currentStyle, code);
    }

    lastIndex = start + match[0].length;
  }

  pushText(text.slice(lastIndex));

  return segments.length > 0 ? segments : [{ color: "white", text }];
};

const FILE_PATH_PATTERN = /([A-Za-z]:\\[^\s]+|\/[^\s]+)/g;

const createFileLinkSegments = (
  text: string,
  color = "white",
): ConversationSegment[] => {
  const sanitizedText = sanitizeTerminalText(text);
  const segments: ConversationSegment[] = [];
  let lastIndex = 0;

  for (const match of sanitizedText.matchAll(FILE_PATH_PATTERN)) {
    const filePath = match[0];
    const start = match.index as number;

    if (start > lastIndex) {
      segments.push({
        color,
        text: sanitizedText.slice(lastIndex, start),
      });
    }

    segments.push({
      color: "#7FDBFF",
      href: sanitizeTerminalHref(pathToFileURL(filePath).href),
      text: filePath,
      underline: true,
    });

    lastIndex = start + filePath.length;
  }

  if (lastIndex < sanitizedText.length) {
    segments.push({
      color,
      text: sanitizedText.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ color, text: sanitizedText }];
};

const renderInlineTokens = (
  tokens: MarkdownToken[] = [],
): ConversationSegment[] => {
  const segments: ConversationSegment[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "escape":
        segments.push(...createFileLinkSegments(token.text ?? "", "white"));

        break;

      case "strong":
        segments.push(
          ...renderInlineTokens(token.tokens).map((segment) => ({
            ...segment,
            bold: true,
          })),
        );

        break;

      case "em":
        segments.push(
          ...renderInlineTokens(token.tokens).map((segment) => ({
            ...segment,
            color: segment.color ?? "white",
          })),
        );

        break;

      case "codespan":
        segments.push({
          color: "cyan",
          text: ` ${token.text} `,
        });

        break;

      case "link":
        segments.push(
          ...renderInlineTokens(token.tokens).map((segment) => ({
            ...segment,
            color: "#7FDBFF",
            href: sanitizeTerminalHref(token.href),
            underline: true,
          })),
        );

        break;

      case "del":
        segments.push(
          ...renderInlineTokens(token.tokens).map((segment) => ({
            ...segment,
            color: segment.color ?? "white",
          })),
        );

        break;

      case "br":
        segments.push({ text: "\n" });

        break;

      default:
        if ("tokens" in token && Array.isArray(token.tokens)) {
          segments.push(...renderInlineTokens(token.tokens));
        } else if ("text" in token && typeof token.text === "string") {
          segments.push(...createFileLinkSegments(token.text, "white"));
        }

        break;
    }
  }

  return segments;
};

const renderMarkdownRows = (text: string, keyPrefix: string, width: number) => {
  const rows: ConversationRow[] = [];

  const tokens = marked.lexer(sanitizeTerminalText(text), {
    breaks: true,
    gfm: true,
  }) as MarkdownToken[];

  for (const [index, token] of tokens.entries()) {
    const rowKey = `${keyPrefix}-md-${index}`;

    switch (token.type) {
      case "space":
        rows.push({ key: `${rowKey}-space`, segments: [{ text: "" }] });

        break;

      case "heading":
        pushWrappedSegments(
          rows,
          rowKey,
          renderInlineTokens(token.tokens ?? []).map((segment) => ({
            ...segment,
            bold: true,
            color: "white",
          })),
          width,
        );

        rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });

        break;

      case "paragraph":
        pushWrappedSegments(
          rows,
          rowKey,
          renderInlineTokens(token.tokens ?? []),
          width,
        );

        rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });

        break;

      case "blockquote":
        for (const [quoteIndex, quoteToken] of (token.tokens ?? []).entries()) {
          if (quoteToken.type !== "paragraph") {
            continue;
          }

          pushWrappedSegments(
            rows,
            `${rowKey}-quote-${quoteIndex}`,
            [
              { color: "gray", text: "> " },
              ...renderInlineTokens(
                (quoteToken.tokens ?? []) as MarkdownToken[],
              ).map((segment) => ({
                ...segment,
                color: segment.color ?? "white",
              })),
            ],
            width,
          );
        }

        rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });

        break;

      case "list":
        for (const [itemIndex, item] of (token.items ?? []).entries()) {
          const marker = token.ordered ? `${itemIndex + 1}. ` : "• ";

          const itemTokens =
            item.tokens?.find(
              (child: MarkdownToken) => child.type === "paragraph",
            )?.tokens ?? [];

          const itemSegments =
            itemTokens.length > 0
              ? renderInlineTokens(itemTokens)
              : [{ color: "white", text: item.text ?? "" }];

          pushWrappedSegments(
            rows,
            `${rowKey}-item-${itemIndex}`,
            [{ bold: true, color: "white", text: marker }, ...itemSegments],
            width,
          );
        }

        rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });

        break;

      case "code":
        for (const [lineIndex, line] of (token.text ?? "")
          .split("\n")
          .entries()) {
          const highlightedSegments = ansiToSegments(
            highlight(sanitizeTerminalText(line.length > 0 ? line : " "), {
              ignoreIllegals: true,
              language: token.lang,
            }),
          );

          pushWrappedSegments(
            rows,
            `${rowKey}-code-${lineIndex}`,
            highlightedSegments,
            width,
          );
        }

        rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });

        break;

      default:
        if ("text" in token && typeof token.text === "string") {
          pushWrappedSegments(
            rows,
            rowKey,
            [{ color: "white", text: sanitizeTerminalText(token.text) }],
            width,
          );

          rows.push({ key: `${rowKey}-after`, segments: [{ text: "" }] });
        }

        break;
    }
  }

  if (rows.length === 0) {
    rows.push({ key: `${keyPrefix}-empty`, segments: [{ text: "" }] });
  }

  return rows.map((row) => padRowToWidth(row, width));
};

const renderPlainRows = (
  text: string,
  keyPrefix: string,
  color: string,
  width: number,
) => {
  const rows: ConversationRow[] = [];

  pushWrappedSegments(
    rows,
    keyPrefix,
    createFileLinkSegments(text, color),
    width,
  );

  if (rows.length === 0) {
    rows.push({ key: `${keyPrefix}-empty`, segments: [{ color, text: "" }] });
  }

  return rows.map((row) => padRowToWidth(row, width));
};

export const createConversationRows = ({
  entry,
  isLoading,
  width,
}: {
  entry: TranscriptEntry;
  isLoading: boolean;
  width: number;
}) => {
  const rows: ConversationRow[] = [];
  const label = ROLE_LABEL[entry.role];
  const baseColor = ROLE_COLOR[entry.role];
  const content =
    entry.text || (entry.role === "assistant" && isLoading ? "..." : "");

  if (label) {
    rows.push({
      key: `${entry.id}-label`,
      segments: [{ bold: true, color: baseColor, text: label }],
    });
  }

  const contentRows =
    entry.role === "meta"
      ? renderPlainRows(content, `${entry.id}-content`, baseColor, width)
      : renderMarkdownRows(content, `${entry.id}-content`, width);

  rows.push(...contentRows);
  rows.push({
    key: `${entry.id}-spacer`,
    segments: [{ text: " ".repeat(width) }],
  });

  return rows;
};

export const createEmptyConversationRows = (
  count: number,
  width: number,
): ConversationRow[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `empty-row-${index}`,
    segments: [{ text: " ".repeat(width) }],
  }));

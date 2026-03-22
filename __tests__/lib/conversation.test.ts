import { afterEach, describe, expect, it, vi } from "vitest";

const markedLexerMock = vi.fn();
const highlightMock = vi.fn((value: string, _options?: unknown) => value);

vi.mock("marked", () => ({
  __esModule: true,
  marked: {
    lexer: (text: string, options?: unknown) => markedLexerMock(text, options),
  },
}));

vi.mock("cli-highlight", () => ({
  __esModule: true,
  highlight: (value: string, options?: unknown) =>
    highlightMock(value, options),
}));

import {
  createConversationRows,
  createEmptyConversationRows,
} from "@/helpers/conversation-renderer";

const hasTerminalControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);

    return (code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f);
  });

describe("conversation rendering", () => {
  afterEach(() => {
    markedLexerMock.mockReset();
    highlightMock.mockReset();
    highlightMock.mockImplementation(
      (value: string, _options?: unknown) => value,
    );
  });

  it("strips terminal control characters from rendered text", () => {
    markedLexerMock.mockImplementation((text: string) => [
      {
        type: "paragraph",
        tokens: [{ type: "text", text }],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 1,
        role: "assistant",
        text: "safe\u001b]8;;https://evil.test\u0007text\u001b]8;;\u0007\u0085",
      },
      isLoading: false,
      width: 80,
    });

    const output = rows
      .flatMap((row) => row.segments)
      .map((segment) => segment.text);

    expect(markedLexerMock).toHaveBeenCalled();
    expect(output.some((segment) => hasTerminalControlCharacter(segment))).toBe(
      false,
    );
  });

  it("drops unsafe markdown link protocols", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [
          {
            type: "link",
            href: "javascript:alert(1)",
            tokens: [{ type: "text", text: "bad" }],
          },
          { type: "text", text: " and /tmp/file.txt" },
        ],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 1,
        role: "assistant",
        text: "[bad](javascript:alert(1)) and /tmp/file.txt",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);
    const badLink = segments.find((segment) => segment.text.includes("bad"));
    const fileLink = segments.find((segment) =>
      segment.text.includes("/tmp/file.txt"),
    );

    expect(badLink?.href).toBeUndefined();
    expect(fileLink?.href?.startsWith("file://")).toBe(true);
  });

  it("preserves safe https links in markdown", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [
          {
            type: "link",
            href: "https://example.com",
            tokens: [{ type: "text", text: "docs" }],
          },
        ],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 1,
        role: "assistant",
        text: "[docs](https://example.com)",
      },
      isLoading: false,
      width: 80,
    });

    const linkSegment = rows
      .flatMap((row) => row.segments)
      .find((segment) => segment.text.includes("docs"));

    expect(linkSegment?.href).toBe("https://example.com/");
  });

  it("drops missing hrefs, strips blank hrefs and preserves safe http links", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [
          { type: "link", tokens: [{ type: "text", text: "missing" }] },
          { type: "text", text: " " },
          {
            type: "link",
            href: "\u001b\u0007",
            tokens: [{ type: "text", text: "blank" }],
          },
          { type: "text", text: " " },
          {
            type: "link",
            href: "http://example.com/docs",
            tokens: [{ type: "text", text: "safe-link" }],
          },
        ],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 10,
        role: "assistant",
        text: "synthetic links",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(
      segments.find((segment) => segment.text.includes("missing"))?.href,
    ).toBeUndefined();
    expect(
      segments.find((segment) => segment.text.includes("blank"))?.href,
    ).toBeUndefined();
    expect(
      segments.find((segment) => segment.text.includes("safe-link"))?.href,
    ).toBe("http://example.com/docs");
  });

  it("creates file links for plain meta messages", () => {
    const rows = createConversationRows({
      entry: {
        id: 1,
        role: "meta",
        text: "Saved to /tmp/result.wav",
      },
      isLoading: false,
      width: 80,
    });

    const linkSegment = rows
      .flatMap((row) => row.segments)
      .find((segment) => segment.text.includes("/tmp/result.wav"));

    expect(linkSegment?.href?.startsWith("file://")).toBe(true);
  });

  it("renders a loading placeholder for empty assistant messages", () => {
    markedLexerMock.mockImplementation((text: string) => [
      {
        type: "paragraph",
        tokens: [{ type: "text", text }],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 1,
        role: "assistant",
        text: "",
      },
      isLoading: true,
      width: 20,
    });

    expect(
      rows
        .flatMap((row) => row.segments)
        .some((segment) => segment.text.includes("...")),
    ).toBe(true);
    expect(markedLexerMock).toHaveBeenCalledWith(
      "...",
      expect.objectContaining({ breaks: true, gfm: true }),
    );
  });

  it("renders empty plain rows and explicit empty filler rows", () => {
    const rows = createConversationRows({
      entry: {
        id: 2,
        role: "meta",
        text: "",
      },
      isLoading: false,
      width: 5,
    });

    expect(
      rows.some((row) =>
        row.segments.some((segment) => segment.color === "gray"),
      ),
    ).toBe(true);
    expect(createEmptyConversationRows(2, 3)).toEqual([
      { key: "empty-row-0", segments: [{ text: "   " }] },
      { key: "empty-row-1", segments: [{ text: "   " }] },
    ]);
  });

  it("renders markdown structures and ansi styled code blocks", () => {
    markedLexerMock.mockReturnValue([
      { type: "space" },
      { type: "heading", tokens: [{ type: "text", text: "Heading" }] },
      {
        type: "paragraph",
        tokens: [
          { type: "strong", tokens: [{ type: "text", text: "bold" }] },
          { type: "em", tokens: [{ type: "text", text: "em" }] },
          { type: "codespan", text: "code" },
          {
            type: "link",
            href: "::bad",
            tokens: [{ type: "text", text: "badlink" }],
          },
          { type: "del", tokens: [{ type: "text", text: "gone" }] },
          { type: "br" },
          { type: "text", text: "/tmp/file.txt" },
        ],
      },
      {
        type: "blockquote",
        tokens: [
          { type: "html", text: "<ignored>" },
          { type: "paragraph", tokens: [{ type: "text", text: "quote" }] },
        ],
      },
      {
        type: "list",
        ordered: true,
        items: [
          { text: "fallback item" },
          {
            tokens: [
              { type: "paragraph", tokens: [{ type: "text", text: "listed" }] },
            ],
          },
        ],
      },
      { type: "code", text: "const a = 1;\n", lang: "ts" },
      { type: "html", text: "html block" },
    ]);

    highlightMock.mockImplementation(
      () => "\u001b[1;4;31mR\u001b[22;24;39mW\u001b[0m",
    );

    const rows = createConversationRows({
      entry: {
        id: 3,
        role: "assistant",
        text: "synthetic markdown",
      },
      isLoading: false,
      width: 20,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(
      segments.some(
        (segment) => segment.bold && segment.text.includes("Heading"),
      ),
    ).toBe(true);
    expect(
      segments.some(
        (segment) =>
          segment.text.includes("/tmp/file.txt") &&
          segment.href?.startsWith("file://"),
      ),
    ).toBe(true);
    expect(
      segments.some(
        (segment) =>
          segment.text.includes("badlink") && segment.href === undefined,
      ),
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.text === "R" && segment.bold && segment.underline,
      ),
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.text === "W" && segment.color === "white",
      ),
    ).toBe(true);
  });

  it("falls back to nested tokens and raw text for unknown inline markdown nodes", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [
          {
            type: "custom-node",
            tokens: [{ type: "text", text: "nested" }],
          },
          { type: "text", text: " " },
          {
            type: "custom-text",
            text: "/tmp/custom-fallback.txt",
          },
        ],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 11,
        role: "assistant",
        text: "custom markdown",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(segments.some((segment) => segment.text.includes("nested"))).toBe(
      true,
    );
    expect(
      segments.some(
        (segment) =>
          segment.text.includes("/tmp/custom-fallback.txt") &&
          segment.href?.startsWith("file://"),
      ),
    ).toBe(true);
  });

  it("handles escape tokens and inline styles that start without a color", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [
          { type: "escape" },
          { type: "em", tokens: [{ type: "br" }] },
          { type: "del", tokens: [{ type: "br" }] },
        ],
      },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 15,
        role: "assistant",
        text: "inline edge cases",
      },
      isLoading: false,
      width: 80,
    });

    expect(rows.some((row) => row.key.includes("15-content"))).toBe(true);
  });

  it("renders unordered list markers, empty code lines and ignores unknown block tokens without text", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "list",
        ordered: false,
        items: [{ text: "bullet item" }],
      },
      { type: "code", lang: undefined, text: "" },
      { type: "custom-block" },
    ]);
    highlightMock.mockImplementation((value: string) => value);

    const rows = createConversationRows({
      entry: {
        id: 12,
        role: "assistant",
        text: "branch markdown",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(segments.some((segment) => segment.text === "• ")).toBe(true);
    expect(
      segments.some((segment) => segment.text.includes("bullet item")),
    ).toBe(true);
    expect(segments.some((segment) => segment.text === " ")).toBe(true);
    expect(rows.some((row) => row.key.includes("12-content-md-2-after"))).toBe(
      false,
    );
  });

  it("handles blockquotes with line breaks, empty list items and code blocks without text", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "blockquote",
        tokens: [
          {
            type: "paragraph",
            tokens: [{ type: "br" }],
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [{}],
      },
      {
        type: "code",
        lang: undefined,
      },
    ]);
    highlightMock.mockImplementation((value: string) => value);

    const rows = createConversationRows({
      entry: {
        id: 13,
        role: "assistant",
        text: "edge markdown",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(
      segments.some(
        (segment) => segment.color === "gray" && segment.text === "> ",
      ),
    ).toBe(true);
    expect(segments.some((segment) => segment.text === "• ")).toBe(true);
    expect(segments.some((segment) => segment.text === "")).toBe(true);
    expect(segments.some((segment) => segment.text === " ")).toBe(true);
  });

  it("handles markdown blocks that omit tokens and items", () => {
    markedLexerMock.mockReturnValue([
      { type: "heading" },
      { type: "paragraph" },
      { type: "blockquote" },
      {
        type: "blockquote",
        tokens: [{ type: "paragraph" }],
      },
      { type: "list", ordered: false },
    ]);

    const rows = createConversationRows({
      entry: {
        id: 14,
        role: "assistant",
        text: "missing collections",
      },
      isLoading: false,
      width: 80,
    });

    expect(rows.some((row) => row.key.includes("14-content-md-0-after"))).toBe(
      true,
    );
    expect(rows.some((row) => row.key.includes("14-content-md-1-after"))).toBe(
      true,
    );
    expect(rows.some((row) => row.key.includes("14-content-md-2-after"))).toBe(
      true,
    );
    expect(rows.some((row) => row.key.includes("14-content-md-3-after"))).toBe(
      true,
    );
    expect(rows.some((row) => row.key.includes("14-content-md-4-after"))).toBe(
      true,
    );
  });

  it("handles empty ansi codes, unknown ansi colors and inline tokens with non-string text", () => {
    markedLexerMock.mockReturnValue([
      {
        type: "paragraph",
        tokens: [{ type: "custom-number", text: 123 }],
      },
      {
        type: "code",
        text: "empty\ncodes",
        lang: "ts",
      },
    ]);

    highlightMock.mockImplementation((value: string) => {
      if (value === "empty") {
        return "";
      }

      return "\u001b[m\u001b[99mX";
    });

    const rows = createConversationRows({
      entry: {
        id: 16,
        role: "assistant",
        text: "ansi edge cases",
      },
      isLoading: false,
      width: 80,
    });

    const segments = rows.flatMap((row) => row.segments);

    expect(rows.some((row) => row.key.includes("16-content-md-1"))).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(segments.some((segment) => segment.text === "X")).toBe(true);
  });

  it("creates an empty markdown row when the lexer returns no tokens", () => {
    markedLexerMock.mockReturnValue([]);

    const rows = createConversationRows({
      entry: {
        id: 4,
        role: "assistant",
        text: "empty tokens",
      },
      isLoading: false,
      width: 5,
    });

    expect(rows.some((row) => row.key.includes("empty"))).toBe(true);
  });
});

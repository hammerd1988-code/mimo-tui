export type MarkdownToken = {
  depth?: number;
  href?: string;
  items?: Array<{
    text?: string;
    tokens?: MarkdownToken[];
  }>;
  lang?: string;
  ordered?: boolean;
  text?: string;
  tokens?: MarkdownToken[];
  type: string;
};

import { Indentation, KlogSummaryJSON } from "./types.js";

/** Render-only summary layout. Widths count Unicode code points, tabs included as one. */
export interface SummaryFormatOptions {
  indentation?: Indentation | null;
  startOnNextLine?: boolean;
  /** Soft maximum for the entire rendered line; words and tags are never split. */
  wrapWidth?: number;
  /** Characters already rendered before the first line, e.g. an entry's value. */
  firstLineOffset?: number;
}

export interface SummaryTag {
  name: string;
  value?: string;
}

export interface SummaryTextNode {
  type: "text";
  value: string;
}

export interface SummaryEndOfLineNode {
  type: "end-of-line";
}

export interface SummaryTagNode extends SummaryTag {
  type: "tag";
}

export type SummaryAsNodes =
  SummaryEndOfLineNode | SummaryTextNode | SummaryTagNode;

/** @deprecated Use {@link SummaryAsNodes} instead. */
export type SummaryAsTags = SummaryAsNodes;

function tagMatches(line: string) {
  // A fresh expression per call avoids shared lastIndex across summaries/helpers.
  return line.matchAll(
    /#(?<name>[\p{L}\d_-]+)(?:=(?<value>(?:"[^"]*")|(?:'[^']*')|(?:[\p{L}\d_-]*)))?/gu,
  );
}

function tagFromMatch(match: RegExpMatchArray): SummaryTag {
  const tag: SummaryTag = { name: match.groups!.name.toLowerCase() };
  let value = match.groups!.value;
  if (value?.startsWith('"') || value?.startsWith("'")) {
    value = value.slice(1, -1);
  }
  if (value) tag.value = value;
  return tag;
}

function klogTagString(match: RegExpMatchArray): string {
  const { value } = tagFromMatch(match);
  // Go uses Unicode simple lowercase, not contextual/full string casing.
  // U+0130 is the one lowercase expansion in JavaScript's default casing.
  const name = Array.from(match.groups!.name, (char) =>
    char === "\u0130" ? "i" : char.toLowerCase(),
  ).join("");
  if (!value) return `#${name}`;
  const quote = /^[\p{L}\d_-]+$/u.test(value)
    ? ""
    : value.includes('"')
      ? "'"
      : '"';
  return `#${name}=${quote}${value}${quote}`;
}

function compareCodePoints(a: string, b: string): number {
  // Go sorts UTF-8 strings by bytes, which matches code-point order for Unicode.
  // JavaScript's default UTF-16 sorting differs for supplementary characters.
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    const left = a.codePointAt(i)!;
    const right = b.codePointAt(j)!;
    if (left !== right) return left - right;
    i += left > 0xffff ? 2 : 1;
    j += right > 0xffff ? 2 : 1;
  }
  return a.length - b.length;
}

function codePointLength(text: string): number {
  let length = 0;
  for (const _ of text) length++;
  return length;
}

/** Wrap one explicit line, considering only spaces/tabs outside raw tags. */
function wrapLine(
  line: string,
  width: number,
  firstOffset: number,
  continuationOffset: number,
): string[] {
  const leading = line.match(/^[ \t]*/)![0];
  const bodyEnd = line.length - line.match(/[ \t]*$/)![0].length;
  if (leading.length >= bodyEnd) return [line];

  const tags = tagMatches(line);
  let tag = tags.next().value;
  const result: string[] = [];
  let parts = [leading];
  let column = firstOffset + leading.length;
  let hasWord = false;
  let wordStart = leading.length;
  let separator = "";

  const appendWord = (end: number) => {
    const word = line.slice(wordStart, end);
    const length = codePointLength(word);
    if (hasWord && column + separator.length + length > width) {
      result.push(parts.join(""));
      parts = [leading, word];
      column = continuationOffset + leading.length + length;
    } else {
      parts.push(separator, word);
      column += separator.length + length;
    }
    hasWord = true;
  };

  for (const gap of line.matchAll(/[ \t]+/g)) {
    if (gap.index < leading.length || gap.index >= bodyEnd) continue;
    while (tag && tag.index + tag[0].length <= gap.index)
      tag = tags.next().value;
    if (tag && gap.index >= tag.index && gap.index < tag.index + tag[0].length)
      continue;
    appendWord(gap.index);
    separator = gap[0];
    wordStart = gap.index + gap[0].length;
  }
  appendWord(bodyEnd);
  parts.push(line.slice(bodyEnd));
  result.push(parts.join(""));
  return result;
}

// TODO: throw if any lines with blank characters
export class Summary {
  lines: string[];

  // TODO: maybe take a rest parameter instead
  constructor(text: string | string[]) {
    this.lines = typeof text === "string" ? text.split("\n") : text;
  }

  setText(text: string) {
    this.lines = text.split("\n");
  }

  get tags() {
    const tags: SummaryTag[] = [];

    for (const line of this.lines) {
      for (const match of tagMatches(line)) tags.push(tagFromMatch(match));
    }

    return tags;
  }

  /** Split the summary into a list of text nodes and tag nodes, useful for rich
   * text formatting. */
  splitOnTags() {
    const nodes: SummaryAsNodes[] = [];
    for (const [lineIndex, line] of this.lines.entries()) {
      let position = 0;
      for (const match of tagMatches(line)) {
        if (match.index > position) {
          nodes.push({
            type: "text",
            value: line.slice(position, match.index),
          });
        }
        nodes.push({ type: "tag", ...tagFromMatch(match) });
        position = match.index + match[0].length;
      }
      if (position < line.length) {
        nodes.push({ type: "text", value: line.slice(position) });
      }
      if (lineIndex !== this.lines.length - 1)
        nodes.push({ type: "end-of-line" });
    }

    return nodes;
  }

  /** Return upstream's canonical summary text and sorted tag strings.
   * Duplicate tags are retained; this does not change lines or the tags getter.
   */
  toKlogJSON(): KlogSummaryJSON {
    const summary = this.toString().replace(/\r\n/g, "\n");
    const tags: string[] = [];
    for (const line of summary.split("\n")) {
      for (const match of tagMatches(line)) tags.push(klogTagString(match));
    }
    return { summary, tags: tags.sort(compareCodePoints) };
  }

  /** Render without modifying lines. Legacy indentation/start arguments still work.
   * Opt-in wrapping preserves explicit breaks, alignment, and complete raw tags;
   * normalizes CRLF to LF; and may exceed the width for indivisible words/prefixes.
   */
  toString(
    indentOrOptions: Indentation | null | SummaryFormatOptions = null,
    startOnNextLine = false,
  ): string {
    const options: SummaryFormatOptions =
      typeof indentOrOptions === "object" && indentOrOptions !== null
        ? indentOrOptions
        : { indentation: indentOrOptions, startOnNextLine };
    const nextLine = options.startOnNextLine ?? false;
    const continuation = (options.indentation || "").repeat(2);
    const { wrapWidth, firstLineOffset = 0 } = options;
    if (
      wrapWidth !== undefined &&
      (!Number.isSafeInteger(wrapWidth) || wrapWidth <= 0)
    )
      throw new RangeError(
        "Summary wrap width must be a positive safe integer",
      );
    if (!Number.isSafeInteger(firstLineOffset) || firstLineOffset < 0)
      throw new RangeError(
        "Summary first-line offset must be a non-negative safe integer",
      );

    let lines = this.lines;
    if (wrapWidth !== undefined && lines.length > 0) {
      lines = lines
        .join("\n")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .flatMap((line, i) =>
          wrapLine(
            line,
            wrapWidth,
            i === 0 && !nextLine ? firstLineOffset : continuation.length,
            continuation.length,
          ),
        );
    }
    return (
      (nextLine ? "\n" : "") +
      lines
        .map((line, i) => (i !== 0 || nextLine ? continuation + line : line))
        .join("\n")
    );
  }
}

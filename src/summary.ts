import { Indentation, KlogSummaryJSON } from "./types.js";

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
  | SummaryEndOfLineNode
  | SummaryTextNode
  | SummaryTagNode;

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

  toString(indentation: Indentation | null = null, startOnNextLine = false) {
    const indent = (l: string, i: number) =>
      i !== 0 || startOnNextLine ? `${(indentation || "").repeat(2)}${l}` : l;

    return (
      (startOnNextLine ? "\n" : "") +
      this.lines.map((l, i) => indent(l, i)).join("\n")
    );
  }
}

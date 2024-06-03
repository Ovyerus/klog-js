// TODO: check how Klog handles summaries (are new-lines kept as-is, or are
// they stripped and then auto-added in serialisation?)

import { Indentation } from "./entry.js";

// Regex for extracting parts of a tag into named groups.
const tagRe =
  /#(?<name>[\p{L}\d_-]+)(?:=(?<value>(?:"[^"]*")|(?:'[^']*')|(?:[\p{L}\d_-]*)))?/gu;
// Regex for splitting a string into parts that have tags and regular text separate.
const splitRe =
  /(#(?:[\p{L}\d_-]+)(?:=(?:(?:"[^"]*")|(?:'[^']*')|(?:[\p{L}\d_-]*)))?)/gu;

type TagMatch = { groups: { name: string; value?: string } } | null;

export interface Tag {
  name: string;
  value?: string;
}

interface TextNode {
  type: "text";
  value: string;
}

interface EndOfLineNode {
  type: "end-of-line";
}

interface TagNode {
  type: "tag";
  name: string;
  value?: string;
}

export type SummaryAsTags = EndOfLineNode | TextNode | TagNode;

// TODO: throw if any lines with blank characters
export class Summary {
  lines: string[];

  constructor(text: string | string[]) {
    this.lines = typeof text === "string" ? text.split("\n") : text;
  }

  setText(text: string) {
    this.lines = text.split("\n");
  }

  get tags() {
    const tags: Tag[] = [];

    for (const line of this.lines) {
      const matches = line.match(tagRe);
      if (!matches) continue;

      for (const tag of matches) {
        const { groups } = tagRe.exec(tag)!;
        tags.push({ name: groups!.name, value: groups!.value });
      }
    }

    return tags;
  }

  /** Split the summary into a list of text nodes and tag nodes, useful for rich
   * text formatting. */
  splitOnTags() {
    const nodes: SummaryAsTags[] = [];
    const textSplitOnTags = this.lines.map((x) => x.split(splitRe));

    for (const [lineIndex, line] of textSplitOnTags.entries()) {
      for (const [index, value] of line.entries()) {
        // We don't care for empty text nodes at the start or end of each line.
        const isEmptyTextAtFirstIndex = index === 0 && value === "";
        const isEmptyTextAtLastIndex =
          index === line.length - 1 && value === "";
        if (isEmptyTextAtFirstIndex || isEmptyTextAtLastIndex) continue;

        const match = tagRe.exec(value) as TagMatch;
        if (!match) nodes.push({ type: "text", value });

        nodes.push({
          type: "tag",
          name: match!.groups.name,
          value: match!.groups.value,
        });
      }

      if (lineIndex !== textSplitOnTags.length - 1)
        nodes.push({ type: "end-of-line" });
    }

    return nodes;
  }

  toString(indentation: Indentation | null = null, startOnNextLine = false) {
    // TODO: this shouldn't do indentation on the first line when not starting on new line
    return (
      (startOnNextLine ? "\n" : "") +
      this.lines
        .map((l) => (indentation ? `${indentation}${indentation}${l}` : l))
        .join("\n")
    );
  }
}

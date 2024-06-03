import { KlogDuration } from "./duration.js";
import { Range } from "./range.js";
import { Summary } from "./summary.js";
import { EntryNode } from "./types.js";

export enum Indentation {
  FourSpaces = "    ",
  ThreeSpaces = "   ",
  TwoSpaces = "  ",
  Tab = "\t",
}

export class Entry {
  constructor(
    public value: KlogDuration | Range,
    public summary: Summary | null = null
  ) {}

  static fromAST(node: EntryNode) {
    const ValueType = node.value.type === "duration" ? KlogDuration : Range;
    return new this(
      ValueType.fromAST(node.value as any),
      node.summary ? new Summary(node.summary) : null
    );
  }

  toDuration() {
    if (this.value instanceof KlogDuration)
      // Return a clone instead of returning a reference
      return KlogDuration.fromMinutes(this.value.toMinutes());
    else if (this.value.open) return new KlogDuration(0, 0);
    else return this.value.toDuration();
  }

  toMinutes() {
    return this.value.toMinutes();
  }

  toString(indent: Indentation | null = Indentation.FourSpaces) {
    // TODO: automatically move to next line if over certain length? See what Klog does
    const summary = this.summary
      ? " " + this.summary.toString(indent, false)
      : "";
    return `${indent || ""}${this.value}${summary}`;
  }
}

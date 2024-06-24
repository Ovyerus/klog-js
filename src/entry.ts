import { Duration } from "./duration.js";
import { Range } from "./range.js";
import { Summary } from "./summary.js";
import { EntryNode, Indentation } from "./types.js";

/**
 * A single time entry.
 */
export class Entry {
  /**
   * Create a new entry.
   */
  constructor(
    /** The value of the entry. */
    public value: Duration | Range,
    /** Optional summary or tags associated with the entry. */
    public summary: Summary | null = null,
  ) {}

  /** @internal */
  static fromAST = (node: EntryNode) => {
    const ValueType = node.value.type === "duration" ? Duration : Range;
    return new this(
      ValueType.fromAST(node.value as any),
      node.summary ? new Summary(node.summary) : null,
    );
  };

  /**
   * Convert the entry's value to a duration.
   */
  toDuration() {
    if (this.value instanceof Duration)
      // Return a clone instead of returning a reference
      return Duration.fromMinutes(this.value.toMinutes());
    else if (this.value.open) return new Duration(0, 0);
    else return this.value.toDuration();
  }

  /**
   * Convert the entry's value to minutes.
   */
  toMinutes() {
    return this.value.toMinutes();
  }

  /**
   * Render the entry as a Klog string.
   * @param indent - The indentation to use for the entry. May be `null` for no indentation.
   */
  toString(indent: Indentation | null = "    ") {
    // TODO: automatically move to next line if over certain length? See what Klog does
    const summary = this.summary
      ? " " + this.summary.toString(indent, false)
      : "";
    return `${indent || ""}${this.value}${summary}`;
  }
}

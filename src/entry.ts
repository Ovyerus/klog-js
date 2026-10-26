import { Duration, type DurationOptions } from "./duration.js";
import { Range, RangeDashFormat } from "./range.js";
import { TimeFormat } from "./time.js";
import { Summary } from "./summary.js";
import { EntryNode, Indentation, KlogEntryJSON } from "./types.js";

/** Non-mutating formatting overrides for an entry and its nested values. */
export interface EntryFormatOptions {
  /** One indentation unit. null omits indentation for standalone entries. */
  indentation?: Indentation | null;
  /** Display format for all range endpoints. */
  timeFormat?: TimeFormat;
  rangeDashFormat?: RangeDashFormat;
  openRangePlaceholderCharCount?: number;
  /** Applied to duration entries; omitted properties retain their stored values. */
  duration?: DurationOptions;
}

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

  /** Convert to an entry object from `klog json`, without altering toJSON().
   * Durations use canonical signs, while time endpoints retain stored formats.
   * Open ranges contribute zero and have no end/end_mins properties.
   */
  toKlogJSON(): KlogEntryJSON {
    // JSON represents both signed zero values as 0.
    const total_mins = this.toMinutes() + 0;
    const base = {
      ...(this.summary?.toKlogJSON() ?? { summary: "", tags: [] }),
      total: Duration.fromMinutes(total_mins).toString(),
      total_mins,
    };
    if (this.value instanceof Duration) return { ...base, type: "duration" };
    const start = this.value.start.toString();
    const start_mins = this.value.start.toMinutesSinceMidnight();
    if (this.value.end === null)
      return { ...base, type: "open_range", start, start_mins };
    return {
      ...base,
      type: "range",
      start,
      start_mins,
      end: this.value.end.toString(),
      end_mins: this.value.end.toMinutesSinceMidnight(),
    };
  }

  /**
   * Render the entry as a Klog string.
   * Accepts render options or the legacy indentation string/null argument.
   * Options apply to this rendering only, including continuation indentation.
   */
  toString(indentOrOptions: Indentation | null | EntryFormatOptions = "    ") {
    const options: EntryFormatOptions =
      typeof indentOrOptions === "object" && indentOrOptions !== null
        ? indentOrOptions
        : { indentation: indentOrOptions };
    const indent =
      options.indentation === undefined ? "    " : options.indentation;
    const value =
      this.value instanceof Duration
        ? this.value.toString(options.duration)
        : this.value.toString({
            format: options.rangeDashFormat,
            timeFormat: options.timeFormat,
            openRangePlaceholderCharCount:
              options.openRangePlaceholderCharCount,
          });
    const summary = this.summary
      ? " " + this.summary.toString(indent, false)
      : "";
    return `${indent || ""}${value}${summary}`;
  }
}

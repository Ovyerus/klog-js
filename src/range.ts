import { Duration } from "./duration.js";
import { Time } from "./time.js";
import { TimeRangeNode } from "./types.js";

/**
 * Formatting options for spacing around a range's dash.
 */
export enum RangeDashFormat {
  Spaces,
  NoSpaces,
}

/**
 * Options for configuring the range.
 */
export interface RangeOptions {
  /** The format for dashes in the time range. */
  format?: RangeDashFormat;
  /** The number of placeholder characters to use for an open range. */
  openRangePlaceholderCharCount?: number;
}

/**
 * A range of time with a start time and optional end time.
 */
export class Range {
  /** @internal */
  #end: Time | null;
  /** The format for dashes in the time range. */
  format: RangeDashFormat;
  /** The number of placeholder characters to use for an open range. */
  openRangePlaceholderCharCount: number;

  /**
   * Create a new range.
   * @throws {Error} The end time is before the start time.
   */
  constructor(
    /** The start time of the range. */
    public start: Time,
    /** The end time of the range. `null` if the range is open. */
    end: Time | null = null,
    /** Configuration options for the range */
    {
      format = RangeDashFormat.Spaces,
      openRangePlaceholderCharCount = 1,
    }: RangeOptions = {},
  ) {
    if (end && !end.afterOrEquals(start))
      throw new Error("End of range cannot be before its start");

    this.#end = end;
    this.format = format;
    this.openRangePlaceholderCharCount = openRangePlaceholderCharCount;
  }

  /** @internal */
  static fromAST = (node: TimeRangeNode) => {
    const start = Time.fromAST(node.start);
    const end = !node.open ? Time.fromAST(node.end) : null;
    return new this(start, end, {
      openRangePlaceholderCharCount: node.open ? node.placeholderCount : 1,
      format: node.format,
    });
  };

  /** The end time of the range. */
  get end() {
    return this.#end;
  }

  /**
   * @throws {Error} The end time is before the start time.
   */
  set end(value: Time | null) {
    if (!value) this.#end = value;
    else if (!value.afterOrEquals(this.start))
      throw new Error("End of range cannot be before its start");
    else this.#end = value;
  }

  /**
   * Whether or not the range is considered open.
   */
  get open() {
    return !this.end;
  }

  /**
   * Convert the range to a duration.
   */
  toDuration() {
    return Duration.fromMinutes(this.toMinutes());
  }

  /**
   * Converts the range to minutes.
   * @returns 0 if an open range, otherwise the duration of the time range in minutes.
   */
  toMinutes() {
    if (this.open) return 0; // unlimited potential!
    const start = this.start.toMinutesSinceMidnight();
    const end = this.end!.toMinutesSinceMidnight();

    return end - start;
  }

  /**
   * Render the range as a Klog string.
   */
  toString() {
    const dash = this.format === RangeDashFormat.Spaces ? " - " : "-";
    return `${this.start}${dash}${
      this.open ? "?".repeat(this.openRangePlaceholderCharCount) : this.end
    }`;
  }

  /**
   * Convert the range to a JSON object.
   */
  toJSON() {
    const { start, end, format, openRangePlaceholderCharCount } = this;
    return { start, end, format, openRangePlaceholderCharCount };
  }
}

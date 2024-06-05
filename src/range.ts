import { Duration } from "./duration.js";
import { Time } from "./time.js";
import { TimeRangeNode } from "./types.js";

export enum RangeDashFormat {
  Spaces,
  NoSpaces,
}

export interface RangeOptions {
  format?: RangeDashFormat;
  openRangePlaceholderCharCount?: number;
}

export class Range {
  #end: Time | null;
  format: RangeDashFormat;
  // TODO: rename to `additionalPlaceholderChars` like klog
  openRangePlaceholderCharCount: number;

  constructor(
    public start: Time,
    end: Time | null = null,
    {
      format = RangeDashFormat.Spaces,
      openRangePlaceholderCharCount = 1,
    }: RangeOptions = {}
  ) {
    if (end && !end.afterOrEquals(start))
      throw new Error("End of range cannot be before its start");

    this.#end = end;
    this.format = format;
    this.openRangePlaceholderCharCount = openRangePlaceholderCharCount;
  }

  static fromAST(node: TimeRangeNode) {
    const start = Time.fromAST(node.start);
    const end = !node.open ? Time.fromAST(node.end) : null;
    return new this(start, end, {
      openRangePlaceholderCharCount: node.open ? node.placeholderCount : 1,
      format: node.format,
    });
  }

  get end() {
    return this.#end;
  }

  // Protect setting `end` to an invalid value.
  set end(value: Time | null) {
    if (!value) this.#end = value;
    else if (!value.afterOrEquals(this.start))
      throw new Error("End of range cannot be before its start");
    else this.#end = value;
  }

  get open() {
    return !this.end;
  }

  toDuration() {
    return Duration.fromMinutes(this.toMinutes());
  }

  toMinutes() {
    if (this.open) return 0; // unlimited potential!
    const start = this.start.toMinutesSinceMidnight();
    const end = this.end!.toMinutesSinceMidnight();

    return end - start;
  }

  toString() {
    const dash = this.format === RangeDashFormat.Spaces ? " - " : "-";
    return `${this.start}${dash}${
      this.open ? "?".repeat(this.openRangePlaceholderCharCount) : this.end
    }`;
  }
}

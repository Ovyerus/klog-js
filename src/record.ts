import { differenceInCalendarDays, format, isValid } from "date-fns";
import { Duration } from "./duration.js";
import { Entry, type EntryFormatOptions } from "./entry.js";
import { Range } from "./range.js";
import { Time } from "./time.js";
import { Indentation, KlogRecordJSON, RecordNode } from "./types.js";
import { Summary } from "./summary.js";

export enum RecordDateFormat {
  Dashes,
  Slashes,
}

// TODO: maybe always just use string/string[] in summaries rather than forcing the user to submit a Summary class.

/** Per-render record options, propagated to every entry without mutation. */
export interface RecordFormatOptions
  extends Omit<EntryFormatOptions, "indentation"> {
  /** Valid klog indentation; unlike a standalone entry, a record requires it. */
  indentation?: Indentation;
  dateFormat?: RecordDateFormat;
  /** Omitted preserves existing newline behavior; explicit values normalize all lines. */
  newline?: "\n" | "\r\n";
}

/** Stable warning categories, matching the upstream klog checker names. */
export type RecordWarningCode =
  | "UNCLOSED_OPEN_RANGE"
  | "FUTURE_ENTRIES"
  | "OVERLAPPING_RANGES"
  | "MORE_THAN_24H";

export interface RecordWarning {
  code: RecordWarningCode;
  message: string;
}

export interface RecordWarningOptions {
  /** Reference time in the local timezone. Defaults to the current time. */
  now?: Date;
}

function hasOverlappingRanges(entries: Entry[]): boolean {
  const ranges: { start: number; end: number }[] = [];
  for (const entry of entries) {
    if (!(entry.value instanceof Range)) continue;
    const start = entry.value.start.toMinutesSinceMidnight();
    // Upstream's best guess for an open end is 23:59 on the record's day.
    const end = entry.value.end?.toMinutesSinceMidnight() ?? 23 * 60 + 59;
    // Point-in-time ranges do not overlap; shifted open starts may be past end.
    if (start < end) ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  return ranges.some(
    (range, index) => index > 0 && range.start < ranges[index - 1].end,
  );
}

/**
 * A block of time entries for any given day.
 */
export class Record {
  /** Create a new record. */
  constructor(
    /** The date of the record. */
    public date: Date,
    /** Entries belonging to the record. */
    public entries: Entry[] = [],
    /** Optional summary or tags associated with the entire record. */
    public summary: Summary | null = null,
    /** The expected duration all the entries in the record should sum up to. */
    public shouldTotal: Duration | null = null,
    /** What dividers should be used for the date when using `toString` */
    public dateFormat = RecordDateFormat.Dashes,
  ) {
    let hasOpenRange = false;
    for (const entry of entries) {
      if (!(entry.value instanceof Range && entry.value.open)) continue;
      if (hasOpenRange)
        throw new Error("Records can only have one open range at a time");
      hasOpenRange = true;
    }
  }

  /** @internal */
  static fromAST = (node: RecordNode) => {
    return new this(
      node.date,
      node.entries.map(Entry.fromAST),
      node.summary ? new Summary(node.summary) : null,
      node.shouldTotal !== null ? Duration.fromMinutes(node.shouldTotal) : null,
    );
  };

  /**
   * The currently open entry, if any.
   */
  get openEntry() {
    return (
      this.entries.find((e) => e.value instanceof Range && e.value.open) || null
    );
  }

  /**
   * The date string formatted according to the record's date format.
   */
  get dateString() {
    const dateSep = this.dateFormat === RecordDateFormat.Dashes ? "-" : "/";
    return format(this.date, `yyyy${dateSep}MM${dateSep}dd`);
  }

  /**
   * Calculate the difference between the record's actual total duration and the expected total duration.
   */
  shouldTotalDiff() {
    const actual = this.toDuration();
    if (!this.shouldTotal) return actual;
    return actual.subtract(this.shouldTotal);
  }

  /**
   * Start a new time entry.
   * @param startTime - The time when the new entry starts.
   * @param summary - The new entry's summary.
   * @throws {Error} There is already an open entry in the record.
   */
  start(startTime: Time, summary: Summary | null = null) {
    if (this.openEntry)
      throw new Error("Records can only have one open range at a time");

    this.entries.push(new Entry(new Range(startTime), summary));
  }

  /**
   * End the currently open time entry, if any.
   * @param endTime - The time the open range will end.
   * @throws {Error} There are no open entries in the record.
   */
  end(endTime: Time) {
    if (!this.openEntry)
      throw new Error("Record does not have any currently open ranges");

    (this.openEntry.value as Range).end = endTime;
  }

  /**
   * Converts the total duration of all entries to minutes.
   */
  toMinutes() {
    return this.entries.map((e) => e.toMinutes()).reduce((a, b) => a + b, 0);
  }

  /**
   * Converts the total duration of all entries to a duration.
   */
  toDuration() {
    return Duration.fromMinutes(this.toMinutes());
  }

  /**
   * Check for likely mistakes without changing this record or its totals.
   * Returns at most one warning per category, in RecordWarningCode order above.
   * Future times have a 30-minute grace period; durations are future only when
   * their record date is in the future. Open ranges are stale before yesterday.
   * Yesterday's open range is left alone because this method has no other-record
   * context. Overlap checks assume an open end of 23:59, as upstream does.
   * Time/shift comparisons use local calendar days and wall-clock minutes.
   * @throws {Error} The record date or reference date is invalid.
   */
  getWarnings({
    now = new Date(),
  }: RecordWarningOptions = {}): RecordWarning[] {
    if (!isValid(now)) throw new Error("Invalid warning reference date");
    if (!isValid(this.date)) throw new Error("Invalid record date");

    const warnings: RecordWarning[] = [];
    const dayOffset = differenceInCalendarDays(this.date, now);
    if (dayOffset < -1 && this.openEntry) {
      warnings.push({
        code: "UNCLOSED_OPEN_RANGE",
        message: "Unclosed open range",
      });
    }

    // Work in whole minutes, including the first minute beyond the grace period.
    const futureThreshold = now.getHours() * 60 + now.getMinutes() + 31;
    const isFuture = (time: Time) =>
      dayOffset * 24 * 60 + time.toMinutesSinceMidnight() >= futureThreshold;
    if (
      this.entries.some((entry) => {
        if (!(entry.value instanceof Range)) return dayOffset > 0;
        return (
          isFuture(entry.value.start) ||
          (entry.value.end !== null && isFuture(entry.value.end))
        );
      })
    ) {
      warnings.push({ code: "FUTURE_ENTRIES", message: "Entry in the future" });
    }

    if (hasOverlappingRanges(this.entries)) {
      warnings.push({
        code: "OVERLAPPING_RANGES",
        message: "Overlapping time ranges",
      });
    }
    if (this.toMinutes() > 24 * 60) {
      warnings.push({
        code: "MORE_THAN_24H",
        message: "Total time exceeds 24 hours",
      });
    }
    return warnings;
  }

  /** Return one object from `klog json`'s records array, not a JSON string.
   * Includes evaluated totals, target, difference, and entry views. Does not
   * include the CLI's records/errors/warnings envelope or run warning checks.
   * Stored date/time display styles are used, not previous render overrides.
   */
  toKlogJSON(): KlogRecordJSON {
    // Normalize signed zero without masking other numeric values.
    const total_mins = this.toMinutes() + 0;
    const should_total_mins = (this.shouldTotal?.toMinutes() ?? 0) + 0;
    const diff_mins = total_mins - should_total_mins;
    return {
      date: this.dateString,
      ...(this.summary?.toKlogJSON() ?? { summary: "", tags: [] }),
      total: Duration.fromMinutes(total_mins).toString(),
      total_mins,
      should_total:
        Duration.fromMinutes(should_total_mins).toString() +
        (this.shouldTotal === null ? "" : "!"),
      should_total_mins,
      diff: Duration.fromMinutes(diff_mins).toString({
        explicitPositive: true,
      }),
      diff_mins,
      entries: this.entries.map((entry) => entry.toKlogJSON()),
    };
  }

  /**
   * Render the record as a Klog string. Supplied options override nested formats
   * for this call only; omitted options preserve stored formatting and defaults.
   */
  toString(options: RecordFormatOptions = {}) {
    let headline = this.dateString;
    if (options.dateFormat !== undefined) {
      const separator =
        options.dateFormat === RecordDateFormat.Dashes ? "-" : "/";
      headline = format(this.date, `yyyy${separator}MM${separator}dd`);
    }
    if (this.shouldTotal !== null)
      headline += ` (${this.shouldTotal.toString(options.duration)}!)`;

    const summary = this.summary
      ? this.summary.toString({ wrapWidth: options.summaryWrapWidth }) + "\n"
      : "";
    const entries = this.entries.map((e) => e.toString(options)).join("\n");
    const text = headline + "\n" + summary + entries;
    return options.newline === undefined
      ? text
      : text.replace(/\r?\n/g, options.newline);
  }
}

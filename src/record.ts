import { format } from "date-fns";
import { Duration } from "./duration.js";
import { Entry } from "./entry.js";
import { Range } from "./range.js";
import { Time } from "./time.js";
import { RecordNode } from "./types.js";
import { Summary } from "./summary.js";

export enum RecordDateFormat {
  Dashes,
  Slashes,
}

// TODO: `normalise` to apply sweeping format changes throughout the tree (dash spacing, am/pm or 24 hour, explicit duration +, etc)
// TODO: method for getting warnings about record (e.g. overlapping time ranges). See what Klog handles.
// TODO: maybe always just use string/string[] in summaries rather than forcing the user to submit a Summary class.

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
  ) {}

  /** @internal */
  static fromAST = (node: RecordNode) => {
    return new this(
      node.date,
      node.entries.map(Entry.fromAST),
      node.summary ? new Summary(node.summary) : null,
      node.shouldTotal ? Duration.fromMinutes(node.shouldTotal) : null,
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
   * Render the record as a Klog string.
   */
  toString() {
    // TODO: support windows newlines
    let headline = this.dateString;
    if (this.shouldTotal?.toMinutes()) headline += ` (${this.shouldTotal}!)`;

    const summary = this.summary
      ? this.summary.toString(null, false) + "\n"
      : "";
    const entries = this.entries.map((e) => e.toString()).join("\n");

    return headline + "\n" + summary + entries;
  }
}

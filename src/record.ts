import { format } from "date-fns";
import { KlogDuration } from "./duration.js";
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
export class Record {
  constructor(
    public date: Date,
    public entries: Entry[] = [],
    public summary: Summary | null = null,
    public shouldTotal: KlogDuration | null = null,
    public dateFormat = RecordDateFormat.Dashes
  ) {}

  static fromAST(node: RecordNode) {
    return new this(
      node.date,
      node.entries.map(Entry.fromAST),
      node.summary ? new Summary(node.summary) : null,
      node.shouldTotal && KlogDuration.fromAST(node.shouldTotal)
    );
  }

  get openEntry() {
    return (
      this.entries.find((e) => e.value instanceof Range && e.value.open) || null
    );
  }

  get dateString() {
    const dateSep = this.dateFormat === RecordDateFormat.Dashes ? "-" : "/";
    return format(this.date, `yyyy${dateSep}MM${dateSep}dd`);
  }

  shouldTotalDiff() {
    const actual = this.toDuration();
    if (!this.shouldTotal) return actual;
    return actual.subtract(this.shouldTotal);
  }

  start(startTime: Time, summary: Summary | null = null) {
    if (this.openEntry)
      throw new Error("Records can only have one open range at a time");

    this.entries.push(new Entry(new Range(startTime), summary));
  }

  end(endTime: Time) {
    if (!this.openEntry)
      throw new Error("Record does not have any currently open ranges");

    (this.openEntry.value as Range).end = endTime;
  }

  toMinutes() {
    return this.entries.map((e) => e.toMinutes()).reduce((a, b) => a + b, 0);
  }

  toDuration() {
    return KlogDuration.fromMinutes(this.toMinutes());
  }

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

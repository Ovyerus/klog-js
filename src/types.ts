import { RangeDashFormat } from "./range.js";
import { DayShift, TimeFormat } from "./time.js";

export type Sign = "" | "+" | "-";
export type Indentation = "    " | "   " | "  " | "\t";

export interface FileNode {
  type: "file";
  records: RecordNode[];
}

export interface RecordNode {
  type: "record";
  date: Date;
  shouldTotal: number | null;
  summary: string | null;
  entries: EntryNode[];
}

export interface EntryNode {
  type: "entry";
  summary: string | null;
  value: TimeRangeNode | DurationNode;
}

export interface OpenTimeRangeNode {
  type: "timeRange";
  open: true;
  placeholderCount: number;
  format: RangeDashFormat;
  start: TimeNode;
}

export interface ClosedTimeRangeNode {
  type: "timeRange";
  open: false;
  format: RangeDashFormat;
  start: TimeNode;
  end: TimeNode;
}

export type TimeRangeNode = OpenTimeRangeNode | ClosedTimeRangeNode;

export interface TimeNode {
  type: "time";
  shift: DayShift;
  hour: number;
  minute: number;
  format: TimeFormat;
}

export interface DurationNode {
  type: "duration";
  value: number;
  sign: Sign;
}

/** Summary fields shared by upstream record and entry JSON objects. */
export interface KlogSummaryJSON {
  summary: string;
  tags: string[];
}

interface KlogEntryJSONBase extends KlogSummaryJSON {
  total: string;
  total_mins: number;
}

export interface KlogDurationEntryJSON extends KlogEntryJSONBase {
  type: "duration";
}

export interface KlogOpenRangeEntryJSON extends KlogEntryJSONBase {
  type: "open_range";
  start: string;
  start_mins: number;
}

export interface KlogClosedRangeEntryJSON extends KlogEntryJSONBase {
  type: "range";
  start: string;
  start_mins: number;
  end: string;
  end_mins: number;
}

export type KlogEntryJSON =
  KlogDurationEntryJSON | KlogOpenRangeEntryJSON | KlogClosedRangeEntryJSON;

/** One object inside `klog json`'s records array, not the CLI envelope. */
export interface KlogRecordJSON extends KlogSummaryJSON {
  date: string;
  total: string;
  total_mins: number;
  should_total: string;
  should_total_mins: number;
  diff: string;
  diff_mins: number;
  entries: KlogEntryJSON[];
}

export type KlogNode =
  FileNode | RecordNode | EntryNode | TimeRangeNode | TimeNode | DurationNode;

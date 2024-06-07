import { RangeDashFormat } from "./range.js";
import { DayShift, TimeFormat } from "./time.js";

export type Sign = "" | "+" | "-";

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

export type KlogNode =
  | FileNode
  | RecordNode
  | EntryNode
  | TimeRangeNode
  | TimeNode
  | DurationNode;

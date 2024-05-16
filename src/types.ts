import type { Duration } from "date-fns";

export interface FileNode {
  type: "file";
  records: RecordNode[];
}

export interface RecordNode {
  type: "record";
  date: string;
  shouldTotal: string | null;
  summary: string | null;
  entries: EntryNode[];
}

export interface EntryNode {
  type: "entry";
  summary: string | null;
  value: TimeRangeNode | DurationNode;
}

export interface TimeRangeNode {
  type: "timeRange";
  open: boolean;
  start: TimeNode;
  end?: TimeNode;
}

export interface TimeNode {
  type: "time";
  shift: "yesterday" | "tomorrow" | null;
  value: string;
}

export interface DurationNode {
  type: "duration";
  value: Duration;
}

export type KlogNode =
  | FileNode
  | RecordNode
  | EntryNode
  | TimeRangeNode
  | TimeNode
  | DurationNode;

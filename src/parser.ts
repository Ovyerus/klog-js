import { toAST } from "ohm-js/extras";
import grammar, { KlogActionDict } from "./grammar.ohm-bundle.js";
import type {
  ClosedTimeRangeNode,
  DurationNode,
  EntryNode,
  FileNode,
  KlogNode,
  OpenTimeRangeNode,
  RecordNode,
  TimeNode,
  TimeRangeNode,
} from "./types.js";
import { isValid, parseISO } from "date-fns";
import { DayShift, TimeFormat } from "./time.js";
import { RangeDashFormat } from "./range.js";
import { Record } from "./record.js";

// TODO: enforcing consistent indents & newlines
const mapping: KlogActionDict<KlogNode> = {
  file(_, __, record1, ___, ____, records, _____, ______): FileNode {
    return {
      type: "file",
      records: [record1.toAST(mapping)].concat(records.toAST(mapping)),
    };
  },

  record: (value) => value.toAST(mapping),

  record_summaryAndEntries(
    recordHead,
    _,
    summary,
    __,
    entry1,
    ___,
    entries,
  ): RecordNode {
    return {
      type: "record",
      ...recordHead.toAST(mapping),
      summary: summary.toAST(mapping),
      entries: [entry1.toAST(mapping)]
        .concat(entries.toAST(mapping))
        // Remove `null` (incase no entries are defined)
        .filter((x) => x),
    };
  },

  record_entries(recordHead, _, entry1, __, entries): RecordNode {
    return {
      type: "record",
      ...recordHead.toAST(mapping),
      summary: null,
      entries: [entry1.toAST(mapping)]
        .concat(entries.toAST(mapping))
        // Remove `null` (incase no entries are defined)
        .filter((x) => x),
    };
  },

  record_summary(recordHead, _, summary): RecordNode {
    return {
      type: "record",
      ...recordHead.toAST(mapping),
      summary: summary.toAST(mapping),
      entries: [],
    };
  },

  record_empty(recordHead): RecordNode {
    return {
      type: "record",
      ...recordHead.toAST(mapping),
      summary: null,
      entries: [],
    };
  },

  recordHead(date, _, shouldTotal): any {
    return {
      date: date.toAST(mapping),
      shouldTotal: shouldTotal.toAST(mapping),
    };
  },

  shouldTotal: (_, duration, __) => duration.toAST(mapping).value,

  entry: (_, value, summary): EntryNode => ({
    type: "entry",
    value: value.toAST(mapping),
    summary: summary.toAST(mapping),
  }),

  recordSummary: (value) => value.toAST(mapping).trim(),
  entrySummary: (value) => value.toAST(mapping).trim(),
  timeRange: (range) => range.toAST(mapping),

  timeRange_open: (
    start,
    spaceLeft,
    __,
    spaceRight,
    placeholder,
  ): OpenTimeRangeNode => {
    const hasSpaces = !!(
      [spaceLeft, spaceRight].flatMap((n) => n.toAST(mapping)) as string[]
    ).length;

    return {
      type: "timeRange",
      open: true,
      placeholderCount: (placeholder.toAST(mapping) as string[]).length,
      format: hasSpaces ? RangeDashFormat.Spaces : RangeDashFormat.NoSpaces,
      start: start.toAST(mapping),
    };
  },

  timeRange_closed: (
    start,
    spaceLeft,
    __,
    spaceRight,
    end,
  ): ClosedTimeRangeNode => {
    const hasSpaces = !!(
      [spaceLeft, spaceRight].flatMap((n) => n.toAST(mapping)) as string[]
    ).length;

    return {
      type: "timeRange",
      open: false,
      format: hasSpaces ? RangeDashFormat.Spaces : RangeDashFormat.NoSpaces,
      start: start.toAST(mapping),
      end: end.toAST(mapping),
    };
  },

  duration: (value) => value.toAST(mapping),

  // TODO: how does klog do negatives
  duration_hour($sign, $value, _): DurationNode {
    const sign = $sign.toAST(mapping) || "";
    const mul = sign === "-" ? -1 : 1;
    const value = parseInt($value.toAST(mapping).join(""), 10) * 60 * mul;

    return {
      type: "duration",
      value,
      sign,
    };
  },

  duration_minute($sign, $value, _): DurationNode {
    const sign = $sign.toAST(mapping) || "";
    const mul = sign === "-" ? -1 : 1;
    const value = parseInt($value.toAST(mapping).join(""), 10) * mul;

    return {
      type: "duration",
      value,
      sign,
    };
  },

  duration_hourMinute($sign, $hours, _, minute1, minute2, __): DurationNode {
    const sign = $sign.toAST(mapping) || "";
    const mul = sign === "-" ? -1 : 1;
    const hours = parseInt($hours.toAST(mapping).join(""), 10);
    const minutes = parseInt(
      minute1.toAST(mapping) + minute2.toAST(mapping),
      10,
    );
    const value = (hours * 60 + minutes) * mul;

    return {
      type: "duration",
      value,
      sign,
    };
  },

  time: (value) => value.toAST(mapping),

  backwardsShiftedTime: (_, $time): TimeNode => {
    return {
      ...($time.toAST(mapping) as TimeNode),
      shift: DayShift.Yesterday,
    };
  },

  forwardsShiftedTime: ($time, _): TimeNode => {
    return {
      ...($time.toAST(mapping) as TimeNode),
      shift: DayShift.Tomorrow,
    };
  },

  date(y1, y2, y3, y4, sep1, m1, m2, sep2, d1, d2): any {
    const dateString = [y1, y2, y3, y4, sep1, m1, m2, sep2, d1, d2]
      .map((x) => x.toAST(mapping))
      .join("")
      .replaceAll("/", "-");
    const date = parseISO(dateString);

    if (!isValid(date)) throw new Error(`Invalid date ${dateString}`);
    return date;
  },

  time_twelveHour(h1, h2, _, m1, m2, $period): TimeNode {
    const period = $period.toAST(mapping)?.toLowerCase() || "am";
    let hour = parseInt([h1, h2].map((x) => x.toAST(mapping)).join(""), 10);

    // Convert to 24 hour
    if (period === "am" && hour === 12) hour = 0;
    else if (period === "pm" && hour !== 12) hour += 12;

    const minute = parseInt(m1.toAST(mapping) + m2.toAST(mapping), 10);

    return {
      type: "time",
      hour,
      minute,
      shift: DayShift.Today,
      format: TimeFormat.TwelveHour,
    };
  },

  time_twentyFourHour(h1, h2, _, m1, m2): TimeNode {
    const hour = parseInt([h1, h2].map((x) => x.toAST(mapping)).join(""), 10);
    const minute = parseInt(m1.toAST(mapping) + m2.toAST(mapping), 10);

    return {
      type: "time",
      hour,
      minute,
      shift: DayShift.Today,
      format: TimeFormat.TwentyFourHour,
    };
  },
};

interface RuleToNode {
  file: FileNode;
  record: RecordNode;
  date: Date;
  entry: EntryNode;
  timeRange: TimeRangeNode;
  time: TimeNode;
  duration: DurationNode;
}

interface ParseAST {
  (source: string): FileNode;
  <T extends keyof RuleToNode>(source: string, rule: T): RuleToNode[T];
}

export const parseAST = ((source, rule) => {
  if ((!source.trim() && !rule) || rule === "file")
    return { type: "file", records: [] };

  const match = grammar.match(source, rule);

  if (match.succeeded()) return toAST(match, mapping);
  else throw new Error(match.message);
}) as ParseAST;

export const parse = (source: string) => {
  const nodes = parseAST(source);
  return nodes.records.map(Record.fromAST);
};

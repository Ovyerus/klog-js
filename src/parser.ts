import { toAST } from "ohm-js/extras";
import grammar, { KlogActionDict } from "./grammar.ohm-bundle.js";
import type {
  DurationNode,
  EntryNode,
  FileNode,
  KlogNode,
  RecordNode,
  TimeNode,
  TimeRangeNode,
} from "./types.js";
import { isValid, parseISO, type Duration } from "date-fns";

// TODO: parse and validate times

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
    entries
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

  timeRange_open: (start, _, __, ___, ____): TimeRangeNode => ({
    type: "timeRange",
    open: true,
    start: start.toAST(mapping),
  }),

  timeRange_closed: (start, _, __, ___, end): TimeRangeNode => ({
    type: "timeRange",
    open: false,
    start: start.toAST(mapping),
    end: end.toAST(mapping),
  }),

  duration: (value): DurationNode => ({
    type: "duration",
    value: value.toAST(mapping),
  }),

  duration_hour($sign, $value, _): any {
    const sign = $sign.toAST(mapping) || "+";
    const mul = sign === "-" ? -1 : 1;
    const value = parseInt($value.toAST(mapping).join(""), 10);

    return {
      hours: value * mul,
      minutes: 0,
    } as Duration;
  },

  duration_minute($sign, $value, _): any {
    const sign = $sign.toAST(mapping) || "+";
    const mul = sign === "-" ? -1 : 1;
    const value = parseInt($value.toAST(mapping).join(""), 10);

    return {
      hours: 0,
      minutes: value * mul,
    } as Duration;
  },

  duration_hourMinute($sign, $hours, _, minute1, minute2, __): any {
    const sign = $sign.toAST(mapping) || "+";
    const mul = sign === "-" ? -1 : 1;
    const hours = parseInt($hours.toAST(mapping).join(""), 10);
    const minutes = parseInt(
      minute1.toAST(mapping) + minute2.toAST(mapping),
      10
    );

    return {
      hours: hours * mul,
      minutes: minutes * mul,
    } as Duration;
  },

  time: (value): TimeNode => ({
    type: "time",
    shift: null,
    value: value.toAST(mapping),
  }),

  backwardsShiftedTime: (_, $time): TimeNode => {
    const { type, value } = $time.toAST(mapping) as TimeNode;
    return {
      type,
      value: value - 1440, // Treats backward shift as a continuation of the current day (but negatives).
      shift: "yesterday",
    };
  },

  forwardsShiftedTime: ($time, _): TimeNode => {
    const { type, value } = $time.toAST(mapping) as TimeNode;
    return {
      type,
      value: value + 1440, // Treats forward shift as a continuation of the current day.
      shift: "tomorrow",
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

  time_twelveHour(h1, h2, _, m1, m2, $period) {
    const period = $period.toAST(mapping)?.toLowerCase() || "am";
    let hour = parseInt([h1, h2].map((x) => x.toAST(mapping)).join(""), 10);

    // Convert to 24 hour
    if (period === "am" && hour === 12) hour = 0;
    else if (period === "pm" && hour !== 12) hour += 12;

    const minutes =
      parseInt(m1.toAST(mapping) + m2.toAST(mapping), 10) +
      // Get absolute minute of the day
      hour * 60;

    return minutes as any;
  },

  time_twentyFourHour(h1, h2, _, m1, m2) {
    const hour = parseInt([h1, h2].map((x) => x.toAST(mapping)).join(""), 10);
    const minutes =
      parseInt(m1.toAST(mapping) + m2.toAST(mapping), 10) +
      // Get absolute minute of the day
      hour * 60;

    return minutes as any;
  },
};

// rename to ast
// TODO: map of rules to node types
const parse = (source: string, rule?: string): KlogNode => {
  if ((!source.trim() && !rule) || rule === "file")
    return { type: "file", records: [] };

  const match = grammar.match(source, rule);

  if (match.succeeded()) return toAST(match, mapping) as KlogNode;
  else throw new Error(match.message);
};

export default parse;

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

// TODO: parse and validate times & durations

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

  time: (value): TimeNode => ({
    type: "time",
    shift: null,
    value: value.toAST(mapping),
  }),

  backwardsShiftedTime: (_, time): TimeNode => ({
    ...time.toAST(mapping),
    shift: "yesterday",
  }),

  forwardsShiftedTime: (time, _): TimeNode => ({
    ...time.toAST(mapping),
    shift: "tomorrow",
  }),
};

// TODO: map of rules to node types
const parse = (source: string, rule?: string): KlogNode => {
  if ((!source.trim() && !rule) || rule === "file")
    return { type: "file", records: [] };

  const match = grammar.match(source, rule);

  if (match.succeeded()) return toAST(match, mapping) as KlogNode;
  else throw new Error(match.message);
};

export default parse;

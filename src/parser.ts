import { toAST } from "ohm-js/extras";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
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

const test = readFileSync("./test.klg", "utf8");

const mapping: KlogActionDict<KlogNode> = {
  file(_, __, record1, ___, ____, records, _____, ______): FileNode {
    return {
      type: "file",
      records: [record1.toAST(mapping)].concat(records.toAST(mapping)),
    };
  },

  record(
    date,
    _,
    shouldTotal,
    __,
    summary,
    ___,
    entry1,
    ____,
    entries
  ): RecordNode {
    return {
      type: "record",
      date: date.toAST(mapping),
      shouldTotal: shouldTotal.toAST(mapping),
      summary: summary.toAST(mapping),
      entries: [entry1.toAST(mapping)].concat(entries.toAST(mapping)),
    };
  },

  shouldTotal: (_, duration, __) => duration.toAST(mapping).value,

  entry: (_, value, summary): EntryNode => ({
    type: "entry",
    value: value.toAST(mapping),
    summary: summary.toAST(mapping),
  }),

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

const match = grammar.match(test);
console.log(inspect(toAST(match, mapping), { depth: 100, colors: true }));

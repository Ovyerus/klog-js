import * as ohm from "ohm-js";
import { toAST } from "ohm-js/extras";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";

const source = readFileSync("./grammar.ohm", "utf8");
const test = readFileSync("./test.klg", "utf8");

const grammar = ohm.grammar(source);
const mapping = {
  file(_, __, record1, ___, ____, records, _____, ______) {
    return {
      type: "file",
      records: [record1.toAST(mapping)].concat(records.toAST(mapping)),
    };
  },

  record(date, _, shouldTotal, __, summary, ___, entry1, ____, entries) {
    return {
      type: "record",
      date: date.toAST(mapping),
      shouldTotal: shouldTotal.toAST(mapping),
      summary: summary.toAST(mapping),
      entries: [entry1.toAST(mapping)].concat(entries.toAST(mapping)),
    };
  },

  shouldTotal: (_, duration, __) => duration.toAST(mapping).value,
  entry: {
    value: 1,
    summary: 2,
  },
  entrySummary(value) {
    return value.toAST(mapping).trim();
  },
  timeRange: (range) => range.toAST(mapping),
  timeRange_open: {
    type: "timeRange",
    open: true,
    start: 0,
  },
  timeRange_closed: {
    type: "timeRange",
    open: false,
    start: 0,
    end: 4,
  },
  duration: {
    value: 0,
  },
  time: {
    type: "time",
    shift: null,
    value: 0,
  },
  backwardsShiftedTime: (_, time) => ({
    ...time.toAST(mapping),
    shift: "yesterday",
  }),

  forwardsShiftedTime: (time, _) => ({
    ...time.toAST(mapping),
    shift: "tomorrow",
  }),
};

const match = grammar.match(test);
console.log(inspect(toAST(match, mapping), { depth: 100, colors: true }));

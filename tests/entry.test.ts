import { describe, expect, test } from "vitest";
import { Entry } from "../src/entry";
import { Range } from "../src/range";
import { Time } from "../src/time";
import { Duration } from "../src/duration";
import { Summary } from "../src/summary";

describe("toDuration", () => {
  test("accepts time range", () => {
    const range = new Range(new Time(12, 0), new Time(14, 30));
    const entry = new Entry(range);

    expect(entry.toDuration()).toEqual(new Duration(2, 30));
  });

  test("accepts duration - and clones it", () => {
    const duration = new Duration(1, 30);
    const entry = new Entry(duration);

    expect(entry.toDuration()).toEqual(new Duration(1, 30));
    expect(entry.value).toBe(duration); // Inner value should be the same object
    expect(entry.toDuration()).not.toBe(duration); // `toDuration` should clone
  });

  test("gives an empty duration for an open time range", () => {
    const range = new Range(new Time(12, 0));
    const entry = new Entry(range);

    expect(range.open).toEqual(true);
    expect(entry.toDuration()).toEqual(new Duration(0, 0));
  });
});

test("toMinutes", () => {
  const range = new Range(new Time(12, 0), new Time(13, 11));
  const entry1 = new Entry(range);
  expect.soft(entry1.toMinutes()).toEqual(71);

  const duration = new Duration(4, 0);
  const entry2 = new Entry(duration);
  expect.soft(entry2.toMinutes()).toEqual(240);
});

describe("toString", () => {
  test("default indentation", () => {
    const range = new Range(new Time(12, 0), new Time(13, 11));
    const entry1 = new Entry(range);
    expect.soft(entry1.toString()).toEqual("    12:00 - 13:11");

    const duration = new Duration(4, 0);
    const entry2 = new Entry(duration);
    expect.soft(entry2.toString()).toEqual("    4h");
  });

  test("custom indentation", () => {
    const range = new Range(new Time(9, 0), new Time(17, 30));
    const entry1 = new Entry(range);
    expect(entry1.toString("  ")).toEqual("  9:00 - 17:30");

    const duration = new Duration(0, -31);
    const entry2 = new Entry(duration);
    expect(entry2.toString("\t")).toEqual("\t-31m");
  });

  test("with summary", () => {
    const range = new Range(new Time(10, 0), new Time(10, 30));
    const summary1 = new Summary("Morning #standup");
    const entry1 = new Entry(range, summary1);
    expect(entry1.toString()).toEqual("    10:00 - 10:30 Morning #standup");

    const duration = Duration.fromMinutes(-90);
    const summary2 = new Summary(["Lunch break", "And also shopping"]);
    const entry2 = new Entry(duration, summary2);
    expect(entry2.toString("\t")).toEqual(
      "\t-1h30m Lunch break\n\t\tAnd also shopping",
    );

    // TODO: test for auto starting on next line.
    // Should maybe be a `maxLineWidth` option or something similar.
  });
});

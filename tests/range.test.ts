import { describe, expect, test } from "vitest";
import { Range, RangeDashFormat } from "../src/range";
import { DayShift, Time, TimeFormat } from "../src/time";
import { KlogDuration } from "../src/duration";

const areDurationsEqual = (a: unknown, b: unknown) => {
  const aIsDuration = a instanceof KlogDuration;
  const bIsDuration = b instanceof KlogDuration;

  if (aIsDuration && bIsDuration) return a.equals(b);
  else if (aIsDuration === bIsDuration) return undefined;
  else return false;
};

expect.addEqualityTesters([areDurationsEqual]);

test("creates a normal range", () => {
  const start = new Time(10, 35);
  const end = new Time(14, 50);
  const range = new Range(start, end);

  expect(range.start).toBe(start);
  expect(range.end).toBe(end);
});

test("creates an open range", () => {
  const start = new Time(10, 35);
  const range = new Range(start);

  expect(range.start).toBe(start);
  expect(range.end).toBeNull;
  expect(range.open).toEqual(true);
  expect(range.toMinutes()).toEqual(0);
});

test("supports creating with same start & end time", () => {
  const time = new Time(10, 35);
  const range = new Range(time, time);

  expect(range.start).toBe(time);
  expect(range.end).toBe(time);
  expect(range.toMinutes()).toEqual(0);
});

test("throws error if start is after end", () => {
  const start = new Time(15, 0);
  const end = new Time(14, 0);

  expect(() => new Range(start, end)).toThrow();
});

test("throws error if trying to set end to before the start after construction", () => {
  const start = new Time(12, 0);
  const end1 = new Time(14, 0);
  const end2 = new Time(11, 0);
  const range = new Range(start, end1);

  expect(range.end).toBe(end1);
  expect(() => (range.end = end2)).toThrow();
});

test("supports creating with time starting yesterday", () => {
  const start = new Time(23, 25, DayShift.Yesterday);
  const end = new Time(11, 0);
  const range = new Range(start, end);

  expect(range.toMinutes()).toEqual(695);
});

test("supports creating with time ending tomorrow", () => {
  const start = new Time(22, 0);
  const end = new Time(3, 0, DayShift.Tomorrow);
  const range = new Range(start, end);

  expect(range.toMinutes()).toEqual(300);
});

test("toMinutes", () => {
  const range1 = new Range(new Time(12, 5), new Time(13, 30));
  expect.soft(range1.toMinutes()).toEqual(85);

  const range2 = new Range(new Time(23, 0, DayShift.Yesterday), new Time(2, 0));
  expect.soft(range2.toMinutes()).toEqual(180);

  const range3 = new Range(new Time(24, 0), new Time(3, 15, DayShift.Tomorrow));
  expect.soft(range3.toMinutes()).toEqual(195);

  const range4 = new Range(new Time(11, 30));
  expect.soft(range4.toMinutes()).toEqual(0);
});

test("toDuration", () => {
  const range1 = new Range(new Time(12, 3), new Time(12, 42));
  expect.soft(range1.toDuration()).toEqual(new KlogDuration(0, 39));

  const range2 = new Range(
    new Time(21, 42, DayShift.Yesterday),
    new Time(3, 45)
  );
  expect.soft(range2.toDuration()).toEqual(new KlogDuration(6, 3));

  const range3 = new Range(
    new Time(23, 30),
    new Time(3, 30, DayShift.Tomorrow)
  );
  expect.soft(range3.toDuration()).toEqual(new KlogDuration(4, 0));

  const range4 = new Range(new Time(11, 30));
  expect.soft(range4.toDuration()).toEqual(new KlogDuration(0, 0));
});

describe("toString", () => {
  test("closed range", () => {
    const start = new Time(11, 25);
    const end = new Time(15, 11);
    const range = new Range(start, end);

    expect(range.toString()).toEqual("11:25 - 15:11");

    start.format = TimeFormat.TwelveHour;
    end.format = TimeFormat.TwelveHour;
    expect(range.toString()).toEqual("11:25am - 3:11pm");
  });

  test("open range", () => {
    const start = new Time(13, 1);
    const range = new Range(start);

    expect(range.toString()).toEqual("13:01 - ?");
  });

  test("custom option for no spacing", () => {
    const start = new Time(11, 25);
    const end = new Time(15, 11);
    const range = new Range(start, end, { format: RangeDashFormat.NoSpaces });

    expect(range.toString()).toEqual("11:25-15:11");
  });

  test("custom number of placeholder characters in open range", () => {
    const start = new Time(9, 12);
    const range = new Range(start, null, { openRangePlaceholderCharCount: 5 });

    expect(range.toString()).toEqual("9:12 - ?????");
  });

  test("both custom formatting options", () => {
    const start = new Time(12, 33);
    const range = new Range(start, null, {
      format: RangeDashFormat.NoSpaces,
      openRangePlaceholderCharCount: 3,
    });

    expect(range.toString()).toEqual("12:33-???");
  });
});

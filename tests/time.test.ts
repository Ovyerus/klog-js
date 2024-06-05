import { describe, expect, test } from "vitest";
import { DayShift, Time, TimeFormat } from "../src/time";

describe("24:00 special case", () => {
  test("today", () => {
    const time = new Time(24, 0);
    expect(time.hour).toEqual(0);
    expect(time.minute).toEqual(0);
    expect(time.dayShift).toEqual(DayShift.Tomorrow);
  });

  test("yesterday", () => {
    const time = new Time(24, 0, DayShift.Yesterday);
    expect(time.hour).toEqual(0);
    expect(time.minute).toEqual(0);
    expect(time.dayShift).toEqual(DayShift.Today);
  });

  test("tomorrow cannot be represented", () => {
    expect(() => new Time(24, 0, DayShift.Tomorrow)).toThrow();
  });
});

test("rejects invalid times", () => {
  const times: [hour: number, minute: number][] = [
    [24, 1],
    [25, 30],
    [124, 34],
    [-12, 34],

    [5, 60],
    [5, 61],
    [5, 245],
    [5, -21],

    [1575, 28293],
  ];

  for (const [hour, minute] of times) {
    expect(
      () => new Time(hour, minute),
      `Time should not accept ${hour}:${minute}`
    ).toThrow();
  }
});

test("equals", () => {
  expect(new Time(0, 0).equals(new Time(0, 0))).toBe(true);
});

test("afterOrEquals", () => {
  expect.soft(new Time(0, 0).afterOrEquals(new Time(0, 0))).toBe(true);
  expect.soft(new Time(12, 31).afterOrEquals(new Time(12, 30))).toBe(true);
  expect
    .soft(new Time(13, 0).afterOrEquals(new Time(14, 0, DayShift.Yesterday)))
    .toBe(true);
  expect
    .soft(new Time(12, 0, DayShift.Tomorrow).afterOrEquals(new Time(13, 1)))
    .toBe(true);
});

test("toMinutesSinceMidnight", () => {
  expect.soft(new Time(0, 0).toMinutesSinceMidnight()).toEqual(0);
  expect.soft(new Time(0, 1).toMinutesSinceMidnight()).toEqual(1);
  expect.soft(new Time(14, 59).toMinutesSinceMidnight()).toEqual(899);
  expect.soft(new Time(23, 59).toMinutesSinceMidnight()).toEqual(1439);
  expect
    .soft(new Time(18, 35, DayShift.Yesterday).toMinutesSinceMidnight())
    .toEqual(-325);
  expect
    .soft(new Time(5, 35, DayShift.Tomorrow).toMinutesSinceMidnight())
    .toEqual(1775);
});

describe("toString", () => {
  test("serialises normal time in various formats", () => {
    expect(new Time(13, 45).toString()).toEqual("13:45");
    expect(new Time(15, 5).toString(TimeFormat.TwentyFourHour)).toEqual(
      "15:05"
    );
    expect(new Time(7, 23).toString(TimeFormat.TwelveHour)).toEqual("7:23am");
  });

  test("doesn't have leading zeroes", () => {
    const time = new Time(8, 15);
    expect(time.toString()).toEqual("8:15");
    expect(time.toString(TimeFormat.TwelveHour)).toEqual("8:15am");
  });

  test("serialises yesterday shifted times", () => {
    const time = new Time(21, 13, DayShift.Yesterday);
    expect(time.toString()).toEqual("<21:13");
    expect(time.toString(TimeFormat.TwelveHour)).toEqual("<9:13pm");
  });

  test("serialises tomorrow shifted times", () => {
    const time = new Time(3, 34, DayShift.Tomorrow);
    expect(time.toString()).toEqual("3:34>");
    expect(time.toString(TimeFormat.TwelveHour)).toEqual("3:34am>");
  });

  test("serialises 12 o'clocks for am/pm time", () => {
    expect(new Time(0, 0).toString(TimeFormat.TwelveHour)).toEqual("12:00am");
    expect(new Time(12, 0).toString(TimeFormat.TwelveHour)).toEqual("12:00pm");
  });
});

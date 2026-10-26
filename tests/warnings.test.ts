import { afterEach, describe, expect, test, vi } from "vitest";
import { Duration, Entry, parse, Range, Record, Time } from "../src/index";

const now = new Date(2024, 4, 5, 12, 0);
const record = (entries: string, date = "2024-05-05") =>
  parse(
    `${date}\n${entries
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")}`,
  )[0];
const codes = (value: Record, reference = now) =>
  value.getWarnings({ now: reference }).map((warning) => warning.code);

afterEach(() => vi.useRealTimers());

describe("record warnings", () => {
  test("returns no warnings for an ordinary record", () => {
    expect(record("8:00 - 10:00\n-15m Break").getWarnings({ now })).toEqual([]);
  });

  test("uses the current time by default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(codes(record("12:31 - ?"))).toEqual(["FUTURE_ENTRIES"]);
    expect(record("12:31 - ?").getWarnings()).toEqual([
      { code: "FUTURE_ENTRIES", message: "Entry in the future" },
    ]);
  });

  test("returns stable structured warnings in category order, once per category", () => {
    const warnings = record(
      "14:00 - 16:00\n15:00 - 17:00\n15:30 - 16:30\n30h",
    ).getWarnings({ now });
    expect(warnings).toEqual([
      { code: "FUTURE_ENTRIES", message: "Entry in the future" },
      { code: "OVERLAPPING_RANGES", message: "Overlapping time ranges" },
      { code: "MORE_THAN_24H", message: "Total time exceeds 24 hours" },
    ]);
  });

  test("warnings neither mutate the record nor alter totals/serialisation", () => {
    const value = record(
      "11:00 - 13:00\n9:00 - 12:00\n25h\n10:00 - ?",
      "2024-05-02",
    );
    const entries = value.entries.slice();
    const original = value.toString();
    const total = value.toMinutes();
    const reference = now.getTime();
    const result = value.getWarnings({ now });
    expect(result.map((warning) => warning.code)).toEqual([
      "UNCLOSED_OPEN_RANGE",
      "OVERLAPPING_RANGES",
      "MORE_THAN_24H",
    ]);
    expect(value.entries).toEqual(entries);
    entries.forEach((entry, index) => expect(value.entries[index]).toBe(entry));
    expect(value.toString()).toBe(original);
    expect(value.toMinutes()).toBe(total);
    expect(now.getTime()).toBe(reference);
    expect(value.getWarnings({ now })).toEqual(result);
    result.length = 0;
    expect(value.getWarnings({ now })).toHaveLength(3);
  });

  test("recomputes after callers edit entries", () => {
    const value = record("9:00 - 10:00");
    expect(codes(value)).toEqual([]);
    value.entries.push(new Entry(new Range(new Time(9, 30), new Time(10, 30))));
    expect(codes(value)).toEqual(["OVERLAPPING_RANGES"]);
  });

  test("works with programmatically constructed records", () => {
    const value = new Record(new Date(2024, 4, 5), [
      new Entry(new Duration(25, 0)),
    ]);
    expect(codes(value)).toEqual(["MORE_THAN_24H"]);
  });

  test("rejects an invalid reference date explicitly", () => {
    expect(() => record("1h").getWarnings({ now: new Date(NaN) })).toThrow(
      /reference date/i,
    );
  });

  test("rejects an invalid record date explicitly", () => {
    expect(() => new Record(new Date(NaN)).getWarnings({ now })).toThrow(
      /record date/i,
    );
  });
});

describe("overlapping ranges", () => {
  test.each([
    ["8:00 - 9:00\n8:30 - 9:30", true],
    ["8:30 - 9:30\n8:00 - 9:00", true],
    ["8:00 - 12:00\n9:00 - 10:00", true],
    ["8:00 - 9:00\n8:00 - 9:00", true],
    ["8:00 - 9:00\n9:00 - 10:00", false],
    ["8:00 - 9:00\n10:00 - 11:00", false],
    ["8:00 - 12:00\n9:00 - 9:00", false],
    ["8:00 - 8:00\n8:00 - 12:00", false],
    ["8:00 - 12:00\n9:00 - 9:00\n10:00 - 10:00", false],
    ["0m\n-1h\n1h", false],
    ["<23:00 - 1:00\n0:30 - 2:00", true],
    ["<23:00 - <23:30\n23:00 - 23:30", false],
    ["1:00> - 2:00>\n1:30> - 3:00>", true],
    ["23:00 - 24:00\n0:00> - 1:00>", false],
    ["8:00 - 10:00\n9:00 - ?", true],
    ["9:00 - ?\n8:00 - 10:00", true],
    ["8:00 - 9:00\n9:00 - ?", false],
    ["23:59 - ?\n23:59 - 24:00", false],
    ["1:00> - ?\n1:00> - 2:00>", false],
  ] as const)("checks %j without changing totals", (text, overlaps) => {
    const value = record(text, "2024-05-04");
    const total = value.toMinutes();
    expect(codes(value).includes("OVERLAPPING_RANGES")).toBe(overlaps);
    expect(value.toMinutes()).toBe(total);
  });

  test("handles many equal-start ranges including empty ones", () => {
    expect(
      codes(record("8:00 - 8:00\n8:00 - 9:00\n8:00 - 8:00\n8:00 - 10:00")),
    ).toEqual(["OVERLAPPING_RANGES"]);
  });
});

describe("total exceeding 24 hours", () => {
  test.each([
    ["24h", false],
    ["24h1m", true],
    ["25h\n-1h", false],
    ["-25h", false],
    ["0m", false],
    ["23h\n2h", true],
    ["0:00 - 24:00\n-1m", false],
    ["<23:00 - 1:00>", true],
    ["24h\n9:00 - ?", false],
  ] as const)("checks net total for %j", (text, excessive) => {
    expect(codes(record(text)).includes("MORE_THAN_24H")).toBe(excessive);
  });
});

describe("future entries", () => {
  test.each([
    ["12:00 - 12:30", "2024-05-05", false],
    ["12:00 - 12:31", "2024-05-05", true],
    ["12:31 - ?", "2024-05-05", true],
    ["12:30 - ?", "2024-05-05", false],
    ["1h", "2024-05-05", false],
    ["1h", "2024-05-06", true],
    ["0m", "2024-05-06", true],
    ["-1h", "2024-05-06", true],
    ["1h", "2024-05-04", false],
    ["<11:00 - <12:30", "2024-05-06", false],
    ["<11:00 - <12:31", "2024-05-06", true],
    ["<11:00 - <12:30\n1h", "2024-05-06", true],
    ["1:00> - 3:00>", "2024-05-05", true],
    ["13:00> - ?", "2024-05-04", true],
    ["<23:00 - ?", "2024-05-06", true],
    ["1h", "2024-05-10", true],
  ] as const)("checks %j on %s", (text, date, future) => {
    expect(codes(record(text, date)).includes("FUTURE_ENTRIES")).toBe(future);
  });

  test("does not warn about an empty future record or its target", () => {
    const value = parse("2024-05-10 (8h!)\nPlanned work")[0];
    expect(codes(value)).toEqual([]);
  });

  test("applies grace across midnight using calendar days and day shifts", () => {
    const reference = new Date(2024, 4, 5, 23, 50);
    expect(codes(record("23:00 - 0:20>"), reference)).toEqual([]);
    expect(codes(record("23:00 - 0:21>"), reference)).toEqual([
      "FUTURE_ENTRIES",
    ]);
    expect(codes(record("0:20 - ?", "2024-05-06"), reference)).toEqual([]);
    expect(codes(record("0:21 - ?", "2024-05-06"), reference)).toEqual([
      "FUTURE_ENTRIES",
    ]);
  });
});

describe("stale open ranges", () => {
  test.each([
    ["2024-05-02", true],
    ["2024-05-03", true],
    ["2024-05-04", false],
    ["2024-05-05", false],
    ["2024-05-06", false],
  ] as const)("checks record date %s", (date, stale) => {
    expect(
      codes(record("9:00 - ?", date)).includes("UNCLOSED_OPEN_RANGE"),
    ).toBe(stale);
  });

  test("does not report closed historical ranges", () => {
    expect(codes(record("9:00 - 10:00", "2024-01-01"))).toEqual([]);
  });

  test("uses calendar days rather than elapsed 24-hour periods", () => {
    const value = record("23:00 - ?", "2024-03-29");
    expect(codes(value, new Date(2024, 2, 31, 0, 5))).toEqual([
      "UNCLOSED_OPEN_RANGE",
    ]);
  });
});

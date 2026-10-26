import { describe, expect, test } from "vitest";
import {
  Duration,
  Entry,
  parse,
  Range,
  RangeDashFormat,
  Record,
  RecordDateFormat,
  Summary,
  Time,
  TimeFormat,
} from "../src/index";
import type { RecordFormatOptions } from "../src/index";

const sample = () =>
  parse(`2024-05-05 (8h!)
Day #work
note
    <23:00 - 1:00 Cross day
        continuation
    +2h Build
    -30m Break
    -0m Zero
    2:00pm-15:00 Mixed
    16:00 - ??? Ongoing
`)[0];

const formatted = `2024/05/05 (+8h!)
Day #work
note
	<11:00pm-1:00am Cross day
		continuation
	+2h Build
	-30m Break
	+0m Zero
	2:00pm-3:00pm Mixed
	4:00pm-????? Ongoing`;

const options: RecordFormatOptions = {
  indentation: "\t",
  dateFormat: RecordDateFormat.Slashes,
  timeFormat: TimeFormat.TwelveHour,
  rangeDashFormat: RangeDashFormat.NoSpaces,
  duration: { explicitPositive: true, zeroSign: "+" },
  openRangePlaceholderCharCount: 5,
};

describe("record rendering overrides", () => {
  test("applies formatting consistently across entries, endpoints, and target", () => {
    expect(sample().toString(options)).toBe(formatted);
  });

  test("preserves existing behavior when no options or empty options are given", () => {
    const value = sample();
    expect(value.toString({})).toBe(value.toString());
    expect(value.toString({ timeFormat: undefined, duration: {} })).toBe(
      value.toString(),
    );
    expect(value.toString()).toContain("    2:00pm-15:00 Mixed");
    // The parsed first endpoint retains its own 12-hour display style.
    expect((value.entries[4].value as Range).start.format).toBe(
      TimeFormat.TwelveHour,
    );
  });

  test("retains mixed endpoint styles when time format is omitted", () => {
    const range = new Range(
      new Time(9, 0, undefined, TimeFormat.TwelveHour),
      new Time(15, 0),
    );
    const value = new Record(new Date(2024, 4, 5), [new Entry(range)]);
    expect(value.toString({ indentation: "  " })).toBe(
      "2024-05-05\n  9:00am - 15:00",
    );
  });

  test("does not mutate nested values, identities, totals, or caller options", () => {
    const value = sample();
    const before = JSON.stringify(value);
    const original = value.toString();
    const entries = value.entries.slice();
    const lines = value.entries[0].summary!.lines;
    const target = value.shouldTotal;
    const total = value.toMinutes();
    const frozenOptions = Object.freeze({
      ...options,
      duration: Object.freeze({ ...options.duration }),
    });
    expect(value.toString(frozenOptions)).toBe(formatted);
    expect(value.toString(frozenOptions)).toBe(formatted);
    expect(JSON.stringify(value)).toBe(before);
    expect(value.toString()).toBe(original);
    expect(value.toMinutes()).toBe(total);
    expect(value.shouldTotal).toBe(target);
    expect(value.entries[0].summary!.lines).toBe(lines);
    entries.forEach((entry, index) => expect(value.entries[index]).toBe(entry));
  });

  test.each(["  ", "   ", "    ", "\t"] as const)(
    "indents entries once and continuations twice using %j",
    (indentation) => {
      const text = sample().toString({ indentation });
      expect(text).toContain(
        `\n${indentation}<23:00 - 1:00 Cross day\n${indentation}${indentation}continuation`,
      );
      expect(parse(text)[0].toMinutes()).toBe(sample().toMinutes());
    },
  );

  test.each(["\n", "\r\n"] as const)(
    "uses %j throughout multiline summaries and headers",
    (newline) => {
      const text = sample().toString({ ...options, newline });
      expect(text).toBe(formatted.replaceAll("\n", newline));
      expect(text.split(newline)).toHaveLength(10);
      expect(parse(text)[0].summary?.lines).toEqual(["Day #work", "note"]);
    },
  );

  test("normalizes existing CRLF summary text when a newline override is explicit", () => {
    const value = new Record(new Date(2024, 4, 5), [
      new Entry(new Duration(1, 0), new Summary("one\r\ntwo")),
    ]);
    expect(value.toString({ newline: "\r\n" })).toBe(
      "2024-05-05\r\n    1h one\r\n        two",
    );
    expect(value.toString({ newline: "\n" })).toBe(
      "2024-05-05\n    1h one\n        two",
    );
  });

  test("preserves empty-record and summary-only ending behavior with CRLF", () => {
    const empty = new Record(new Date(2024, 4, 5));
    expect(empty.toString({ newline: "\r\n" })).toBe("2024-05-05\r\n");
    empty.summary = new Summary("X\nY");
    expect(empty.toString({ newline: "\r\n" })).toBe(
      "2024-05-05\r\nX\r\nY\r\n",
    );
  });

  test("overrides a stored slash date with enum zero without changing the getter", () => {
    const value = new Record(
      new Date(2024, 4, 5),
      [],
      null,
      null,
      RecordDateFormat.Slashes,
    );
    expect(value.toString({ dateFormat: RecordDateFormat.Dashes })).toBe(
      "2024-05-05\n",
    );
    expect(value.dateString).toBe("2024/05/05");
  });

  test.each([0, -60, 60])(
    "applies signs to a %i-minute target and duration entry",
    (minutes) => {
      const value = new Record(
        new Date(2024, 4, 5),
        [new Entry(Duration.fromMinutes(minutes))],
        null,
        Duration.fromMinutes(minutes),
      );
      const expected = minutes === 0 ? "-0m" : minutes < 0 ? "-1h" : "+1h";
      expect(
        value.toString({ duration: { explicitPositive: true, zeroSign: "-" } }),
      ).toBe(`2024-05-05 (${expected}!)\n    ${expected}`);
      const reparsed = parse(
        value.toString({
          duration: { explicitPositive: true, zeroSign: "-" },
        }),
      )[0];
      // -0 and +0 represent the same whole-minute target; the string above
      // separately verifies the requested display sign.
      expect(reparsed.shouldTotal?.toMinutes() === minutes).toBe(true);
    },
  );

  test("keeps a next-line summary and user alignment stable", () => {
    const value = parse(
      "2024-05-05\n    1h\n        next\n          aligned",
    )[0];
    const text = value.toString({ indentation: "  " });
    expect(text).toBe("2024-05-05\n  1h \n    next\n      aligned");
    expect(parse(text)[0].entries[0].summary?.lines).toEqual([
      "",
      "next",
      "  aligned",
    ]);
  });
});

describe("duration rendering overrides", () => {
  test("can explicitly add or remove positive signs without mutation", () => {
    const plain = new Duration(2, 3);
    const signed = new Duration(2, 3, { explicitPositive: true });
    expect(plain.toString({ explicitPositive: true })).toBe("+2h3m");
    expect(signed.toString({ explicitPositive: false })).toBe("2h3m");
    expect(plain.toString()).toBe("2h3m");
    expect(signed.toString()).toBe("+2h3m");
    expect(plain.explicitPositive).toBe(false);
    expect(signed.explicitPositive).toBe(true);
  });

  test.each(["", "+", "-"] as const)(
    "overrides the zero sign to %j",
    (zeroSign) => {
      const value = new Duration(0, 0, { zeroSign: "-" });
      expect(value.toString({ zeroSign })).toBe(`${zeroSign}0m`);
      expect(value.zeroSign).toBe("-");
      expect(value.sign).toBe("-");
    },
  );

  test("keeps zeroSign independent of explicitPositive and never changes negative signs", () => {
    expect(new Duration(0, 0).toString({ explicitPositive: true })).toBe("0m");
    expect(
      new Duration(-2, -3).toString({ explicitPositive: false, zeroSign: "+" }),
    ).toBe("-2h3m");
  });
});

describe("range and entry rendering overrides", () => {
  test("overrides range enum zero and both endpoint formats without mutation", () => {
    const range = new Range(new Time(9, 0), new Time(15, 0), {
      format: RangeDashFormat.NoSpaces,
    });
    expect(
      range.toString({
        format: RangeDashFormat.Spaces,
        timeFormat: TimeFormat.TwelveHour,
      }),
    ).toBe("9:00am - 3:00pm");
    expect(range.toString()).toBe("9:00-15:00");
    expect(range.format).toBe(RangeDashFormat.NoSpaces);
    expect(range.start.format).toBe(TimeFormat.TwentyFourHour);
  });

  test("overrides open-range placeholder count and retains its stored count", () => {
    const range = new Range(new Time(16, 0), null, {
      openRangePlaceholderCharCount: 3,
    });
    expect(
      range.toString({
        timeFormat: TimeFormat.TwelveHour,
        openRangePlaceholderCharCount: 5,
      }),
    ).toBe("4:00pm - ?????");
    expect(range.toString()).toBe("16:00 - ???");
    expect(range.openRangePlaceholderCharCount).toBe(3);
    expect(range.end).toBeNull();
  });

  test.each([0, -1, 1.5, NaN, Infinity])(
    "rejects invalid placeholder override %j without changing state",
    (count) => {
      const value = sample();
      const original = value.toString();
      expect(() =>
        value.toString({ openRangePlaceholderCharCount: count }),
      ).toThrow(/placeholder/i);
      expect(value.toString()).toBe(original);
    },
  );

  test("supports standalone entry options and retains legacy indentation arguments", () => {
    const value = new Entry(new Duration(1, 0), new Summary("first\nsecond"));
    expect(
      value.toString({
        indentation: "\t",
        duration: { explicitPositive: true },
      }),
    ).toBe("\t+1h first\n\t\tsecond");
    expect(value.toString("  ")).toBe("  1h first\n    second");
    expect(value.toString(null)).toBe("1h first\nsecond");
    expect(value.toString({ indentation: null })).toBe("1h first\nsecond");
    expect(value.toString({})).toBe(value.toString());
  });

  test("propagates standalone entry time and dash overrides", () => {
    const value = new Entry(new Range(new Time(14, 0), new Time(15, 0)));
    expect(
      value.toString({
        timeFormat: TimeFormat.TwelveHour,
        rangeDashFormat: RangeDashFormat.NoSpaces,
      }),
    ).toBe("    2:00pm-3:00pm");
  });
});

describe("formatted record round trips", () => {
  for (const indentation of ["  ", "   ", "    ", "\t"] as const) {
    for (const newline of ["\n", "\r\n"] as const) {
      test.each([TimeFormat.TwelveHour, TimeFormat.TwentyFourHour])(
        `preserves semantics with ${JSON.stringify(indentation)}, ${JSON.stringify(newline)}, %s`,
        (timeFormat) => {
          const value = sample();
          const formatOptions = {
            ...options,
            indentation,
            newline,
            timeFormat,
          };
          const text = value.toString(formatOptions);
          const reparsed = parse(text)[0];
          expect(reparsed.toMinutes()).toBe(value.toMinutes());
          expect(reparsed.shouldTotal?.toMinutes()).toBe(480);
          expect(reparsed.entries).toHaveLength(6);
          expect(reparsed.entries.map((entry) => entry.summary?.lines)).toEqual(
            value.entries.map((entry) => entry.summary?.lines),
          );
          expect((reparsed.entries[0].value as Range).start.dayShift).toBe(-1);
          expect(reparsed.openEntry?.value.toMinutes()).toBe(0);
          expect(reparsed.toString(formatOptions)).toBe(text);
        },
      );
    }
  }
});

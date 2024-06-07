import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseAST } from "../src/parser";
import { DayShift, TimeFormat } from "../src/time";
import { RangeDashFormat } from "../src/range";
import multipleResult from "./result/multiple";
import sameDayResult from "./result/same-day";
import singleResult from "./result/single";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readCorpus = (file: string) =>
  fs.readFile(join(__dirname, "./corpus/", file), "utf-8");

const singleRecord = await readCorpus("single.klg");
const multipleRecords = await readCorpus("multiple.klg");
const emptyFile = await readCorpus("empty.klg");
const noEntries = await readCorpus("no-entries.klg");
const someEntries = await readCorpus("some-entries.klg");
const sameDay = await readCorpus("same-day.klg");

describe("full files", () => {
  test("parses file with single record", () => {
    const result = parseAST(singleRecord);
    expect(result).toEqual(singleResult);
  });

  test("parses file with multiple records", () => {
    const result = parseAST(multipleRecords);
    expect(result).toEqual(multipleResult);
  });

  test("parses empty file", () => {
    const result = parseAST(emptyFile);
    expect(result).toEqual({ type: "file", records: [] });
  });

  test("parses file that has all records with no entries", () => {
    const result = parseAST(noEntries);
    expect(result).toEqual({
      type: "file",
      records: [
        {
          type: "record",
          date: new Date(2024, 3, 29),
          shouldTotal: null,
          summary: null,
          entries: [],
        },
        {
          type: "record",
          date: new Date(2024, 3, 30),
          shouldTotal: null,
          summary: "Cool day I think",
          entries: [],
        },
      ],
    });
  });

  test("parses file that has some records with no entries", () => {
    const result = parseAST(someEntries);
    expect(result).toEqual({
      type: "file",
      records: [
        {
          type: "record",
          date: new Date(2024, 3, 28),
          shouldTotal: null,
          summary: null,
          entries: [
            {
              type: "entry",
              summary: null,
              value: { type: "duration", sign: "", value: 420 },
            },
          ],
        },
        {
          type: "record",
          date: new Date(2024, 3, 29),
          shouldTotal: null,
          summary: null,
          entries: [],
        },
        {
          type: "record",
          date: new Date(2024, 3, 30),
          shouldTotal: null,
          summary: "Cool day I think",
          entries: [],
        },
      ],
    });
  });

  test("parses file with records on the same day", () => {
    const result = parseAST(sameDay);
    expect(result).toEqual(sameDayResult);
  });
});

describe("date", () => {
  test("with recommended dashes", () => {
    const result = parseAST("2024-04-29", "date");
    expect(result).toEqual(new Date(2024, 3, 29));
  });

  test("with slashes", () => {
    const result = parseAST("2024/04/29", "date");
    expect(result).toEqual(new Date(2024, 3, 29));
  });

  test("doesn't allow mixed dividers", () => {
    expect(() => parseAST("2024-04/29", "date")).toThrow();
  });

  test("only allows valid calendar dates", () => {
    expect(() => parseAST("2024-04-31", "date")).toThrowError("Invalid date");
    expect(() => parseAST("2020-13-01", "date")).toThrowError("Invalid date");
  });
});

describe("durations", () => {
  describe("minutes", () => {
    test("implicit positive", () => {
      const result = parseAST("45m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "",
        value: 45,
      });
    });

    test("explicit positive", () => {
      const result = parseAST("+39m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "+",
        value: 39,
      });
    });

    test("negative", () => {
      const result = parseAST("-5m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "-",
        value: -5,
      });
    });

    test("big values", () => {
      expect(parseAST("1337m", "duration")).toEqual({
        type: "duration",
        sign: "",
        value: 1337,
      });
      expect(parseAST("-90001m", "duration")).toEqual({
        type: "duration",
        sign: "-",
        value: -90001,
      });
    });
  });

  describe("hours", () => {
    test("implicit positive", () => {
      const result = parseAST("12h", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "",
        value: 720,
      });
    });

    test("explicit positive", () => {
      const result = parseAST("+2h", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "+",
        value: 120,
      });
    });

    test("negative", () => {
      const result = parseAST("-5h", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "-",
        value: -300,
      });
    });
  });

  describe("combined", () => {
    test("implicit positive", () => {
      const result = parseAST("1h23m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "",
        value: 83,
      });
    });

    test("explicit positive", () => {
      const result = parseAST("+3h38m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "+",
        value: 218,
      });
    });

    test("negative", () => {
      const result = parseAST("-15h48m", "duration");
      expect(result).toEqual({
        type: "duration",
        sign: "-",
        value: -948,
      });
    });

    test("single digit minutes", () => {
      expect(parseAST("2h3m", "duration")).toEqual({
        type: "duration",
        sign: "",
        value: 123,
      });
      expect(parseAST("5h9m", "duration")).toEqual({
        type: "duration",
        sign: "",
        value: 309,
      });
    });

    test("allows 0 values", () => {
      expect(parseAST("0h37m", "duration")).toEqual({
        type: "duration",
        sign: "",
        value: 37,
      });
      expect(parseAST("7h0m", "duration")).toEqual({
        type: "duration",
        sign: "",
        value: 420,
      });
    });

    test("does not allow >59 minutes", () => {
      expect(() => parseAST("1h60h", "duration")).toThrow();
      expect(() => parseAST("1h959h", "duration")).toThrow();
    });
  });
});

describe("times", () => {
  describe("12 hour", () => {
    test("parses a variety of AM/PM times correctly", () => {
      expect(parseAST("10:25am", "time")).toEqual({
        type: "time",
        hour: 10,
        minute: 25,
        format: TimeFormat.TwelveHour,
        shift: DayShift.Today,
      });
      expect(parseAST("07:12am", "time")).toEqual({
        type: "time",
        hour: 7,
        minute: 12,
        format: TimeFormat.TwelveHour,
        shift: DayShift.Today,
      });
      expect(parseAST("11:23pm", "time")).toEqual({
        type: "time",
        hour: 23,
        minute: 23,
        format: TimeFormat.TwelveHour,
        shift: DayShift.Today,
      });
      expect(parseAST("6:51pm", "time")).toEqual({
        type: "time",
        hour: 18,
        minute: 51,
        format: TimeFormat.TwelveHour,
        shift: DayShift.Today,
      });
    });

    test("parses both 12 o'clocks correctly", () => {
      expect.soft(parseAST("12:00am", "time")).toEqual({
        type: "time",
        hour: 0,
        minute: 0,
        shift: DayShift.Today,
        format: TimeFormat.TwelveHour,
      });
      expect.soft(parseAST("12:00pm", "time")).toEqual({
        type: "time",
        hour: 12,
        minute: 0,
        shift: DayShift.Today,
        format: TimeFormat.TwelveHour,
      });
    });

    test("doesn't parse >12 hours", () => {
      expect(() => parseAST("15:21pm", "time")).toThrow();
    });

    test("doesn't parse >59 minutes", () => {
      expect(() => parseAST("11:99pm", "time")).toThrow();
      expect(() => parseAST("11:427pm", "time")).toThrow();
    });
  });

  describe("24 hour", () => {
    test("parses valid times correctly", () => {
      expect(parseAST("18:11", "time")).toEqual({
        type: "time",
        hour: 18,
        minute: 11,
        format: TimeFormat.TwentyFourHour,
        shift: DayShift.Today,
      });
      expect(parseAST("23:30", "time")).toEqual({
        type: "time",
        hour: 23,
        minute: 30,
        format: TimeFormat.TwentyFourHour,
        shift: DayShift.Today,
      });
    });

    // Holdover from 12-hour time first
    test("treats 12 o'clock correctly", () => {
      expect.soft(parseAST("12:00", "time")).toEqual({
        type: "time",
        hour: 12,
        minute: 0,
        format: TimeFormat.TwentyFourHour,
        shift: DayShift.Today,
      });
      expect.soft(parseAST("12:31", "time")).toEqual({
        type: "time",
        hour: 12,
        minute: 31,
        format: TimeFormat.TwentyFourHour,
        shift: DayShift.Today,
      });
    });

    test("doesn't parse invalid times", () => {
      expect(() => parseAST("25:11", "time")).toThrow();
      expect(() => parseAST("23:100", "time")).toThrow();
    });
  });
});

describe("time ranges", () => {
  describe("closed", () => {
    test("mixed 12/24 hour time", () => {
      expect(parseAST("9:30am - 18:11", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 9,
          minute: 30,
          format: TimeFormat.TwelveHour,
        },
        end: {
          type: "time",
          shift: DayShift.Today,
          hour: 18,
          minute: 11,
          format: TimeFormat.TwentyFourHour,
        },
      });

      expect(parseAST("21:42   -      11:00pm", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 21,
          minute: 42,
          format: TimeFormat.TwentyFourHour,
        },
        end: {
          type: "time",
          shift: DayShift.Today,
          hour: 23,
          minute: 0,
          format: TimeFormat.TwelveHour,
        },
      });
    });

    test("both 12 hour time", () => {
      const result = parseAST("9:21am-1:00pm", "timeRange");
      expect(result).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.NoSpaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 9,
          minute: 21,
          format: TimeFormat.TwelveHour,
        },
        end: {
          type: "time",
          shift: DayShift.Today,
          hour: 13,
          minute: 0,
          format: TimeFormat.TwelveHour,
        },
      });
    });

    test("both 24 hour time", () => {
      const result = parseAST("13:21 -  18:00", "timeRange");
      expect(result).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 13,
          minute: 21,
          format: TimeFormat.TwentyFourHour,
        },
        end: {
          type: "time",
          shift: DayShift.Today,
          hour: 18,
          minute: 0,
          format: TimeFormat.TwentyFourHour,
        },
      });
    });
  });

  describe("open", () => {
    test("allows any amount of question marks", () => {
      const expected = {
        type: "timeRange",
        open: true,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 2,
          minute: 0,
          format: TimeFormat.TwelveHour,
        },
      };

      expect
        .soft(parseAST("2:00am-  ?", "timeRange"))
        .toEqual({ ...expected, placeholderCount: 1 });
      expect
        .soft(parseAST("2:00am  - ???", "timeRange"))
        .toEqual({ ...expected, placeholderCount: 3 });
      expect
        .soft(parseAST("2:00am   -?????????", "timeRange"))
        .toEqual({ ...expected, placeholderCount: 9 });
    });

    test("doesn't allow question mark at the start", () => {
      expect(() => parseAST("? - 13:01")).toThrow();
    });

    test("doesn't allow empty range", () => {
      expect(() => parseAST("2:00am -   ")).toThrow();
      expect(() => parseAST(" -  15:00")).toThrow();
    });
  });

  describe("shifted times", () => {
    test("forward shifted", () => {
      expect(parseAST("13:00 - 3:11am>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 13,
          minute: 0,
          format: TimeFormat.TwentyFourHour,
        },
        end: {
          type: "time",
          shift: DayShift.Tomorrow,
          hour: 3,
          minute: 11,
          format: TimeFormat.TwelveHour,
        },
      });

      expect(parseAST("11:21pm - 13:11>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Today,
          hour: 23,
          minute: 21,
          format: TimeFormat.TwelveHour,
        },
        end: {
          type: "time",
          shift: DayShift.Tomorrow,
          hour: 13,
          minute: 11,
          format: TimeFormat.TwentyFourHour,
        },
      });
    });

    test("backwards shifted (including open range)", () => {
      expect(parseAST("<23:30 - 8:00", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Yesterday,
          hour: 23,
          minute: 30,
          format: TimeFormat.TwentyFourHour,
        },
        end: {
          type: "time",
          shift: DayShift.Today,
          hour: 8,
          minute: 0,
          format: TimeFormat.TwentyFourHour,
        },
      });

      expect(parseAST("<21:00 - ?", "timeRange")).toEqual({
        type: "timeRange",
        open: true,
        format: RangeDashFormat.Spaces,
        placeholderCount: 1,
        start: {
          type: "time",
          shift: DayShift.Yesterday,
          hour: 21,
          minute: 0,
          format: TimeFormat.TwentyFourHour,
        },
      });
    });

    test("both shifted", () => {
      expect(parseAST("<23:30 - 1:30>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        format: RangeDashFormat.Spaces,
        start: {
          type: "time",
          shift: DayShift.Yesterday,
          hour: 23,
          minute: 30,
          format: TimeFormat.TwentyFourHour,
        },
        end: {
          type: "time",
          shift: DayShift.Tomorrow,
          hour: 1,
          minute: 30,
          format: TimeFormat.TwelveHour,
        },
      });
    });
  });
});

describe("entries", () => {
  describe("basic entry with no summary", () => {
    test("duration", () => {
      // 4-space indent
      expect(parseAST("    30m", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "duration" },
      });
      // 3-space indent
      expect(parseAST("   +1h", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "duration" },
      });
      // 2-space indent
      expect(parseAST("  -92m", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "duration" },
      });
      // tab indent
      expect(parseAST("\t5h12m", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "duration" },
      });
    });

    test("time ranges", () => {
      // 4-space indent
      expect(parseAST("    9:30  - 17:11", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "timeRange" },
      });
      // 3-space indent
      expect(parseAST("   <11:00pm-  ??", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "timeRange", open: true },
      });
      // 2-space indent
      expect(parseAST("  22:12 - 4:11am>", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "timeRange" },
      });
      expect(parseAST("\t2:11pm - 3:21pm", "entry")).toMatchObject({
        type: "entry",
        summary: null,
        value: { type: "timeRange" },
      });
    });

    test("rejects invalid indentation", () => {
      expect(() => parseAST("\t  30m", "entry")).toThrow();
      expect(() => parseAST("     11m", "entry")).toThrow();
    });
  });

  describe("entry with summary", () => {
    test("single line summary", () => {
      expect(parseAST("    -45m Lunch break", "entry")).toMatchObject({
        type: "entry",
        summary: "Lunch break",
      });
    });

    describe("wrapped summary", () => {
      test("one wrap", () => {
        // TODO: see how Klog handles wraps... I don't feel like they should be like this
        expect(
          parseAST(
            "\t-120m This is a longer summary, which\n\t\tis continued on the next line.",
            "entry",
          ),
        ).toMatchObject({
          type: "entry",
          summary:
            "This is a longer summary, which\n\t\tis continued on the next line.",
        });
      });

      // TODO: test to make sure blank lines not allowed
      test("many wraps", () => {
        expect(
          parseAST(
            "\t10h First line\n\t\tSecond line with more\n\t\tThird line!!!\n\t\tYet another line woah.",
            "entry",
          ),
        ).toMatchObject({
          type: "entry",
          summary:
            "First line\n\t\tSecond line with more\n\t\tThird line!!!\n\t\tYet another line woah.",
        });
      });

      test("requires double indent", () => {
        expect(() =>
          parseAST("\t2:00 - 5:00 Cool summary\nNo indent!", "entry"),
        ).toThrow();
        expect(() =>
          parseAST("\t2:00 - 5:00 Cool summary\n\tOne indent!", "entry"),
        ).toThrow();
      });
    });
  });
});

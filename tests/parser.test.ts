import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import parse from "../src/parser";

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
    const result = parse(singleRecord);
    expect(result).toMatchFileSnapshot("./result/single.json");
  });

  test("parses file with multiple records", () => {
    const result = parse(multipleRecords);
    expect(result).toMatchFileSnapshot("./result/multiple.json");
  });

  test("parses empty file", () => {
    const result = parse(emptyFile);
    expect(result).toEqual({ type: "file", records: [] });
  });

  // TODO
  test("parses file that has all records with no entries", () => {
    const result = parse(noEntries);
    expect(result).toEqual({
      type: "file",
      records: [
        {
          type: "record",
          date: "2024-04-29",
          shouldTotal: null,
          summary: null,
          entries: [],
        },
        {
          type: "record",
          date: "2024-04-30",
          shouldTotal: null,
          summary: "Cool day I think",
          entries: [],
        },
      ],
    });
  });

  test("parses file that has some records with no entries", () => {
    const result = parse(someEntries);
    expect(result).toEqual({
      type: "file",
      records: [
        {
          type: "record",
          date: "2024-04-28",
          shouldTotal: null,
          summary: null,
          entries: [
            {
              type: "entry",
              summary: null,
              value: { type: "duration", value: { hours: 7, minutes: 0 } },
            },
          ],
        },
        {
          type: "record",
          date: "2024-04-29",
          shouldTotal: null,
          summary: null,
          entries: [],
        },
        {
          type: "record",
          date: "2024-04-30",
          shouldTotal: null,
          summary: "Cool day I think",
          entries: [],
        },
      ],
    });
  });

  test("parses file with records on the same day", () => {
    const result = parse(sameDay);
    expect(result).toMatchFileSnapshot("./result/same-day.json");
  });
});

describe("date", () => {
  test("with recommended dashes", () => {
    const result = parse("2024-04-29", "date");
    expect(result).toEqual("2024-04-29");
  });

  test("with slashes", () => {
    const result = parse("2024/04/29", "date");
    expect(result).toEqual("2024/04/29");
  });

  test("doesn't allow mixed dividers", () => {
    expect(() => parse("2024-04/29", "date")).toThrow();
  });

  test.skip("only allows valid calendar dates");
});

describe("durations", () => {
  // TODO: actual value parsing
  describe("minutes", () => {
    test("implicit positive", () => {
      const result = parse("45m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 0, minutes: 45 },
      });
    });

    test("explicit positive", () => {
      const result = parse("+39m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 0, minutes: 39 },
      });
    });

    test("negative", () => {
      const result = parse("-5m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 0, minutes: -5 },
      });
    });

    test("big values", () => {
      expect(parse("1337m", "duration")).toEqual({
        type: "duration",
        value: { hours: 0, minutes: 1337 },
      });
      expect(parse("-90001m", "duration")).toEqual({
        type: "duration",
        value: { hours: 0, minutes: -90001 },
      });
    });
  });

  describe("hours", () => {
    test("implicit positive", () => {
      const result = parse("12h", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 12, minutes: 0 },
      });
    });

    test("explicit positive", () => {
      const result = parse("+2h", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 2, minutes: 0 },
      });
    });

    test("negative", () => {
      const result = parse("-5h", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: -5, minutes: 0 },
      });
    });

    test("big values", () => {
      expect(parse("75h", "duration")).toEqual({
        type: "duration",
        value: { hours: 75, minutes: 0 },
      });
      expect(parse("-1001h", "duration")).toEqual({
        type: "duration",
        value: { hours: -1001, minutes: 0 },
      });
    });
  });

  describe("combined", () => {
    test("implicit positive", () => {
      const result = parse("1h23m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 1, minutes: 23 },
      });
    });

    test("explicit positive", () => {
      const result = parse("+3h38m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: 3, minutes: 38 },
      });
    });

    test("negative", () => {
      const result = parse("-15h48m", "duration");
      expect(result).toEqual({
        type: "duration",
        value: { hours: -15, minutes: -48 },
      });
    });

    test("single digit minutes", () => {
      expect(parse("2h3m", "duration")).toEqual({
        type: "duration",
        value: { hours: 2, minutes: 3 },
      });
      expect(parse("5h9m", "duration")).toEqual({
        type: "duration",
        value: { hours: 5, minutes: 9 },
      });
    });

    test("big hour values", () => {
      expect(parse("+400h10m", "duration")).toEqual({
        type: "duration",
        value: { hours: 400, minutes: 10 },
      });
      expect(parse("-99999h43m", "duration")).toEqual({
        type: "duration",
        value: { hours: -99999, minutes: -43 },
      });
    });

    test("allows 0 values", () => {
      expect(parse("0h37m", "duration")).toEqual({
        type: "duration",
        value: { hours: 0, minutes: 37 },
      });
      expect(parse("7h0m", "duration")).toEqual({
        type: "duration",
        value: { hours: 7, minutes: 0 },
      });
    });

    test("does not allow >59 minutes", () => {
      expect(() => parse("1h60h", "duration")).toThrow();
      expect(() => parse("1h959h", "duration")).toThrow();
    });
  });
});

describe("times", () => {
  describe("12 hour", () => {
    test("implicit AM time", () => {
      const result = parse("10:30", "time");
      expect(result).toEqual({ type: "time", value: "10:30", shift: null });
    });

    test("parses a variety of AM/PM times correctly", () => {
      expect(parse("10:25am", "time")).toEqual({
        type: "time",
        value: "10:25am",
        shift: null,
      });
      expect(parse("07:12am", "time")).toEqual({
        type: "time",
        value: "07:12am",
        shift: null,
      });
      expect(parse("11:23pm", "time")).toEqual({
        type: "time",
        value: "11:23pm",
        shift: null,
      });
      expect(parse("6:51pm", "time")).toEqual({
        type: "time",
        value: "6:51pm",
        shift: null,
      });
    });

    test("doesn't parse >12 hours", () => {
      expect(() => parse("15:21pm", "time")).toThrow();
    });

    test("doesn't parse >59 minutes", () => {
      expect(() => parse("11:99pm", "time")).toThrow();
      expect(() => parse("11:427pm", "time")).toThrow();
    });
  });

  describe("24 hour", () => {
    test("parses valid times correctly", () => {
      expect(parse("18:11", "time")).toEqual({
        type: "time",
        value: "18:11",
        shift: null,
      });
      expect(parse("23:30", "time")).toEqual({
        type: "time",
        value: "23:30",
        shift: null,
      });
    });

    test("doesn't parse invalid times", () => {
      expect(() => parse("25:11", "time")).toThrow();
      expect(() => parse("23:100", "time")).toThrow();
    });
  });
});

describe("time ranges", () => {
  describe("closed", () => {
    test("mixed 12/24 hour time", () => {
      expect(parse("9:30am - 18:11", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "9:30am" },
        end: { type: "time", shift: null, value: "18:11" },
      });

      expect(parse("21:42   -      11:00pm", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "21:42" },
        end: { type: "time", shift: null, value: "11:00pm" },
      });
    });

    test("both 12 hour time", () => {
      const result = parse("9:21am-1:00pm", "timeRange");
      expect(result).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "9:21am" },
        end: { type: "time", shift: null, value: "1:00pm" },
      });
    });

    test("both 24 hour time", () => {
      const result = parse("13:21 -  18:00", "timeRange");
      expect(result).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "13:21" },
        end: { type: "time", shift: null, value: "18:00" },
      });
    });
  });

  describe("open", () => {
    test("allows any amount of question marks", () => {
      const expected = {
        type: "timeRange",
        open: true,
        start: {
          type: "time",
          shift: null,
          value: "2:00am",
        },
      };

      expect(parse("2:00am-  ?", "timeRange")).toEqual(expected);
      expect(parse("2:00am  - ???", "timeRange")).toEqual(expected);
      expect(parse("2:00am   -?????????", "timeRange")).toEqual(expected);
    });

    test("doesn't allow question mark at the start", () => {
      expect(() => parse("? - 13:01"));
    });

    test("doesn't allow empty range", () => {
      expect(() => parse("2:00am -   ")).toThrow();
      expect(() => parse(" -  15:00")).toThrow();
    });
  });

  describe("shifted times", () => {
    test("forward shifted", () => {
      expect(parse("13:00 - 3:11am>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "13:00" },
        end: { type: "time", shift: "tomorrow", value: "3:11am" },
      });

      expect(parse("11:21pm - 13:11>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: null, value: "11:21pm" },
        end: { type: "time", shift: "tomorrow", value: "13:11" },
      });
    });

    test("backwards shifted (including open range)", () => {
      expect(parse("<23:30 - 8:00", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: "yesterday", value: "23:30" },
        end: { type: "time", shift: null, value: "8:00" },
      });

      expect(parse("<21:00 - ?", "timeRange")).toEqual({
        type: "timeRange",
        open: true,
        start: { type: "time", shift: "yesterday", value: "21:00" },
      });
    });

    test("both shifted", () => {
      expect(parse("<23:30 - 1:30>", "timeRange")).toEqual({
        type: "timeRange",
        open: false,
        start: { type: "time", shift: "yesterday", value: "23:30" },
        end: { type: "time", shift: "tomorrow", value: "1:30" },
      });
    });
  });
});

describe("entries", () => {
  describe("basic entry with no summary", () => {
    test("duration", () => {
      // 4-space indent
      expect(parse("    30m", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: { type: "duration", value: { hours: 0, minutes: 30 } },
      });
      // 3-space indent
      expect(parse("   +1h", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: { type: "duration", value: { hours: 1, minutes: 0 } },
      });
      // 2-space indent
      expect(parse("  -92m", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: { type: "duration", value: { hours: 0, minutes: -92 } },
      });
      // tab indent
      expect(parse("\t5h12m", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: { type: "duration", value: { hours: 5, minutes: 12 } },
      });
    });

    test("time ranges", () => {
      // 4-space indent
      expect(parse("    9:30  - 17:11", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: {
          type: "timeRange",
          open: false,
          start: { type: "time", shift: null, value: "9:30" },
          end: { type: "time", shift: null, value: "17:11" },
        },
      });
      // 3-space indent
      expect(parse("   <11:00pm-  ??", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: {
          type: "timeRange",
          open: true,
          start: { type: "time", shift: "yesterday", value: "11:00pm" },
        },
      });
      // 2-space indent
      expect(parse("  22:12 - 4:11am>", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: {
          type: "timeRange",
          open: false,
          start: { type: "time", shift: null, value: "22:12" },
          end: { type: "time", shift: "tomorrow", value: "4:11am" },
        },
      });
      expect(parse("\t2:11pm - 3:21pm", "entry")).toEqual({
        type: "entry",
        summary: null,
        value: {
          type: "timeRange",
          open: false,
          start: { type: "time", shift: null, value: "2:11pm" },
          end: { type: "time", shift: null, value: "3:21pm" },
        },
      });
    });

    test("rejects invalid indentation", () => {
      expect(() => parse("\t  30m", "entry")).toThrow();
      expect(() => parse("     11m", "entry")).toThrow();
    });
  });

  describe("entry with summary", () => {
    test("single line summary", () => {
      expect(parse("    -45m Lunch break", "entry")).toMatchObject({
        type: "entry",
        summary: "Lunch break",
      });
    });

    describe("wrapped summary", () => {
      test("one wrap", () => {
        // TODO: see how Klog handles wraps... I don't feel like they should be like this
        expect(
          parse(
            "\t-120m This is a longer summary, which\n\t\tis continued on the next line.",
            "entry"
          )
        ).toMatchObject({
          type: "entry",
          summary:
            "This is a longer summary, which\n\t\tis continued on the next line.",
        });
      });

      // TODO: test to make sure blank lines not allowed
      test("many wraps", () => {
        expect(
          parse(
            "\t10h First line\n\t\tSecond line with more\n\t\tThird line!!!\n\t\tYet another line woah.",
            "entry"
          )
        ).toMatchObject({
          type: "entry",
          summary:
            "First line\n\t\tSecond line with more\n\t\tThird line!!!\n\t\tYet another line woah.",
        });
      });

      test("requires double indent", () => {
        expect(() =>
          parse("\t2:00 - 5:00 Cool summary\nNo indent!", "entry")
        ).toThrow();
        expect(() =>
          parse("\t2:00 - 5:00 Cool summary\n\tOne indent!", "entry")
        ).toThrow();
      });
    });
  });
});

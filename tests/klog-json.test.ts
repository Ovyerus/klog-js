import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
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

// Required, not skipped: flake.nix supplies klog-time-tracker. KLOG_BIN can point
// at a newer upstream binary without changing the pinned development shell.
const binary = process.env.KLOG_BIN || "klog";
let configDir: string;
beforeAll(() => {
  configDir = mkdtempSync(join(tmpdir(), "klog-js-json-"));
  // Fail with a useful message if tests were started outside the dev shell.
  try {
    upstream("2000-01-01\n");
  } catch (error) {
    throw new Error(
      "Live JSON comparisons require klog: run `nix develop -c pnpm test` (or set KLOG_BIN).",
      { cause: error },
    );
  }
});
afterAll(() => {
  if (configDir) rmSync(configDir, { recursive: true, force: true });
});

function upstream(source: string) {
  const inputPath = join(configDir, "input.klg");
  writeFileSync(inputPath, source);
  const output = execFileSync(binary, ["json", inputPath], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      HOME: configDir,
      XDG_CONFIG_HOME: configDir,
      NO_COLOR: "1",
      TZ: "UTC",
    },
  });
  const result = JSON.parse(output);
  expect(result.errors).toBeNull();
  return result;
}

const fixtures = [
  ["empty record", "2000-01-01\n"],
  ["record summary", "2000-01-01\nX\nY\n"],
  ["duration signs", "2000-01-01\n    +2h\n    -1h30m\n    +0m\n    -0h\n"],
  ["zero totals", "2000-01-01\n    1h\n    -1h\n"],
  ["large minute duration", "2000-01-01\n    119m\n"],
  ["negative total", "2000-01-01\n    -1h30m\n"],
  ["positive target", "2000-01-01 (8h!)\n    7h\n"],
  ["signed target", "2000-01-01 (+1h!)\n    +2h\n"],
  ["zero target", "2000-01-01 (0m!)\n    1h\n"],
  ["negative zero target", "2000-01-01 (-0m!)\n    0m\n"],
  ["negative target", "2000-01-01 (-3h30m!)\n    -4h\n"],
  ["balanced target", "2000-01-01 (2h!)\n    2h\n"],
  ["mixed time styles", "2000-01-01\n    9:00am-15:00 Work\n"],
  ["open range", "2000-01-01\n    9:00 - ????? Still working\n"],
  ["backward shifts", "2000-01-01\n    <21:00 - <22:00\n"],
  ["forward shifts", "2000-01-01\n    1:00> - 2:00>\n"],
  ["full shifted span", "2000-01-01\n    <23:00 - 1:00>\n"],
  ["forward shifted open", "2000-01-01\n    1:00> - ?\n"],
  ["midnight", "2000-01-01\n    23:00 - 24:00\n"],
  ["shifted midnight", "2000-01-01\n    <24:00 - 1:00\n"],
  ["point-in-time range", "2000-01-01\n    12:00am - 12:00am\n"],
  [
    "multiline summaries",
    "2000-01-01\nX  \nY \n    1h   Aligned  \n          next  \n",
  ],
  ["summary on next line", "2000-01-01\n    1h\n        next\n"],
  ["CRLF", "2000-01-01\r\nSummary\r\n    1h First\r\n        next\r\n"],
  [
    "record and entry tags",
    '2000-01-01\n#B #a #a #Office #empty=""\n    1h #Ticket=AbC #読む #B #b\n',
  ],
  [
    "quoted tag values",
    `2000-01-01\n    1h #a='Ab/c' #b="abc" #c='a"b' #d="it's" #empty='' #blank=\n`,
  ],
  [
    "unfinished quoted values",
    `2000-01-01\n    1h #tag="unfinished\n        #other='also unfinished\n`,
  ],
  ["Unicode tag case", "2000-01-01\n#İ #ΟΣ #ΓΕΙΑ-ΣΑΣ\n    1h #İ #ΟΣ\n"],
  ["Unicode tag ordering", '2000-01-01\n    1h #q="𐐀" #q="￿" #𐐀 #Z #é\n'],
  ["adjacent tags", "2000-01-01\n    1h #A#B#A\n"],
  [
    "repeated unsorted dates",
    "2000-01-02\n    1h\n\n2000-01-01\n    2h\n\n2000-01-02\n    3h\n",
  ],
] as const;

describe("live upstream JSON comparisons", () => {
  test.each(fixtures)("matches klog json: %s", (_name, source) => {
    const expected = upstream(source).records;
    const records = parse(source);
    expect(records.map((record) => record.toKlogJSON())).toEqual(expected);
    records.forEach((record, i) => {
      record.entries.forEach((entry, j) =>
        expect(entry.toKlogJSON()).toEqual(expected[i].entries[j]),
      );
      if (record.summary)
        expect(record.summary.toKlogJSON()).toEqual({
          summary: expected[i].summary,
          tags: expected[i].tags,
        });
    });
  });

  test.each([
    "empty",
    "multiple",
    "no-entries",
    "same-day",
    "single",
    "some-entries",
  ])("matches existing corpus %s", (name) => {
    const source = readFileSync(
      fileURLToPath(new URL(`./corpus/${name}.klg`, import.meta.url)),
      "utf8",
    );
    expect(parse(source).map((record) => record.toKlogJSON())).toEqual(
      upstream(source).records,
    );
  });

  test("reflects a constructed record's stored formats rather than previous rendering overrides", () => {
    const value = new Record(
      new Date(2000, 0, 1),
      [
        new Entry(
          new Range(
            new Time(9, 0, undefined, TimeFormat.TwelveHour),
            new Time(15, 0),
          ),
          new Summary("Work #Project='Ab/c'"),
        ),
        new Entry(new Duration(2, 0, { explicitPositive: true })),
        new Entry(new Duration(0, 0, { zeroSign: "-" })),
      ],
      new Summary("#B #a"),
      new Duration(8, 0, { explicitPositive: true }),
      RecordDateFormat.Slashes,
    );
    const original = value.toString();
    const expected = upstream(original).records[0];
    value.toString({
      timeFormat: TimeFormat.TwentyFourHour,
      dateFormat: RecordDateFormat.Dashes,
      rangeDashFormat: RangeDashFormat.NoSpaces,
    });
    expect(value.toKlogJSON()).toEqual(expected);
    expect(value.toString()).toBe(original);
  });

  test("does not introduce the CLI envelope or warning state into record objects", () => {
    const value = parse("2000-01-01\n    25h\n    8:00 - ?")[0];
    expect(value.toKlogJSON()).toEqual(upstream(value.toString()).records[0]);
    expect(value.toKlogJSON()).not.toHaveProperty("warnings");
    expect(value.toKlogJSON()).not.toHaveProperty("records");
  });
});

describe("plain detached JSON values", () => {
  test("preserves existing JSON.stringify representation and all formatting metadata", () => {
    const value = parse(
      '2000-01-01 (0m!)\nSummary #B\n    +1h #A="x/y"\n    9:00 - ???',
    )[0];
    const before = JSON.stringify(value);
    const text = value.toString();
    const entries = value.entries.slice();
    const output = value.toKlogJSON();
    expect(JSON.parse(JSON.stringify(output))).toEqual(
      upstream(text).records[0],
    );
    output.tags.push("#changed");
    output.entries[0].summary = "changed";
    output.entries[0].tags.length = 0;
    output.entries.length = 0;
    expect(value.toKlogJSON()).toEqual(upstream(text).records[0]);
    expect(JSON.stringify(value)).toBe(before);
    expect(value.toString()).toBe(text);
    entries.forEach((entry, i) => expect(value.entries[i]).toBe(entry));
  });

  test("keeps existing duration and range toJSON methods separate", () => {
    const duration = new Duration(1, 0, { explicitPositive: true });
    expect(duration.toJSON()).toEqual({
      hours: 1,
      minutes: 0,
      explicitPositive: true,
      zeroSign: "",
    });
    const range = new Range(new Time(9, 0), null, {
      openRangePlaceholderCharCount: 3,
    });
    expect(range.toJSON().openRangePlaceholderCharCount).toBe(3);
    const entry = new Entry(duration);
    expect(entry.toKlogJSON()).toEqual(
      upstream("2000-01-01\n    +1h").records[0].entries[0],
    );
    expect(entry.toKlogJSON()).not.toHaveProperty("explicitPositive");
  });

  test("rejects an invalid record date rather than returning corrupt date metadata", () => {
    expect(() => new Record(new Date(NaN)).toKlogJSON()).toThrow(/invalid/i);
  });

  test("normalizes CRLF in programmatically supplied summary text", () => {
    const value = new Record(new Date(2000, 0, 1), [
      new Entry(new Duration(1, 0), new Summary("first\r\nnext")),
    ]);
    expect(value.toKlogJSON()).toEqual(upstream(value.toString()).records[0]);
  });
});

// Wrapping is a local rendering policy, not an upstream formatting guarantee.
// Verify both parsers agree on the resulting file, including complete tag values.
describe("wrapped output accepted by upstream", () => {
  for (const indentation of ["  ", "   ", "    ", "\t"] as const) {
    for (const newline of ["\n", "\r\n"] as const) {
      test.each([1, 24, 40])(
        `accepts ${JSON.stringify(indentation)}, ${JSON.stringify(newline)}, width %i`,
        (summaryWrapWidth) => {
          const value = parse(`2000-01-01 (0m!)
Record summary with #Project="two words" and more words
    <23:00 - 1:00 Range summary (#Topic='a b') with more words
          aligned continuation with more words
    -2h Negative duration summary
    4:00pm - ???
        Next-line summary #Status="still working" and more words`)[0];
          const text = value.toString({
            indentation,
            newline,
            summaryWrapWidth,
            timeFormat: TimeFormat.TwelveHour,
          });
          const reparsed = parse(text)[0];
          expect(upstream(text).records).toEqual([reparsed.toKlogJSON()]);
          expect(reparsed.toMinutes()).toBe(value.toMinutes());
          expect(reparsed.toKlogJSON().tags).toEqual(value.toKlogJSON().tags);
          expect(reparsed.entries.map((e) => e.toKlogJSON().tags)).toEqual(
            value.entries.map((e) => e.toKlogJSON().tags),
          );
        },
      );
    }
  }
});

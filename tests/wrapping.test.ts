import { describe, expect, test } from "vitest";
import {
  Duration,
  Entry,
  parse,
  parseAST,
  Range,
  RangeDashFormat,
  Record,
  Summary,
  Time,
  TimeFormat,
} from "../src/index";

const words = "alpha beta gamma delta";
const entry = (text = words) =>
  new Entry(new Duration(1, 0), new Summary(text));

describe("summary wrapping", () => {
  test("greedily wraps without merging explicit lines", () => {
    const value = new Summary("alpha beta gamma delta\nx y");
    expect(value.toString({ wrapWidth: 11 })).toBe(
      "alpha beta\ngamma delta\nx y",
    );
  });

  test("preserves all whitespace when no break is needed", () => {
    const text = "  alpha  beta\t gamma   ";
    expect(new Summary(text).toString({ wrapWidth: 100 })).toBe(text);
  });

  test("replaces only a broken whitespace run and repeats leading alignment", () => {
    expect(
      new Summary("  alpha  beta\t gamma   ").toString({ wrapWidth: 13 }),
    ).toBe("  alpha  beta\n  gamma   ");
  });

  test("does not merge, remove, or manufacture blank lines", () => {
    const text = "\nalpha beta gamma\n\n  \nx\n";
    expect(new Summary(text).toString({ wrapWidth: 10 })).toBe(
      "\nalpha beta\ngamma\n\n  \nx\n",
    );
    expect(new Summary([]).toString({ wrapWidth: 1 })).toBe("");
  });

  test("retains legacy positional arguments", () => {
    const value = new Summary("first\nsecond");
    expect(value.toString("  ", true)).toBe("\n    first\n    second");
    expect(value.toString(undefined, true)).toBe("\nfirst\nsecond");
    expect(value.toString({ indentation: "  ", startOnNextLine: true })).toBe(
      value.toString("  ", true),
    );
    expect(value.toString({})).toBe(value.toString());
  });

  test("budgets an embedding prefix separately from continuation indentation", () => {
    expect(
      new Summary(words).toString({
        wrapWidth: 15,
        firstLineOffset: 5,
        indentation: "  ",
      }),
    ).toBe("alpha beta\n    gamma delta");
  });

  test("budgets next-line summaries and each explicitly aligned line", () => {
    expect(
      new Summary(words).toString({
        wrapWidth: 15,
        indentation: "  ",
        startOnNextLine: true,
      }),
    ).toBe("\n    alpha beta\n    gamma delta");
    expect(
      new Summary("x\n  alpha beta gamma delta").toString({
        wrapWidth: 17,
        indentation: "  ",
      }),
    ).toBe("x\n      alpha beta\n      gamma delta");
  });

  test.each([
    '#Tag="two words"',
    "#Tag='two words'",
    '#Tag="a  b\tc"',
    '(#Tag="two words")',
    'prefix#Tag="two words"suffix',
    '#Outer="text #Inner=with spaces"',
  ])("does not split the raw quoted tag in %j", (tag) => {
    const value = new Summary(`before ${tag} after`);
    const text = value.toString({ wrapWidth: 6 });
    expect(text).toBe(`before\n${tag}\nafter`);
    expect(new Summary(text).tags).toEqual(value.tags);
  });

  test("does not canonicalize or split adjacent tags and punctuation", () => {
    const tag = '#A="x y"#EMPTY=,#B=Z!';
    const value = new Summary(`before ${tag} after`);
    expect(value.toString({ wrapWidth: 6 })).toBe(`before\n${tag}\nafter`);
  });

  test("leaves unfinished quotes as ordinary text without losing tags", () => {
    const value = new Summary('#A="unfinished words #B');
    const text = value.toString({ wrapWidth: 8 });
    expect(text).toBe('#A="unfinished\nwords #B');
    expect(new Summary(text).tags).toEqual(value.tags);
  });

  test.each([
    "supercalifragilistic",
    "https://example.com/very/long",
    "a\u00a0b",
  ])("keeps the indivisible token %j even beyond the soft limit", (word) => {
    expect(new Summary(`${word} x`).toString({ wrapWidth: 1 })).toBe(
      `${word}\nx`,
    );
  });

  test("counts Unicode code points rather than UTF-16 units", () => {
    expect(new Summary("😀 😀 😀").toString({ wrapWidth: 3 })).toBe(
      "😀 😀\n😀",
    );
    expect(new Summary("読む 読む 読む").toString({ wrapWidth: 5 })).toBe(
      "読む 読む\n読む",
    );
  });

  test("counts tabs as one character, without claiming terminal display columns", () => {
    expect(
      entry("aa bb cc").toString({ indentation: "\t", summaryWrapWidth: 9 }),
    ).toBe("\t1h aa bb\n\t\tcc");
  });

  test("normalizes CRLF only when wrapping was requested", () => {
    const value = new Summary("alpha beta gamma\r\nx y");
    expect(value.toString()).toBe("alpha beta gamma\r\nx y");
    expect(value.toString({ wrapWidth: 10 })).toBe("alpha beta\ngamma\nx y");
  });

  test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid widths %j without mutation",
    (width) => {
      const value = entry();
      const record = new Record(
        new Date(2024, 4, 5),
        [value],
        new Summary(words),
      );
      const before = record.toString();
      expect(() => value.summary!.toString({ wrapWidth: width })).toThrow(
        /wrap.*width/i,
      );
      expect(() => value.toString({ summaryWrapWidth: width })).toThrow(
        /wrap.*width/i,
      );
      expect(() => record.toString({ summaryWrapWidth: width })).toThrow(
        /wrap.*width/i,
      );
      expect(record.toString()).toBe(before);
    },
  );

  test.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid embedding offsets %j",
    (firstLineOffset) => {
      expect(() =>
        new Summary(words).toString({ wrapWidth: 15, firstLineOffset }),
      ).toThrow(/offset/i);
    },
  );

  test("accepts the maximum safe width without allocating padding", () => {
    expect(
      new Summary(words).toString({ wrapWidth: Number.MAX_SAFE_INTEGER }),
    ).toBe(words);
  });
});

describe("wrapping render options", () => {
  test("uses first-line and continuation budgets for duration entries", () => {
    expect(entry().toString({ indentation: "  ", summaryWrapWidth: 15 })).toBe(
      "  1h alpha beta\n    gamma delta",
    );
    expect(
      entry().toString({
        indentation: "  ",
        summaryWrapWidth: 15,
        duration: { explicitPositive: true },
      }),
    ).toBe("  +1h alpha\n    beta gamma\n    delta");
  });

  test.each([TimeFormat.TwelveHour, TimeFormat.TwentyFourHour])(
    "budgets the actual formatted range and placeholder in %s",
    (timeFormat) => {
      for (const end of [null, new Time(17, 0, 1)]) {
        const range = new Range(new Time(9, 0, -1), end);
        const options = {
          indentation: "  " as const,
          timeFormat,
          rangeDashFormat: RangeDashFormat.NoSpaces,
          openRangePlaceholderCharCount: 9,
        };
        const prefix = new Entry(range).toString(options) + " ";
        const value = new Entry(range, new Summary("alpha beta"));
        expect(
          value.toString({ ...options, summaryWrapWidth: prefix.length + 5 }),
        ).toBe(`${prefix}alpha\n    beta`);
      }
    },
  );

  test("supports null indentation and prefixes longer than the width", () => {
    expect(
      entry("aa bb").toString({ indentation: null, summaryWrapWidth: 5 }),
    ).toBe("1h aa\nbb");
    expect(entry("aa bb").toString({ summaryWrapWidth: 1 })).toBe(
      "    1h aa\n        bb",
    );
  });

  test("respects the full width when individual words fit within their prefixes", () => {
    const value = new Record(
      new Date(2024, 4, 5),
      [entry(words.repeat(10))],
      new Summary(words.repeat(10)),
    );
    const text = value.toString({ summaryWrapWidth: 32 });
    for (const line of text.split("\n"))
      expect(Array.from(line).length).toBeLessThanOrEqual(32);
    expect(text).toContain("\n        ");
  });

  test("wraps record and entry summaries, not headers, and preserves final newlines", () => {
    const value = new Record(
      new Date(2024, 4, 5),
      [entry()],
      new Summary(words),
    );
    expect(value.toString({ indentation: "  ", summaryWrapWidth: 15 })).toBe(
      "2024-05-05\nalpha beta\ngamma delta\n  1h alpha beta\n    gamma delta",
    );
    value.entries = [];
    expect(value.toString({ summaryWrapWidth: 15 })).toBe(
      "2024-05-05\nalpha beta\ngamma delta\n",
    );
    value.summary = null;
    expect(value.toString({ summaryWrapWidth: 1 })).toBe("2024-05-05\n");
  });

  test("leaves non-wrapped rendering, JSON, identities, and frozen options unchanged", () => {
    const value = new Record(
      new Date(2024, 4, 5),
      [entry()],
      new Summary(words),
    );
    const original = value.toString();
    const nativeJSON = JSON.stringify(value);
    const klogJSON = value.toKlogJSON();
    const summary = value.entries[0].summary!;
    const lines = summary.lines;
    Object.freeze(lines);
    const options = Object.freeze({
      indentation: "  " as const,
      summaryWrapWidth: 15,
    });
    for (let i = 0; i < 3; i++) {
      expect(value.toString(options)).not.toBe(original);
      expect(value.toString({ summaryWrapWidth: undefined })).toBe(original);
      expect(summary.lines).toBe(lines);
      expect(value.entries[0].summary).toBe(summary);
      expect(value.toKlogJSON()).toEqual(klogJSON);
      expect(JSON.stringify(value)).toBe(nativeJSON);
    }
  });
});

describe("wrapped record round trips", () => {
  for (const indentation of ["  ", "   ", "    ", "\t"] as const) {
    for (const newline of ["\n", "\r\n"] as const) {
      test.each([1, 24, 40])(
        `preserves semantics with ${JSON.stringify(indentation)}, ${JSON.stringify(newline)}, width %i`,
        (summaryWrapWidth) => {
          const value = parse(`2024-05-05 (0m!)
Record summary with #Project="two words" and extra words
    <23:00 - 1:00 Range summary with #Topic='a b' and a URL https://example.com/path
          aligned continuation with more words
    -2h Negative duration summary
    4:00pm - ???
        Next-line summary with #Status="still working" and more words`)[0];
          const options = {
            indentation,
            newline,
            summaryWrapWidth,
            timeFormat: TimeFormat.TwelveHour,
            duration: { explicitPositive: true },
          };
          const text = value.toString(options);
          expect(parseAST(text).records).toHaveLength(1);
          const reparsed = parse(text)[0];
          expect(reparsed.entries).toHaveLength(3);
          expect(reparsed.toMinutes()).toBe(value.toMinutes());
          expect(reparsed.shouldTotal?.toMinutes()).toBe(0);
          expect(reparsed.openEntry).not.toBeNull();
          expect(reparsed.summary!.tags).toEqual(value.summary!.tags);
          value.entries.forEach((old, index) => {
            const current = reparsed.entries[index];
            expect(current.toMinutes()).toBe(old.toMinutes());
            expect(current.summary!.tags).toEqual(old.summary!.tags);
            const squash = (summary: Summary) =>
              summary.toString().replace(/\s+/g, " ").trim();
            expect(squash(current.summary!)).toBe(squash(old.summary!));
          });
          expect(reparsed.toString(options)).toBe(text);
          if (newline === "\r\n")
            expect(text.replaceAll("\r\n", "")).not.toContain("\n");
        },
      );
    }
  }
});

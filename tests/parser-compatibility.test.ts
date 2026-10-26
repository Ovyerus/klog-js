import { describe, expect, test } from "vitest";
import { parse, parseAST } from "../src/parser";
import { Range } from "../src/range";

const source = (body: string, newline = "\n") =>
  `2024-07-05${newline}${body.replaceAll("\n", newline)}`;

const render = (text: string) =>
  parse(text)
    .map((record) => record.toString())
    .join("\n\n");

describe("record summary boundaries", () => {
  test.each(["X", "読む", "X\nY", "OK\nX"])(
    "keeps entries after summary %j",
    (summary) => {
      const text = source(`${summary}\n    1h Work\n    -15m Break\n`);
      const ast = parseAST(text);
      expect(ast.records[0].summary).toBe(summary);
      expect(ast.records[0].entries).toHaveLength(2);
      expect(parse(text)[0].toMinutes()).toBe(45);
      expect(render(render(text))).toBe(render(text));
    },
  );

  test.each(["", "\n", "\r\n"])(
    "accepts a one-character summary with ending %j",
    (ending) => {
      const ast = parseAST(`2024-07-05\nX${ending}`);
      expect(ast.records[0]).toMatchObject({ summary: "X", entries: [] });
    },
  );

  test("does not consume the next record", () => {
    const ast = parseAST("2024-07-05\nX\n\n2024-07-06\n    2h\n");
    expect(ast.records).toHaveLength(2);
    expect(ast.records[0].summary).toBe("X");
    expect(ast.records[1].entries).toHaveLength(1);
  });
});

describe("explicit file rule", () => {
  test("matches default parsing without dropping records", () => {
    const text = source("    1h\n");
    expect(parseAST(text, "file")).toEqual(parseAST(text));
    expect(parseAST(text, "file").records).toHaveLength(1);
  });

  test.each(["", "  ", "\t\n\r\n", "\u00a0\n"])(
    "accepts blank file %j with either entry point",
    (text) => {
      expect(parseAST(text)).toEqual({ type: "file", records: [] });
      expect(parseAST(text, "file")).toEqual({ type: "file", records: [] });
    },
  );

  test.each(["not a record", "2024-02-30", "\r", "\v"])(
    "rejects invalid file %j with either entry point",
    (text) => {
      expect(() => parseAST(text)).toThrow();
      expect(() => parseAST(text, "file")).toThrow();
    },
  );
});

describe("range shifts", () => {
  test.each([
    ["<21:00 - <22:00", 60],
    ["1:00> - 2:00>", 60],
    ["<23:00 - 1:00>", 1560],
    ["<11:00pm - <11:30pm", 30],
    ["1:00am> - 2:00am>", 60],
    ["<24:00 - 1:00", 60],
    ["23:00 - 24:00", 60],
  ])("parses %s and retains its duration", (range, minutes) => {
    expect(parseAST(range as string, "timeRange").type).toBe("timeRange");
    const text = source(`    ${range}\n`);
    expect(parse(text)[0].toMinutes()).toBe(minutes);
    expect(parse(render(text))[0].toMinutes()).toBe(minutes);
  });

  test.each(["<21:00 - ???", "1:00> - ???"])(
    "allows shifted open start %s",
    (range) => {
      expect(parseAST(range, "timeRange")).toMatchObject({
        open: true,
        placeholderCount: 3,
      });
      const record = parse(source(`    ${range}\n`))[0];
      expect(record.openEntry?.value).toBeInstanceOf(Range);
      expect(record.toMinutes()).toBe(0);
    },
  );

  test.each([
    "1:00> - 0:00>",
    "<22:00 - <21:00",
    "23:00 - 24:01",
    "23:00 - 24:00>",
    "<1:00> - 2:00",
    "1:00 - ?>",
  ])("rejects invalid range %s", (range) => {
    expect(() => parse(source(`    ${range}\n`))).toThrow();
  });
});

describe("record indentation", () => {
  test.each(["  ", "   ", "    ", "\t"])(
    "uses %j consistently for entries and continuations",
    (indent) => {
      const text = source(
        `${indent}1h First\n${indent}${indent}continued\n${indent}30m Second\n`,
      );
      const ast = parseAST(text);
      expect(ast.records[0].entries).toHaveLength(2);
      expect(ast.records[0].entries[0].summary).toBe("First\ncontinued");
      expect(parse(text)[0].toMinutes()).toBe(90);
    },
  );

  test("treats double indentation as text, even when it resembles an entry", () => {
    const text = source("  1h\n    2h\n  30m\n");
    const record = parse(text)[0];
    expect(record.entries).toHaveLength(2);
    expect(record.entries[0].summary?.lines).toEqual(["", "2h"]);
    expect(record.toMinutes()).toBe(90);
    expect(parse(render(text))[0].toMinutes()).toBe(90);
  });

  test.each([
    "  1h\n   2h",
    "   1h\n  2h",
    "    1h\n  2h",
    "\t1h\n    2h",
    "    1h\n\t2h",
    "    1h Text\n    \tWrong",
  ])("rejects inconsistent indentation %j", (body) => {
    expect(() => parseAST(source(body))).toThrow();
    expect(() => parse(source(body))).toThrow();
  });

  test("allows different styles in separate records with the same date", () => {
    const text = source("  1h\n\n2024-07-05\n\t2h\n");
    expect(parse(text).map((record) => record.toMinutes())).toEqual([60, 120]);
  });

  test("rejects duplicate open ranges in the AST as well as public parsing", () => {
    const text = source("    8:00 - ?\n    9:00 - ?\n");
    expect(() => parseAST(text)).toThrow(/open range/i);
    expect(() => parse(text)).toThrow(/open range/i);
  });
});

describe("file and record whitespace", () => {
  test.each([" ", "    ", "\t", "\u00a0", " \t\u2003"])(
    "allows blank-character separator %j",
    (blank) => {
      const text = `${blank}\n${source(`    1h\n${blank}\n2024-07-06\n    2h\n${blank}`)}`;
      expect(parse(text).map((record) => record.toMinutes())).toEqual([
        60, 120,
      ]);
    },
  );

  test.each(["\n", "\r\n"])(
    "allows target spacing and trailing spaces with %j",
    (newline) => {
      const text = source("    1h\n", newline).replace(
        "2024-07-05",
        "2024-07-05   (8h!)   ",
      );
      expect(parse(text)[0].shouldTotal?.toMinutes()).toBe(480);
      expect(parseAST(`2024-07-05   ${newline}`).records).toHaveLength(1);
    },
  );

  test.each(["\n", "\r\n"])(
    "does not allow blank lines within a record with %j",
    (newline) => {
      expect(() => parse(source("    1h\n  \n    2h\n", newline))).toThrow();
    },
  );
});

describe("summary round trips", () => {
  test.each(["  ", "   ", "    ", "\t"])(
    "removes only structural indentation %j",
    (indent) => {
      const text = source(
        `${indent}1h   Aligned\n${indent}${indent}  next\n${indent}30m X\n`,
      );
      const ast = parseAST(text);
      expect(ast.records[0].entries[0].summary).toBe("  Aligned\n  next");
      let output = render(text);
      for (let i = 0; i < 3; i++) {
        const record = parse(output)[0];
        expect(record.entries[0].summary?.lines).toEqual([
          "  Aligned",
          "  next",
        ]);
        expect(record.toMinutes()).toBe(90);
        expect(render(output)).toBe(output);
        output = render(output);
      }
    },
  );

  test("preserves a summary starting on the next line", () => {
    const text = source("    1h\n        next\n          aligned\n");
    expect(parse(text)[0].entries[0].summary?.lines).toEqual([
      "",
      "next",
      "  aligned",
    ]);
    expect(parse(render(text))[0].entries[0].summary?.lines).toEqual([
      "",
      "next",
      "  aligned",
    ]);
  });

  test("preserves record summary trailing spaces without capturing entry indentation", () => {
    const text = source("X  \nY \n    1h\n");
    expect(parseAST(text).records[0].summary).toBe("X  \nY ");
    expect(render(render(text))).toBe(render(text));
  });
});

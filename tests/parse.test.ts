import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { Record } from "../src/record";
import { Duration } from "../src/duration";
import { Entry } from "../src/entry";
import { Summary } from "../src/summary";
import { Range } from "../src/range";
import { Time } from "../src/time";
import { parse } from "../src/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readCorpus = (file: string) =>
  fs.readFile(join(__dirname, "./corpus/", file), "utf-8");

const multipleRecords = await readCorpus("multiple.klg");

test("parses a file into classes", () => {
  const result = parse(multipleRecords);
  expect(result).toEqual([
    new Record(
      new Date(2018, 2, 24),
      [
        new Entry(new Range(new Time(8, 30), new Time(17, 0))),
        new Entry(new Duration(0, -45), new Summary("Lunch break")),
      ],
      new Summary("First day at my new job"),
    ),

    new Record(
      new Date(2018, 2, 25),
      [new Entry(new Duration(8, 15))],
      null,
      new Duration(8, 30),
    ),

    new Record(
      new Date(2018, 2, 26),
      [
        new Entry(new Range(new Time(8, 30), new Time(11, 15))),
        new Entry(
          new Range(new Time(11, 15), new Time(12, 20)),
          new Summary("Meeting with Sarah"),
        ),
        new Entry(new Duration(4, 0)),
      ],
      new Summary(
        "More onboarding. Also started\nto work on my first small project!",
      ),
    ),
  ]);
});

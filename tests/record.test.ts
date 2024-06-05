import { describe, expect, test } from "vitest";
import { Record, RecordDateFormat } from "../src/record";
import { Entry } from "../src/entry";
import { Time } from "../src/time";
import { Range } from "../src/range";
import { KlogDuration } from "../src/duration";
import { Summary } from "../src/summary";

const areDurationsEqual = (a: unknown, b: unknown) => {
  const aIsDuration = a instanceof KlogDuration;
  const bIsDuration = b instanceof KlogDuration;

  if (aIsDuration && bIsDuration) return a.equals(b);
  else if (aIsDuration === bIsDuration) return undefined;
  else return false;
};

expect.addEqualityTesters([areDurationsEqual]);

// Just do a basic construction with nothing but a date
test("initialising", () => {
  const date = new Date(2024, 1, 14);
  const record = new Record(date);

  expect(record.date).toBe(date);
  expect(record.entries).toHaveLength(0);
  expect(record.shouldTotal).toEqual(null);
  expect(record.dateFormat).toEqual(RecordDateFormat.Dashes);
});

describe("openEntry", () => {
  test("gets the entry within that is open", () => {
    const openEntry = new Entry(new Range(new Time(13, 0)));
    const entries = [
      new Entry(new Range(new Time(9, 0), new Time(11, 30))),
      openEntry,
    ];
    const record = new Record(new Date(2024, 1, 14), entries);

    expect(record.openEntry).toBe(openEntry);
  });

  test("returns nothing when no open entry", () => {
    const entries = [
      new Entry(new Range(new Time(9, 0), new Time(11, 30))),
      new Entry(new Range(new Time(13, 0), new Time(13, 30))),
    ];
    const record = new Record(new Date(2024, 1, 14), entries);

    expect(record.openEntry).toEqual(null);
  });
});

describe("dateString", () => {
  test("default dash formatting", () => {
    const record = new Record(new Date(2024, 1, 14));
    expect(record.dateString).toEqual("2024-02-14");
  });

  test("slash formatting", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [],
      null,
      null,
      RecordDateFormat.Slashes
    );
    expect(record.dateString).toEqual("2024/02/14");
  });
});

test("toMinutes", () => {
  const record1 = new Record(new Date(2024, 1, 14), []);
  expect.soft(record1.toMinutes()).toEqual(0);

  const record2 = new Record(new Date(2024, 1, 14), [
    new Entry(new Range(new Time(9, 0), new Time(11, 30))),
    new Entry(new KlogDuration(2, 15)),
    new Entry(new Range(new Time(17, 0), new Time(21, 0))),
  ]);
  expect.soft(record2.toMinutes()).toEqual(
    2 * 60 +
      30 + // ^ entry 1
      (2 * 60 + 15) + // entry 2
      4 * 60 // entry 3
  );
});

test("toDuration", () => {
  const record1 = new Record(new Date(2024, 1, 14), []);
  expect.soft(record1.toDuration()).toEqual(new KlogDuration(0, 0));

  const record2 = new Record(new Date(2024, 1, 14), [
    new Entry(new Range(new Time(9, 0), new Time(11, 30))),
    new Entry(new KlogDuration(2, 15)),
    new Entry(new Range(new Time(17, 0), new Time(21, 0))),
  ]);
  expect
    .soft(record2.toDuration())
    .toEqual(new KlogDuration(2 + 2 + 4, 30 + 15));
});

describe("shouldTotalDiff", () => {
  test("returns the difference between the total sum & the expected duration", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [
        new Entry(new Range(new Time(9, 0), new Time(11, 30))),
        new Entry(new KlogDuration(2, 15)),
      ],
      null,
      new KlogDuration(8, 0)
    );

    expect(record.shouldTotalDiff()).toEqual(new KlogDuration(-3, -15));
  });

  test("returns the inverse of the should total value when there are no entries", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [],
      null,
      new KlogDuration(8, 0)
    );

    expect(record.shouldTotalDiff()).toEqual(new KlogDuration(-8, 0));
  });

  test("returns empty duration when both match", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [new Entry(new Range(new Time(10, 0), new Time(18, 0)))],
      null,
      new KlogDuration(8, 0)
    );

    expect(record.shouldTotalDiff()).toEqual(new KlogDuration(0, 0));
  });

  test("returns a positive diff if the total sum is larger than the expected duration", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [new Entry(new Range(new Time(10, 0), new Time(18, 0)))],
      null,
      new KlogDuration(5, 0)
    );

    expect(record.shouldTotalDiff()).toEqual(new KlogDuration(3, 0));
  });
});

describe("start", () => {
  test("creates a new entry with an open range", () => {
    const record = new Record(new Date(2024, 1, 14));
    record.start(new Time(11, 0), new Summary("Open range"));

    expect(record.entries).toHaveLength(1);
    expect(record.openEntry).not.toEqual(null);
    expect(record.entries[0].value).toBeInstanceOf(Range);
    expect((record.entries[0].value as Range).open).toEqual(true);
  });

  test("cannot start a new entry when there is already an open range", () => {
    const record = new Record(new Date(2024, 1, 14), [
      new Entry(new Range(new Time(11, 0))),
    ]);

    expect(() => record.start(new Time(13, 0))).toThrow(
      "Records can only have one open range at a time"
    );
  });
});

describe("end", () => {
  test("ends the open range within the record", () => {
    const record = new Record(new Date(2024, 1, 14));
    const startTime = new Time(10, 15);
    const endTime = new Time(13, 5);

    record.start(startTime);
    record.end(endTime);

    expect(record.entries).toHaveLength(1);
    expect(record.openEntry).toEqual(null);

    const range = record.entries[0].value;
    expect(range).toBeInstanceOf(Range);
    expect((range as Range).start).toBe(startTime);
    expect((range as Range).end).toBe(endTime);
  });

  test("cannot end if there is not an open range", () => {
    const record = new Record(new Date(2014, 1, 14), [
      new Entry(new Range(new Time(13, 5), new Time(15, 33))),
    ]);
    expect(() => record.end(new Time(16, 0))).toThrow(
      "Record does not have any currently open ranges"
    );
  });

  test("cannot end with an invalid ending time", () => {
    const record = new Record(new Date(2014, 1, 14), [
      new Entry(new Range(new Time(13, 5))),
    ]);

    expect(() => record.end(new Time(11, 0))).toThrow(
      "End of range cannot be before its start"
    );
  });
});

describe("toString", () => {
  test("basic record", () => {
    const record = new Record(new Date(2024, 1, 14), [
      new Entry(new Range(new Time(9, 30), new Time(14, 45))),
      new Entry(new KlogDuration(-1, 0), new Summary("Break")),
    ]);

    expect(record.toString()).toEqual(
      `
2024-02-14
    9:30 - 14:45
    -1h Break`.trim()
    );
  });

  test("slash formatting for dates", () => {
    const record = new Record(
      new Date(2024, 1, 24),
      [],
      null,
      null,
      RecordDateFormat.Slashes
    );

    expect(record.toString()).toEqual("2024/02/24\n");
  });

  test("with should total", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [new Entry(new Range(new Time(9, 30), new Time(14, 45)))],
      null,
      new KlogDuration(8, 30)
    );

    expect(record.toString()).toEqual(
      `
2024-02-14 (8h30m!)
    9:30 - 14:45`.trim()
    );
  });

  test("with a summary", () => {
    const record = new Record(
      new Date(2024, 1, 14),
      [new Entry(new KlogDuration(5, 11), new Summary("Get stuff done"))],
      new Summary(["Lorem ipsum dolor", "sit amet. Blah blah blah"])
    );

    expect(record.toString()).toEqual(
      `
2024-02-14
Lorem ipsum dolor
sit amet. Blah blah blah
    5h11m Get stuff done`.trim()
    );
  });

  test("everything", () => {
    const record = new Record(
      new Date(2024, 3, 11),
      [
        new Entry(new Range(new Time(9, 30), new Time(14, 45))),
        new Entry(new KlogDuration(0, -30), new Summary("aldi run")),
        new Entry(new Range(new Time(15, 15))),
      ],
      new Summary("busy busy day lots of #stuff"),
      new KlogDuration(9, 0)
    );

    expect(record.toString()).toEqual(
      `
2024-04-11 (9h!)
busy busy day lots of #stuff
    9:30 - 14:45
    -30m aldi run
    15:15 - ?`.trim()
    );
  });
});

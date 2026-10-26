import { describe, expect, test } from "vitest";
import { Summary } from "../src/summary";

// TODO: blank line testing

describe("basic summaries", () => {
  test("accepts a single-line string", () => {
    const summary = new Summary("First line");
    expect(summary.lines).toEqual(["First line"]);
    expect(summary.tags).toEqual([]);
  });

  test("accepts a multi-line string", () => {
    const summary = new Summary("First line\nSecond line");
    expect(summary.lines).toEqual(["First line", "Second line"]);
    expect(summary.tags).toEqual([]);
  });

  test("accepts a string array", () => {
    const summary = new Summary(["First line", "Second line"]);
    expect(summary.lines).toEqual(["First line", "Second line"]);
    expect(summary.tags).toEqual([]);
  });

  test("`lines` can be updated via `setText`", () => {
    const summary = new Summary("First line");
    expect(summary.lines).toEqual(["First line"]);
    summary.setText("First line\nSecond line");
    expect(summary.lines).toEqual(["First line", "Second line"]);
  });
});

describe("summaries with tags", () => {
  test("parses plain tags", () => {
    const summary = new Summary([
      "Hello #world, I feel",
      "(super #GREAT) today #123_test: #234-foo!",
      // TODO: fix
      // "#太陽 #λουλούδι #पहाड #мир #Léift #ΓΕΙΑ-ΣΑΣ",
      "#太陽 #λουλούδι #мир #Léift #ΓΕΙΑ-ΣΑΣ",
    ]);

    expect(summary.tags).toEqual([
      { name: "world" },
      { name: "great" },
      { name: "123_test" },
      { name: "234-foo" },
      { name: "太陽" },
      { name: "λουλούδι" },
      // { name: "पहाड" },
      { name: "мир" },
      { name: "léift" },
      { name: "γεια-σας" },
    ]);
  });

  test("parses tags with values", () => {
    const summary = new Summary([
      '#foo=bar #tag="something cool" ignore me #empty=""',
      "#aaa='' #project=KLG-123 #no-value #crazy='v!a?l,u=e'",
    ]);

    expect(summary.tags).toEqual([
      { name: "foo", value: "bar" },
      { name: "tag", value: "something cool" },
      { name: "empty" },
      { name: "aaa" },
      { name: "project", value: "KLG-123" },
      { name: "no-value" },
      { name: "crazy", value: "v!a?l,u=e" },
    ]);
  });

  test("returning a node list with text & tags separated", () => {
    const summary1 = new Summary("Did some #sports!");
    expect.soft(summary1.splitOnTags()).toEqual([
      { type: "text", value: "Did some " },
      { type: "tag", name: "sports" },
      { type: "text", value: "!" },
    ]);

    const summary2 = new Summary("#Badminton session (at the #gym)");
    expect.soft(summary2.splitOnTags()).toEqual([
      { type: "tag", name: "badminton" },
      { type: "text", value: " session (at the " },
      { type: "tag", name: "gym" },
      { type: "text", value: ")" },
    ]);

    const summary3 = new Summary("Layout draft #project=478");
    expect.soft(summary3.splitOnTags()).toEqual([
      { type: "text", value: "Layout draft " },
      { type: "tag", name: "project", value: "478" },
    ]);

    const summary4 = new Summary('Phone #call="Liz Jones"\nWeekly #catchup');
    expect
      .soft(summary4.splitOnTags())
      .toEqual([
        { type: "text", value: "Phone " },
        { type: "tag", name: "call", value: "Liz Jones" },
        { type: "end-of-line" },
        { type: "text", value: "Weekly " },
        { type: "tag", name: "catchup" },
      ]);
  });
  test("repeated and interleaved calls do not share matcher state", () => {
    const first = new Summary("#A#B\n#C");
    const second = new Summary("before #Other after");
    const firstTags = [{ name: "a" }, { name: "b" }, { name: "c" }];
    const firstNodes = [
      { type: "tag", name: "a" },
      { type: "tag", name: "b" },
      { type: "end-of-line" },
      { type: "tag", name: "c" },
    ];
    for (let i = 0; i < 3; i++) {
      expect(first.splitOnTags()).toEqual(firstNodes);
      expect(second.tags).toEqual([{ name: "other" }]);
      expect(first.tags).toEqual(firstTags);
      expect(second.splitOnTags()).toEqual([
        { type: "text", value: "before " },
        { type: "tag", name: "other" },
        { type: "text", value: " after" },
      ]);
    }
  });

  test("interprets quoted values while leaving raw lines and text intact", () => {
    const source = `Start #Office #project="Ab/c"#EMPTY=''\n#Single='a=b' #double="A B" end`;
    const summary = new Summary(source);
    expect(summary.tags).toEqual([
      { name: "office" },
      { name: "project", value: "Ab/c" },
      { name: "empty" },
      { name: "single", value: "a=b" },
      { name: "double", value: "A B" },
    ]);
    expect(summary.splitOnTags()).toEqual([
      { type: "text", value: "Start " },
      { type: "tag", name: "office" },
      { type: "text", value: " " },
      { type: "tag", name: "project", value: "Ab/c" },
      { type: "tag", name: "empty" },
      { type: "end-of-line" },
      { type: "tag", name: "single", value: "a=b" },
      { type: "text", value: " " },
      { type: "tag", name: "double", value: "A B" },
      { type: "text", value: " end" },
    ]);
    expect(summary.lines).toEqual(source.split("\n"));
    expect(summary.toString()).toBe(source);
  });

  test("leaves unfinished quotes as text following a valueless tag", () => {
    const summary = new Summary(`#TODO="unfinished\n#OTHER='also unfinished`);
    expect(summary.tags).toEqual([{ name: "todo" }, { name: "other" }]);
    expect(summary.splitOnTags()).toEqual([
      { type: "tag", name: "todo" },
      { type: "text", value: '"unfinished' },
      { type: "end-of-line" },
      { type: "tag", name: "other" },
      { type: "text", value: "'also unfinished" },
    ]);
    expect(summary.toString()).toBe(
      `#TODO="unfinished\n#OTHER='also unfinished`,
    );
  });
});

describe.skip("toString", () => {});

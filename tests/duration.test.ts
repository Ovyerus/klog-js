import { describe, expect, test } from "vitest";
import { Duration } from "../src/duration";

test.fails("make sure the equality checker works", () => {
  expect(new Duration(1, 0)).toEqual(new Duration(1, 1));
});

test("constructing from minutes", () => {
  const duration1 = Duration.fromMinutes(23);
  expect.soft(duration1.minutes).toEqual(23);
  expect.soft(duration1.hours).toEqual(0);

  const duration2 = Duration.fromMinutes(600);
  expect.soft(duration2.minutes).toEqual(0);
  expect.soft(duration2.hours).toEqual(10);

  const duration3 = Duration.fromMinutes(315);
  expect.soft(duration3.minutes).toEqual(15);
  expect.soft(duration3.hours).toEqual(5);

  // Testing negatives
  const duration4 = Duration.fromMinutes(-600);
  expect.soft(duration4.minutes).toEqual(0);
  expect.soft(duration4.hours).toEqual(-10);
  expect.soft(duration4.sign).toEqual("-");

  const duration5 = Duration.fromMinutes(-23);
  expect.soft(duration5.minutes).toEqual(-23);
  expect.soft(duration5.hours).toEqual(0);
  expect.soft(duration4.sign).toEqual("-");

  const duration6 = Duration.fromMinutes(-315);
  expect.soft(duration6.minutes).toEqual(-15);
  expect.soft(duration6.hours).toEqual(-5);
  expect.soft(duration4.sign).toEqual("-");
});

test("add", () => {
  const one = new Duration(3, 1);
  const two = new Duration(1, 21);

  expect(one.add(two)).toEqual(new Duration(4, 22));
  expect(two.add(one)).toEqual(new Duration(4, 22));
});

test("subtract", () => {
  const one = new Duration(3, 1);
  const two = new Duration(1, 21);

  expect(one.subtract(two)).toEqual(new Duration(1, 40));
});

test("toMinutes", () => {
  expect(new Duration(4, 20).toMinutes()).toEqual(260);
});

describe("toString", () => {
  test("only returns meaningful values", () => {
    expect.soft(new Duration(0, 0).toString()).toEqual("0m");
    expect.soft(new Duration(0, 1).toString()).toEqual("1m");
    expect.soft(new Duration(15, 0).toString()).toEqual("15h");
  });

  test("presents large hours properly", () => {
    expect(new Duration(265, 45).toString()).toEqual("265h45m");
  });

  test("presents negative values", () => {
    expect.soft(new Duration(-3, -18).toString()).toEqual("-3h18m");
    expect.soft(new Duration(-3, 0).toString()).toEqual("-3h");
    expect.soft(new Duration(0, -15).toString()).toEqual("-15m");
  });

  test("the sign for 0 minutes can be changed", () => {
    expect
      .soft(new Duration(0, 0, { zeroSign: "-" }).toString())
      .toEqual("-0m");
    expect
      .soft(new Duration(0, 0, { zeroSign: "+" }).toString())
      .toEqual("+0m");
  });

  test("can explicitly display a positive sign", () => {
    expect
      .soft(new Duration(0, 15, { explicitPositive: true }).toString())
      .toEqual("+15m");
    expect
      .soft(new Duration(3, 0, { explicitPositive: true }).toString())
      .toEqual("+3h");
    expect
      .soft(new Duration(5, 20, { explicitPositive: true }).toString())
      .toEqual("+5h20m");
  });
});

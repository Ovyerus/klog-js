import { expect } from "vitest";
import { Duration } from "../src/duration";

const areDurationsEqual = (a: unknown, b: unknown) => {
  const aIsDuration = a instanceof Duration;
  const bIsDuration = b instanceof Duration;

  if (aIsDuration && bIsDuration) return a.equals(b);
  else if (aIsDuration === bIsDuration) return undefined;
  else return false;
};

expect.addEqualityTesters([areDurationsEqual]);

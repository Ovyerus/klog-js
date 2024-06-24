import { DurationNode, Sign } from "./types.js";

// Define `util.inspect.custom` manually so that we should be portable into the
// browser.
const customInspect = Symbol.for("nodejs.util.inspect.custom");

const bumpNegativeZero = (value: number) => (value === -0 ? 0 : value);

/**
 * Options for formatting the duration.
 */
export interface DurationOptions {
  /** Whether to explicitly show a positive sign. */
  explicitPositive?: boolean;
  /** The sign to use for zero values. */
  zeroSign?: Sign;
}

/**
 * Represents a duration of time in hours and minutes.
 */
export class Duration {
  /** @internal */
  #value: number;
  /** Whether to explicitly show a positive sign. */
  explicitPositive: boolean;
  /** The sign to use for zero values. */
  zeroSign: Sign;

  /**
   * Create a new duration.
   * @param hours - The number of hours.
   * @param minutes - The number of minutes.
   * @param options - Formatting options for the duration.
   */
  constructor(
    hours: number,
    minutes: number,
    { explicitPositive = false, zeroSign = "" }: DurationOptions = {},
  ) {
    this.#value = hours * 60 + minutes;
    this.explicitPositive = explicitPositive;
    this.zeroSign = zeroSign;
  }

  /** @internal */
  static fromAST(node: DurationNode) {
    return this.fromMinutes(node.value, {
      explicitPositive: node.sign === "+",
      zeroSign: node.value === 0 ? node.sign : "",
    });
  }

  /**
   * Create a new duration from a total number of minutes.
   * @param value - The total number of minutes.
   * @param options - Formatting options for the duration.
   */
  static fromMinutes = (value: number, options: DurationOptions = {}) => {
    const hours = Math.trunc(value / 60);
    const minutes = value % 60;

    return new this(hours, minutes, options);
  };

  /**
   * The number of minutes in the duration.
   */
  get minutes() {
    return bumpNegativeZero(this.#value % 60);
  }

  /**
   * The number of hours in the duration.
   */
  get hours() {
    return bumpNegativeZero(Math.trunc(this.#value / 60));
  }

  /** @internal */
  get #options(): DurationOptions {
    return { explicitPositive: this.explicitPositive, zeroSign: this.zeroSign };
  }

  /**
   * The sign of the duration. Takes the `zeroSign` option into account.
   */
  get sign(): Sign {
    if (this.#value === 0) return this.zeroSign;
    else if (this.#value < 0) return "-";
    else return this.explicitPositive ? "+" : "";
  }

  /**
   * Add another duration to this duration.
   * @param other - The other duration to add.
   * @returns A new Duration instance representing the sum.
   */
  add(other: this) {
    return Duration.fromMinutes(this.#value + other.#value, this.#options);
  }

  /**
   * Subtract another duration from this duration.
   * @param other - The other duration to subtract.
   * @returns A new Duration instance representing the difference.
   */
  subtract(other: this) {
    return Duration.fromMinutes(this.#value - other.#value, this.#options);
  }

  /**
   * Check if this duration is equal to another duration.
   * @param other - The other duration to compare against.
   */
  equals(other: this) {
    return this.toMinutes() === other.toMinutes();
  }

  /**
   * Render the duration as a Klog string.
   */
  toString() {
    if (this.#value === 0) return `${this.sign}0m`;

    const h = this.hours !== 0 ? `${Math.abs(this.hours)}h` : "";
    const m = this.minutes !== 0 ? `${Math.abs(this.minutes)}m` : "";
    return `${this.sign}${h}${m}`;
  }

  /**
   * Convert the duration to a JSON object.
   */
  toJSON() {
    const { hours, minutes, zeroSign, explicitPositive } = this;
    return { hours, minutes, zeroSign, explicitPositive };
  }

  /**
   * Converts the duration to minutes.
   */
  toMinutes() {
    return this.#value;
  }

  [customInspect]() {
    return `Duration { hours: ${this.hours}, minutes: ${this.minutes} }`;
  }
}

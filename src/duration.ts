import { DurationNode, Sign } from "./types.js";

// Define `util.inspect.custom` manually so that we should be portable into the
// browser.
const customInspect = Symbol.for("nodejs.util.inspect.custom");

export interface DurationOptions {
  explicitPositive?: boolean;
  zeroSign?: Sign;
}

export class KlogDuration {
  #value: number;
  explicitPositive: boolean;
  zeroSign: Sign;

  // TODO: expect both to be the same sign
  constructor(
    hours: number,
    minutes: number,
    { explicitPositive = false, zeroSign = "" }: DurationOptions = {}
  ) {
    this.#value = hours * 60 + minutes;
    this.explicitPositive = explicitPositive;
    this.zeroSign = zeroSign;
  }

  static fromAST(node: DurationNode) {
    return this.fromMinutes(node.value, {
      explicitPositive: node.sign === "+",
      zeroSign: node.sign,
    });
  }

  static fromMinutes(value: number, options: DurationOptions = {}) {
    const hours = Math.trunc(value / 60);
    const minutes = value % 60;

    return new this(hours, minutes, options);
  }

  get minutes() {
    return Math.abs(this.#value % 60);
  }

  get hours() {
    return Math.abs(Math.trunc(this.#value / 60));
  }

  get #options(): DurationOptions {
    return { explicitPositive: this.explicitPositive, zeroSign: this.zeroSign };
  }

  get sign(): Sign {
    if (this.#value === 0) return this.zeroSign;
    else if (this.#value < 0) return "-";
    else return this.explicitPositive ? "+" : "";
  }

  add(other: this) {
    return KlogDuration.fromMinutes(this.#value + other.#value, this.#options);
  }

  subtract(other: this) {
    return KlogDuration.fromMinutes(this.#value - other.#value, this.#options);
  }

  equals(other: this) {
    return this.toMinutes() === other.toMinutes();
  }

  toString() {
    if (this.#value === 0) return `${this.sign}0m`;

    const h = this.hours !== 0 ? `${this.hours}h` : "";
    const m = this.minutes !== 0 ? `${this.minutes}m` : "";
    return `${this.sign}${h}${m}`;
  }

  toMinutes() {
    return this.#value;
  }

  [customInspect]() {
    return `KlogDuration { hours: ${this.sign}${this.hours}, minutes: ${this.sign}${this.minutes} }`;
  }
}

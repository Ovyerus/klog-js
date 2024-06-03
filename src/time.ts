import { TimeNode } from "./types.js";

export enum TimeFormat {
  TwentyFourHour = "24h",
  TwelveHour = "12h",
}

export enum DayShift {
  Yesterday = -1,
  Today = 0,
  Tomorrow = 1,
}

export class Time {
  constructor(
    /** The hour of the time, in 24 hour time. */
    public hour: number,
    /** The minute of the time. */
    public minute: number,
    /** If the time belongs to the tomorrow or yesterday. */
    public dayShift = DayShift.Today,
    /** The format to use for the time when rendering as a string. */
    public format = TimeFormat.TwentyFourHour
  ) {
    if (!Time.isValidValue(hour, minute, dayShift))
      throw new Error("Invalid time");

    // Special casing for `24:00` times:
    // - Accept a time of `24:00` and treat it as `0:00` tomorrow.
    // - Accept a time of `<24:00` and treat it as `0:00` today.
    // `24:00>` is not representable as Klog only allows shifting time by up to a single day.
    if (hour === 24 && minute === 0 && dayShift !== DayShift.Tomorrow) {
      this.hour = 0;
      this.dayShift += 1;
    }
  }

  static fromAST(node: TimeNode) {
    return new this(node.hour, node.minute, node.shift, node.format);
  }

  static isValidValue(hour: number, minute: number, dayShift = DayShift.Today) {
    if (hour === 24 && minute === 0 && dayShift !== DayShift.Tomorrow)
      return true;
    else return hour <= 23 && minute <= 59;
  }

  equals(other: this) {
    return this.toMinutes() === other.toMinutes();
  }

  afterOrEquals(other: this) {
    return this.toMinutes() >= other.toMinutes();
  }

  toString() {
    const shiftPrefix = this.dayShift === DayShift.Yesterday ? "<" : "";
    const shiftSuffix = this.dayShift === DayShift.Tomorrow ? ">" : "";
    let h = this.hour;
    let periodSuffix: "" | "am" | "pm" = "";

    if (this.format === TimeFormat.TwelveHour) {
      if (h === 0) {
        h = 12;
        periodSuffix = "am";
      } else if (h === 12) {
        periodSuffix = "pm";
      } else if (h > 12) {
        h = h - 12;
        periodSuffix = "pm";
      } else {
        periodSuffix = "am";
      }
    }

    return `${shiftPrefix}${h}:${this.minute}${periodSuffix}${shiftSuffix}`;
  }

  toMinutes() {
    // TODO: take day shift into account
    return this.hour * 60 + this.minute;
  }
}

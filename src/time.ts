import { Duration } from "./duration.js";
import { TimeNode } from "./types.js";

/**
 * How a time should be formatted when turned into a string.
 */
export enum TimeFormat {
  TwentyFourHour = "24h",
  TwelveHour = "12h",
}

/**
 * Which day a time should be assigned to.
 */
export enum DayShift {
  Yesterday = -1,
  Today = 0,
  Tomorrow = 1,
}

/**
 * A specific time of day.
 */
export class Time {
  /**
   * Create a new time.
   * @throws {Error} The time values are invalid.
   */
  constructor(
    /** The hour of the time, in 24-hour format. */
    public hour: number,
    /** The minute of the time. */
    public minute: number,
    /** If the time belongs to today, tomorrow, or yesterday. */
    public dayShift = DayShift.Today,
    /** The format to use for the time when rendering as a string. */
    public format = TimeFormat.TwentyFourHour,
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

  /** @internal */
  static fromAST = (node: TimeNode) => {
    return new this(node.hour, node.minute, node.shift, node.format);
  };

  /**
   * Validates the time values.
   * @param hour - The hour to validate.
   * @param minute - The minute to validate.
   * @param dayShift - The day shift to validate.
   * @returns True if the time values are valid, false otherwise.
   */
  static isValidValue(hour: number, minute: number, dayShift = DayShift.Today) {
    if (hour === 24 && minute === 0 && dayShift !== DayShift.Tomorrow)
      return true;
    else return hour <= 23 && hour >= 0 && minute <= 59 && minute >= 0;
  }

  /**
   * Check if this time is equal to another time.
   * @param other - The time to compare against.
   */
  equals(other: this) {
    return this.toMinutesSinceMidnight() === other.toMinutesSinceMidnight();
  }

  /**
   * Check if this time is after or equal to another time.
   * @param other - The other time to compare against.
   */
  afterOrEquals(other: this) {
    return this.toMinutesSinceMidnight() >= other.toMinutesSinceMidnight();
  }

  /**
   * Render the time as a Klog string.
   * @param formatOverride - Optional override for the time format.
   */
  toString(formatOverride?: TimeFormat) {
    const shiftPrefix = this.dayShift === DayShift.Yesterday ? "<" : "";
    const shiftSuffix = this.dayShift === DayShift.Tomorrow ? ">" : "";
    let hour = this.hour;
    const minute = this.minute.toString().padStart(2, "0");
    let periodSuffix: "" | "am" | "pm" = "";

    if ((formatOverride || this.format) === TimeFormat.TwelveHour) {
      if (hour === 0) {
        hour = 12;
        periodSuffix = "am";
      } else if (hour === 12) {
        periodSuffix = "pm";
      } else if (hour > 12) {
        hour = hour - 12;
        periodSuffix = "pm";
      } else {
        periodSuffix = "am";
      }
    }

    return `${shiftPrefix}${hour}:${minute}${periodSuffix}${shiftSuffix}`;
  }

  /**
   * Convert the time to a duration starting at midnight.
   */
  toDurationSinceMidnight() {
    let hour = this.hour;
    let minute = this.minute;

    if (this.dayShift === DayShift.Yesterday) {
      hour = -23 + hour;
      minute = -60 + minute;
    } else if (this.dayShift === DayShift.Tomorrow) {
      hour += 24;
    }

    return new Duration(hour, minute);
  }

  /**
   * Convert the time to the amount of minutes since midnight.
   */
  toMinutesSinceMidnight() {
    return this.toDurationSinceMidnight().toMinutes();
  }
}

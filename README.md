# Klog.js

A JavaScript implementation of the Klog file format, a simple plain-text format
for time tracking. This library allows you to parse and manipulate Klog files
with ease.

## Features

- Parse Klog files into JavaScript classes
- Create and manipulate Klog entries programmatically
- Serialize classes back into the Klog format

## Installation

Install the package using whichever package manager you desire:

```sh
npm install klog.js
pnpm add klog.js
yarn add klog.js
```

## Usage

### Parsing a Klog file

```js
import { parse } from "klog.js";

const klogContent = `
2024-06-01
    2h Working on project A
    1h Meeting with client

2024-06-02
    3h Development work
`;

const records = parse(klogContent);
console.log(records);
```

### Creating records manually

```js
import { Record, Entry } from "klog.js";

const record = new Record(new Date(2024, 1, 24), [
  new Entry(new Range(new Time(9, 30), new Time(15, 45))),
  new Entry(new Duration(-1, 0), new Summary("Lunch break & shopping")),
]);
/* `record.toString()` =>
2024-02-24
    9:30 - 15:45
    -1h Lunch break & shopping
*/
```

### Formatting records

Pass rendering overrides to `Record.toString()` to apply one style throughout a
record. This changes the returned text, not the record or its nested values:

```js
import { parse, TimeFormat, RangeDashFormat } from "klog.js";

const [record] = parse(`2024-05-05 (8h!)
    9:00 - 17:00 Work
    -30m Break
`);

record.toString({
  indentation: "  ",
  timeFormat: TimeFormat.TwelveHour,
  rangeDashFormat: RangeDashFormat.NoSpaces,
  duration: { explicitPositive: true },
});
// 2024-05-05 (+8h!)
//   9:00am-5:00pm Work
//   -30m Break
```

All options are optional. Omitted properties retain each value's stored
formatting or the existing defaults:

| Option                          | Values / effect                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `indentation`                   | Two, three, or four spaces, or `"\t"`; continuation lines use two units.                                                                                          |
| `timeFormat`                    | `TimeFormat.TwelveHour` or `TimeFormat.TwentyFourHour`, for all range endpoints.                                                                                  |
| `rangeDashFormat`               | `RangeDashFormat.Spaces` or `RangeDashFormat.NoSpaces`.                                                                                                           |
| `duration`                      | `{ explicitPositive, zeroSign }`, applied to duration entries and the should-total. `zeroSign` is `""`, `"+"`, or `"-"` and is independent of `explicitPositive`. |
| `dateFormat`                    | `RecordDateFormat.Dashes` or `RecordDateFormat.Slashes`.                                                                                                          |
| `newline`                       | `"\n"` or `"\r\n"`; when supplied, normalizes line breaks throughout the output.                                                                                  |
| `summaryWrapWidth`              | Positive safe integer: soft full-line width for record and entry summaries, including indentation and entry prefixes.                                             |
| `openRangePlaceholderCharCount` | Positive safe integer controlling the number of `?` characters in an open range.                                                                                  |

Existing no-argument calls keep their behavior. Standalone entries accept the
same entry-related options, while preserving `entry.toString("\t")` and
`entry.toString(null)` (no indentation).
`Duration.toString({ explicitPositive, zeroSign })` and
`Range.toString({ format, timeFormat, openRangePlaceholderCharCount })` also
accept per-render overrides. Summary wrapping is not performed automatically.

### Wrapping summaries (opt-in)

Set `summaryWrapWidth` to wrap record and entry summaries during rendering:

```js
const [record] = parse(`2024-05-05
alpha beta gamma delta
    1h alpha beta gamma delta
`);

record.toString({ indentation: "  ", summaryWrapWidth: 15 });
// 2024-05-05
// alpha beta
// gamma delta
//   1h alpha beta
//     gamma delta
```

This does not change the record, its summaries, tags, totals, or JSON output.
Omit the option to retain the original formatting. Standalone entries accept
`summaryWrapWidth` too.

- The width counts the **whole rendered line**, including indentation and the
  formatted duration/range prefix, not just summary text. Headers are not
  wrapped.
- Width is measured in Unicode code points, with a tab counting as one
  character; it is not a terminal display-column measurement.
- Wrapping is greedy at spaces/tabs outside tags. Complete quoted tag values,
  adjacent tags, URLs, and other unbroken words are never split or
  canonicalized.
- The limit is **soft**: an indivisible word/tag, a long entry prefix, or
  preserved alignment/trailing whitespace can exceed it. No empty line is
  inserted merely to move the first word after a long prefix.
- Explicit line breaks are retained, not joined into paragraphs. Leading
  alignment is repeated on wrapped continuations; other spaces/tabs are
  preserved except the separating run replaced by a wrap.
- Wrapped summaries normalize CRLF to LF. Use `newline: "\r\n"` on the record to
  render CRLF throughout.

For standalone summaries, `Summary.toString()` accepts a `SummaryFormatOptions`
object: `{ wrapWidth, indentation, startOnNextLine, firstLineOffset }`.
`firstLineOffset` is the non-negative safe-integer character count of an
embedding prefix (normally zero; entries supply it automatically). Continuations
use two indentation units. Existing
`summary.toString(indentation, startOnNextLine)` calls remain supported.

### Exporting upstream-compatible JSON

`toKlogJSON()` returns a plain object matching a record inside upstream
`klog json`'s `records` array:

```js
const [record] = parse(`2024-05-05 (8h!)
    9:00 - 17:00 Work #Project="Ab/c"
    -30m Break
`);

const result = record.toKlogJSON();
console.log(result.total); // "7h30m"
console.log(result.total_mins); // 450
console.log(result.diff); // "-30m"
console.log(result.entries[0].type); // "range"

const text = JSON.stringify(result, null, 2);
```

Use `records.map(record => record.toKlogJSON())` to export several records.
`Entry.toKlogJSON()` returns an upstream entry object; `Summary.toKlogJSON()`
returns the shared `{ summary, tags }` fields. The exported TypeScript types
include `KlogRecordJSON`, the discriminated `KlogEntryJSON` union, and
`KlogSummaryJSON`.

Durations and totals use upstream's canonical signs. Tag strings are sorted,
retain duplicates, and use upstream's casing and quoting rules. Open ranges have
no `end` fields and contribute zero minutes. Dates and time endpoints reflect
the model's stored formats, not prior `toString()` overrides; parsed date
separators currently normalize to dashes.

This exports record data only: it does not implement the CLI's top-level
`{ records, errors, warnings }` envelope, filtering, or `--now` option. Use
`getWarnings()` separately when needed. Existing `toJSON()` methods and
automatic `JSON.stringify(record)` serialization are unchanged.

### Checking records for likely mistakes

Warnings are opt-in and do not change records, parsing, or calculated totals:

```js
const [record] = parse(`2024-05-05
    8:00 - 10:00
    9:00 - 11:00
`);

record.getWarnings({ now: new Date(2024, 4, 5, 12, 0) });
// [{ code: "OVERLAPPING_RANGES", message: "Overlapping time ranges" }]
```

Omit `now` to use the current time. Dates and shifted times are interpreted
using local calendar days and wall-clock minutes. The result contains at most
one `{ code, message }` object per category, in this order:

- `UNCLOSED_OPEN_RANGE`: an open range on a record dated before yesterday.
- `FUTURE_ENTRIES`: a range endpoint/open start more than 30 whole minutes in
  the future, or a duration on a future record date. Empty future records do not
  warn.
- `OVERLAPPING_RANGES`: intersecting ranges; touching endpoints and zero-length
  ranges do not count. As in upstream klog, open ranges are provisionally
  treated as ending at 23:59 on the record's day for this check only. An open
  start at or after that boundary is ignored by the overlap check.
- `MORE_THAN_24H`: the record's net total exceeds 24 hours. Negative durations
  deduct from the total, and open ranges still contribute zero.

These are hints, not validation errors: overlaps and large totals remain valid
klog data. `getWarnings()` examines one record only; unlike upstream's
collection-level checker, it cannot warn about yesterday's open range based on
the presence of another record today. An invalid record date or `now` throws.

## Klog Format

The Klog file format is a plain-text format for time tracking. For detailed
information on the Klog format, visit the
[Klog documentation](https://klog.jotaen.net/#file-format).

## TODO

- [x] Opt-in wrapping of summary lines.
- [x] Applying the same formatting options across all entries in a record.
- [x] Get warnings for a record (similar to how Klog does).
- [x] `toKlogJSON` for classes that returns an object compatible with
      `klog json`.
- [ ] Other miniscule fixes around formatting, especially with summaries.

## Development

The Nix dev shell includes Node, pnpm, and upstream `klog-time-tracker`. JSON
conversion tests run its `klog json` command against temporary files, so use:

```sh
nix develop -c pnpm test
```

To check another installed upstream release, set `KLOG_BIN` to its executable
path when running the tests. The comparison tests fail rather than skip when
`klog` is unavailable.

## Reporting Bugs

If you find a Klog file that works fine with the original
[Klog tool](https://github.com/jotaen/klog) by @jotaen but does not also work
with this library, please
[open an issue](https://github.com/Ovyerus/klog-js/issues/new) with the problem
file and what's wrong and we will do our best to fix it.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.

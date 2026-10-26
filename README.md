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

- [ ] Automatic wrapping of summary lines?
- [ ] Applying the same formatting options across all entries in a record.
- [x] Get warnings for a record (similar to how Klog does).
- [ ] `toKlogJSON` for classes that returns an object compatible with
      `klog json`.
- [ ] Other miniscule fixes around formatting, especially with summaries.

## Reporting Bugs

If you find a Klog file that works fine with the original
[Klog tool](https://github.com/jotaen/klog) by @jotaen but does not also work
with this library, please
[open an issue](https://github.com/Ovyerus/klog-js/issues/new) with the problem
file and what's wrong and we will do our best to fix it.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.

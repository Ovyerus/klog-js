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
  2h  Working on project A
  1h  Meeting with client

2024-06-02
  3h  Development work
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

## Klog Format

The Klog file format is a plain-text format for time tracking. For detailed
information on the Klog format, visit the
[Klog documentation](https://klog.jotaen.net/#file-format).

## Reporting Bugs

If you find a Klog file that works fine with the original
[Klog tool](https://github.com/jotaen/klog) by @jotaen but does not also work
with this library, please
[open an issue](https://github.com/Ovyerus/klog-js/issues/new) with the problem
file and what's wrong and we will do our best to fix it.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.

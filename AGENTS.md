# AGENTS.md

## Project

`klog.js` is a TypeScript, ESM library for parsing, manipulating, and
serialising [klog](https://klog.jotaen.net/) plain-text time-tracking files. It
is not a port of the upstream command-line application. Keep runtime code usable
in browsers; avoid introducing Node-only APIs into `src/`.

## Layout and ownership

- `src/grammar.ohm`: source of truth for the Ohm grammar.
- `src/parser.ts`: grammar-to-AST mapping, `parseAST`, and `parse`.
- `src/types.ts`: AST types and shared formatting types.
- `src/{duration,time,range,entry,record,summary}.ts`: public data classes,
  arithmetic, tags, and serialisation.
- `src/index.ts`: public exports. Imports within `src/` use `.js` extensions for
  TypeScript's `NodeNext` output; preserve that convention.
- `tests/ast.test.ts`: grammar and AST tests; `tests/parse.test.ts`: conversion
  into public classes. Other test files exercise the matching data classes.
- `tests/corpus/` and `tests/result/`: input fixtures and expected ASTs.
  Existing result fixtures are tracked even though `result` is in `.gitignore`;
  check that any new expected-result files are actually included in your change.
- `dist/` and `src/grammar.ohm-bundle.*`: generated and ignored. Do not edit
  these as a fix; regenerate them from the grammar.
- `tests/parser-compatibility.test.ts`: whole-file boundary, whitespace,
  indentation, shifted range, and summary round-trip regressions.
- `tests/warnings.test.ts`: opt-in record warning categories, reference times,
  day shifts, and non-mutation guarantees.

## Documentation

Keep AI-oriented reviews, investigation notes, and verification reports under
`docs/ai/`, not at the repository root. Do not add these reports or links to
them to the README; keep it focused on useful human-facing library
documentation.

## Development commands

Use the existing pnpm lockfile and package scripts. `flake.nix` provides Node
and pnpm. If they are not on PATH, prefix commands with `nix develop -c`.

```sh
pnpm install --frozen-lockfile
pnpm generate:dev   # required after editing grammar.ohm, before running tests
pnpm test          # Vitest, one complete run
pnpm build         # regenerate grammar, compile TS/declarations, populate dist
pnpm format:check  # Prettier across the repository
```

For focused work: `pnpm exec vitest --run tests/ast.test.ts` (or another test
file). `pnpm test:watch` is available for interactive use. Format only intended
files with `pnpm exec prettier --write <paths>` rather than reformatting
unrelated code. Run the full test suite, build, and format check before handing
off code.

Dependency changes must keep `package.json` and `pnpm-lock.yaml` together. The
Nix package also has a fixed dependency hash in `package.nix`; review/update it
when changing the dependency closure.

## Format compatibility and tests

Use upstream's
[file-format specification](https://github.com/jotaen/klog/blob/main/Specification.md)
as the normative reference. Pin the upstream release/commit when investigating
compatibility; CLI and file-format version numbers are separate. Compare the
actual binary too where behavior is ambiguous, and report spec/binary
differences rather than silently choosing one.

Keep syntax in the grammar, AST conversion in the parser, and data-model
behavior in the corresponding class. Check both `parseAST` and `parse`: the
latter also runs constructor validation. Preserve the existing public API unless
a behavior change is deliberate and documented.

For parser changes, test accepted and rejected input, resulting entries/totals,
and parse/serialise/reparse behavior—not just whether a parse succeeds. Cover
summary boundaries, indentation, blank lines, LF/CRLF, shifted times and
midnight, zero/negative durations and targets, and repeated calls to tag helpers
as relevant. Do not assume existing passing tests establish complete format
conformance; compare ambiguous cases with the specification and pinned upstream
binary.

Dates represent calendar days, not UTC instants. Existing tests use local
`new Date(year, monthIndex, day)` values; avoid introducing timezone-dependent
UTC-string comparisons. Time arithmetic uses whole minutes and explicit day
shifts. Open ranges contribute zero by default, and duplicate dates remain
separate records.

`tests/setup.ts` installs a custom equality tester for `Duration`; assertions
using `toEqual` may ignore formatting options. Assert those options or rendered
strings explicitly when they matter.

Keep the library's own JSON representation distinct from upstream `klog json`.
Upstream JSON compatibility is a README TODO, not an existing API guarantee.
Record warnings are opt-in via `Record.getWarnings({ now })`; keep warning
checks non-mutating and distinct from parser validation. Do not add CLI commands
or dependencies merely to mirror a new upstream CLI release.

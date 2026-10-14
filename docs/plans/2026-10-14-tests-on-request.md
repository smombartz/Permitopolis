# Fast iteration: Claude runs typecheck + lint only, tests on request

## Context

The full test suite (`pnpm test`, 3,245 tests) takes ~110s: the unit project (61 files in `lib/` and
`tests/*.test.ts`, node) ~13s, the render project (40 files in `tests/render/`, jsdom, whole pages
mounted) ~90s. Small changes with Claude are slow because CLAUDE.md tells agents to run
`pnpm test` (and `pnpm check`) before finishing. The user wants to stop that for now.

Decided with the user:
- Default during work: `pnpm typecheck` + `pnpm lint` only (~15s). No tests.
- Tests (any of them) and `pnpm check` run only when the user asks. Not before commits either.
- The tests themselves stay in the repo, unchanged: nothing is deleted or skipped in config.

## Changes

### 1. `CLAUDE.md`
- **New short section "Testing for now"** (near Verification): agents check work with
  `pnpm typecheck` and `pnpm lint` only. Do not run `pnpm test`, `pnpm check` or `pnpm build`
  unless the user asks. When asked, prefer the narrowest run: `pnpm test:unit`, a single file
  (`pnpm vitest run path/to/file.test.ts`), or `-t "name"`. Still keep tests in step with code
  (update a test whose behavior you change) but don't run the suite to confirm it. Temporary:
  say "turn the tests back on" to restore.
- **Build rules → "Working in a worktree"**: "`pnpm typecheck`, `pnpm lint` and `pnpm test` must
  pass" → "`pnpm typecheck` and `pnpm lint` must pass".
- **Commands**: `pnpm check` line → "the full gate (type-check, lint, tests, build); run only when
  the user asks". Add `pnpm test:unit` (~13s) and `pnpm test:render` (~90s).

### 2. `package.json` scripts (convenience for narrow runs)
- `"test:unit": "vitest run --project unit"`
- `"test:render": "vitest run --project render"`
- `test`, `check` and `vitest.config.mts` unchanged.

### 3. Memory
- Save a `feedback` memory: during this phase, don't run tests unless asked; typecheck + lint
  only. Why: the suite takes ~110s and slows small changes. Lets future sessions follow it even if
  they skim CLAUDE.md.

### 4. Housekeeping (per CLAUDE.md)
- Copy this plan to `docs/plans/2026-10-14-tests-on-request.md`.
- `docs/log.md` entry at the top.
- `docs/readme.md`: if it describes `pnpm check` as the gate agents run, add one line noting the
  temporary tests-on-request rule.

## Note
Another session has uncommitted wizard work in the tree (`docs/log.md` included). Edit
`docs/log.md` with a targeted insert at the top only, and commit nothing.

## Verification
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm test:unit --help`-free sanity check: confirm the two new scripts resolve by reading
  `package.json` (no test run, per the new rule).

## Changes

- 2026-10-14: all steps done.

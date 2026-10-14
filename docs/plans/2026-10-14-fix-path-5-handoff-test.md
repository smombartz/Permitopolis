# Fix the failing "path 5" handoff test

## Context

`pnpm test` has 1 failure out of 3,242, and it fails on master too (not caused by the city tabs change):

- `tests/render/handoffs.test.tsx` › "path 5: … a new plaza event that day is warned"
- Error: `Unable to find a label with the text of: Width (ft)`

Cause: commit `0b3755d` ("Where step always opens on Bookable spaces") changed `components/map/LocationPicker.tsx` so the wizard's Where step opens on the **Bookable spaces** tab for every event type. The "Width (ft)" field only exists on the **Draw an area** tab. That commit updated the same flow in `tests/render/applicant-states.test.tsx` (it now clicks the "Draw an area" tab first) but missed the copy of the flow at the end of path 5.

This is a stale test, not an app bug: the new behavior is intended and documented (`docs/plans/2026-10-13-where-step-map-full-width.md`).

## Change

`tests/render/handoffs.test.tsx`, around line 949, in path 5, right after the first `Next` and before `user.clear(screen.getByLabelText("Width (ft)"))`: add the same step and comment that `applicant-states.test.tsx:114-116` uses:

```ts
// The map opens on "Bookable spaces" whatever the event type; "Draw an area" starts on City Hall Plaza.
await user.click(screen.getByRole("tab", { name: "Draw an area" }));
```

No app code changes.

## Housekeeping (per CLAUDE.md)

- Copy this plan to `docs/plans/2026-10-14-fix-path-5-handoff-test.md`
- Add a `docs/log.md` entry at the top

## Verification

1. `pnpm vitest run tests/render/handoffs.test.tsx -t "path 5"`: passes
2. `pnpm typecheck`, `pnpm lint`, `pnpm test`: full suite green (0 failures)

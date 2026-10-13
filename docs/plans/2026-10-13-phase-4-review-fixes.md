# Phase 4 review fixes

The Phase 4 acceptance review (read-only, against the merged `build` tree after the integration)
returned 18 findings: 1 high, 8 medium, 9 low. This plan fixes the high one and every medium one,
and each low one that takes a few lines. Each finding is confirmed in the code first (a reviewer
can be wrong), gets a test that fails because of it (a render test that clicks the path for a dead
click, a unit test for logic), and is fixed with the smallest change that holds. The parent plan is
`2026-10-12-permitopolis-prototype.md`.

Nothing here is checked in a browser (CLAUDE.md): what is visible is handed to the owner to look at.

## Order

The high finding first, committed once `pnpm check` passes. Then the medium and low ones, committed
again.

### High

- [x] H1 "With the city" counts the days the named holder has had the card, not the days since it
      was uploaded: `withCityInfo()` in `lib/view/board.ts`. `tests/both-sides.test.ts` compares the
      figure with the Intake row's and the queue row's

### Medium

- [ ] M1 Cases table: "Next action" and "Due" come from one task, the one due soonest
      (`pipelineTableRow()`)
- [ ] M2 Routing sections list only what a reviewer checks, with "Vendor health permits" for the
      per-vendor card; the wizard's sentence lower-cases each item (`lib/rules/routing.ts`)
- [ ] M3 Request information: a template's `{vendor}` is filled from the ticked card
- [ ] M4 A review resumed after a request: the queue row says "Answer received", counts the days
      from the last open stretch, and the review's due date moves by the days paused
- [ ] M5 Your actions lists the viewer's own open tasks ahead of the generic rows
- [ ] M6 Reviews tab: "Mark held" asks the engine, and the engine names what unlocks the card and
      refuses a meeting before its day
- [ ] M7 Wizard stepper: every step reached is a button with the done mark
- [ ] M8 A series' cancellation refund applies the band to what was paid

### Low (each a few lines)

- [ ] L1 Board status strip reads off `involvement()`: "Starts after intake", "Nothing to review"
- [ ] L2 A reviewer's queue row shows the triggers that routed it (`routingReasons()`)
- [ ] L3 One name per step for the task, the button and the panel heading
- [ ] L4 The "Merged" badge shows to city staff only
- [ ] L5 A fee preset starts at 1 when the plan gives 0; a zero-quantity line blocks the decision
- [ ] L6 "Actual fees" leaves the deposit out
- [ ] L7 Waiting on others lists only cases where somebody else is up (or the case is stalled)
- [ ] L8 Map thumbnail keys repeat-safe
- [ ] L9 Copy: "(automatic for Instant)", "Not routed", the cancelled banner's amount, "sign-offs",
      plural fee units
- [ ] L10 States matrix: the four entries render the state they name

## Changes

- 2026-10-13: Plan created. H1 confirmed (S4 31 against 20; St. Agnes 63 against 54; East End
  Baptist 44 against 42; Farmers Market 11 against 7; Movie Night 10 against 6) and fixed.

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

- [x] M1 Cases table: "Next action" and "Due" come from one task, the one due soonest
      (`pipelineTableRow()`)
- [x] M2 Routing sections list only what a reviewer checks, with "Vendor health permits" for the
      per-vendor card; the wizard's sentence lower-cases each item (`lib/rules/routing.ts`)
- [x] M3 Request information: a template's `{vendor}` is filled from the ticked card
- [x] M4 A review resumed after a request: the queue row says "Answer received", counts the days
      from the last open stretch, and the review's due date moves by the days paused
- [x] M5 Your actions lists the viewer's own open tasks ahead of the generic rows
- [x] M6 Reviews tab: "Mark held" asks the engine, and the engine names what unlocks the card and
      refuses a meeting before its day
- [x] M7 Wizard stepper: every step reached is a button with the done mark
- [x] M8 A series' cancellation refund applies the band to what was paid

### Low (each a few lines)

- [x] L1 Board status strip reads off `involvement()`: "Starts after intake", "Nothing to review"
- [x] L2 A reviewer's queue row shows the triggers that routed it (`routingReasons()`)
- [x] L3 One name per step for the task, the button and the panel heading
- [x] L4 The "Merged" badge shows to city staff only
- [x] L5 A fee preset starts at 1 when the plan gives 0; a zero-quantity line blocks the decision
- [x] L6 "Actual fees" leaves the deposit out
- [x] L7 Waiting on others lists only cases where somebody else is up (or the case is stalled)
- [x] L8 Map thumbnail keys repeat-safe
- [x] L9 Copy: "(automatic for Instant)", "Not routed", the cancelled banner's amount, "sign-offs",
      plural fee units
- [x] L10 States matrix: the four entries render the state they name

## Changes

- 2026-10-13: Plan created. H1 confirmed (S4 31 against 20; St. Agnes 63 against 54; East End
  Baptist 44 against 42; Farmers Market 11 against 7; Movie Night 10 against 6) and fixed.
- 2026-10-13: All 18 findings confirmed in the code and fixed; none skipped. What turned out
  differently from the plan as written:
  - **H1**: the count is the holder's days (the review's first option), not a reworded upload
    count. The city's Documents tab still counts from the upload, and says the upload's date
    beside it; `tests/both-sides.test.ts` now holds the board's figure to be no more than that
    one, and equal to the Intake row's or the queue row's.
  - **M2**: "what a reviewer checks" keeps the community notice on the Clerk's line, because
    completing that card sends it to the Clerk for a check (`needsCheck`). Everything else the
    review named (submitting, signing, paying, meetings, the download) is out.
  - **M4**: the due date is moved by calendar days and is not rolled off a weekend, so it stays
    the day the clock reads "Day 14 of 14". "Routed" is read from the review clock's start on
    every review row, not only on resumed ones.
  - **M5**: a task button wraps its title instead of truncating it: "Schedule the
    pre-application meeting" is wider than the 280px panel on one line.
  - **M6**: the locked reason is Who's up's wording for city staff ("Unlocks when the permit is
    issued"), not the card's own ("your permit"), since a Clerk reads it. The seed already held
    each meeting on its scheduled day, so no script changed.
  - **M7**: `reached` is the furthest step seen on this visit or answered on the draft. The
    plan (step 5) holds no answer, so it is marked only once it has been seen: a draft reopened
    on Where does not show "Plan, done".
  - **M8**: fixed in `cancellationRefund()` (`lib/rules`), where the review asked for its test,
    so `refundIfCancelled()` and `cancel` follow without a change of their own. The cap at what
    was paid stays as a guard. Two render tests and one unit test asserted the capped $20 and
    now assert $10.
  - **L3**: seven titles in `CITY_TASKS` (the catalogue file is marked frozen; the brief for
    these fixes allows any file, and no id changed), two literals in the transitions replaced by
    the catalogue's, and the quote builder's heading. "Review your sections" and "Decide: a reviewer
    denied" were not in the finding and are unchanged.
  - **L8**: the display map (`PermitopolisMap`) keyed its shapes the same way and is fixed with
    the thumbnail. Its overlap count also counted a lapped route against itself, so Four Bridges
    Ultra alone on the map read "Overlap": one more line, with a test.
  - **L10**: the refused-action entry keeps its disabled-button case and gains two where an
    enabled control is used and the engine refuses the result (a department unticked in Confirm
    routing; a blackout date typed into Schedule). Every panel asks the engine before the click,
    so no enabled submit button can be refused in the app as built; the test also dispatches the
    refused list and compares the reason.
  - Nine product choices the fixes made are in `docs/readme.md` under "Open questions for the
    owner".

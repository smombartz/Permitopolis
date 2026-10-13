# Phase 3 review fixes

The Phase 3 review (two read-only reviewers, one on the applicant side and one on the city side)
returned 38 findings against the merged `build` tree: 2 high, 23 medium, 13 low. This plan fixes
every high and medium one and each low one that takes a few lines. Each finding is confirmed in
the code first (a reviewer can be wrong), gets a test that fails because of it (a render test that
clicks the path for a dead click, a unit test for logic), and is fixed with the smallest change
that holds. The parent plan is `2026-10-12-permitopolis-prototype.md`.

Nothing here is checked in a browser (CLAUDE.md): layout findings are fixed from the classes and
handed to the owner to look at.

## Order

High findings first, committed once `pnpm check` passes. Then the medium and low ones, committed
again.

### High

- [x] H1 Refund shown is what the cancel transition pays: `refundIfCancelled()` in `lib/state`,
      used by `cancel()`, the permit page and the board's Cancel dialog
- [x] H2 A card's form is printed with labels and readable values: `formRows()` in
      `lib/view/caseDetail.ts`, used by the Documents tab and the Verify / Send back panels

### Medium, applicant side

- [x] A1 Board card sheet: a finished document offers "Replace this file" only after a new file is
      chosen, and only where the engine takes it
- [x] A2 Board card sheet: a form card that is with the city or accepted is read-only
- [x] A3 Wizard step 3: the lead-time banner says "N days away, needs M days' notice"
- [x] A4 Wizard: Next on a blank wizard creates the draft and moves on
- [x] A5 Wizard: one draft per visit, whatever the URL has caught up with
- [x] A6 Wizard step 4: vendor names can be typed (raw text kept locally)
- [x] A7 Wizard step 3: a date change rebuilds the recurrence's weekday and end
- [x] A8 Wizard step 5: the lead-time gate and its three fixes are on the plan step too
- [x] A9 Sheets are bottom sheets below 640px (side rules scoped to `sm` and up)
- [x] A10 Board column tabs fit 375px (two rows of two)
- [x] A11 `CaseHeader` takes `compactStepper`; the board and the quote set it when narrow
- [x] A12 `FeeTable` takes `compact` (two columns); the wizard panel and narrow screens use it
- [x] A13 Wizard: tier change is announced and highlighted from `WizardScreen`, on a phone too
- [x] A14 Checkout: the paid state stays on screen until the next page arrives
- [x] A15 State stepper reserves room for the Needs info pill

### Medium, city side

- [x] C1 Cases search keeps its text in local state and writes the URL after a pause
- [x] C2 Pipeline board: a State filter shows only that column; columns flex to fit
- [x] C3 Closeout: `closeoutSettlement()` drives `reconcile_close`, the tab and the panel
- [x] C4 Log closeout: refused once logged; the panel seeds from actuals and never doubles a line
- [x] C5 Needs info: `Send quote` says what it waits for; an intake request keeps the intake set
- [x] C6 Active permits: choosing a day opens its map; the day is marked; the map has a date field
- [x] C7 Role overlay totals count the permits shown, not every case
- [x] C8 Intake: Accept as complete goes on to Confirm routing

### Low (each a few lines)

- [x] L1 Late fee chosen: the banner confirms it and offers Undo
- [x] L2 Permit: the whole cancellation schedule, today's band marked, deposit named, hidden when
      cancelling is no longer possible
- [x] L3 Finished payment and sign-off cards show the amount, date or signature and a link
- [x] L4 Wizard stepper labels stay available to assistive tech below `sm`
- [x] L5 Vendor rows carry a status word; the quote's condition checkbox has a visible "I accept"
- [x] L6 Demo guide table wraps; landing page landmarks
- [x] L7 In-person payment on a paid quote is disabled with a reason
- [x] L8 j/k and arrow navigation leaves modified keys, handled events and widgets alone
- [x] L9 My queue shows the review clock on review tasks only
- [x] L10 Meeting cards open Schedule or Close for the Clerk and the host department
- [x] L11 Confirm routing refuses a missing or past due date
- [x] L12 An undated task that has waited more than a week is "This week", not "Later"
- [x] L13 Copy: plurals, "None", endings, date chips, the Clerk's review row, board card date
- [x] L14 Decided reviews drop "Decide your review"; commission is sent once
- [x] L15 Cases table rows keep their semantics; sortable headers carry `aria-sort`

## Changes

- 2026-10-13: Plan created.
- 2026-10-13: All 38 findings confirmed in the code and fixed; none skipped. What turned out
  differently from the plan as written:
  - **H2**: `formRows()` lives in `lib/view/cardForms.ts` (re-exported from
    `lib/view/caseDetail.ts`) and `FormAnswers` in `components/domain`, because A2 reads the same
    form back on the applicant's board and a surface may not import another surface.
  - **A4**: Next on a blank wizard follows the URL's step and starts no draft. The review's first
    suggestion (create the draft on Next) would have left an empty "New event" in My events for
    every stray click.
  - **A5, C1, A14** all live in the gap between `router.push()` and the URL catching up, which
    the render harness's synchronous router hid. The harness gained `holdNavigation()` and
    `releaseNavigation()` so each has a test that fails without its fix.
  - **C1** uncovered a crash it would otherwise have introduced: `?from=` and `?to=` were passed
    to the date formatter unchecked. `parseCasesFilters()` now ignores anything that is not a date.
  - **C5**: `requireState()` reads "Not available while the case is in Needs info." for every
    state (three test expectations of "This case is permitted." changed with it), and the Clerk
    may ask again at intake while a first request is out, so "Request information" in the intake
    set is a live button.
  - **L7**: the engine refuses any payment toward a quote that is paid in full, not only the row
    asked for with no amount. `tests/seed.test.ts` holds that a disabled row is refused for the
    reason shown, so a row-only check would have broken that rule (and still recorded the
    overpayment).
  - **L12**: done in `dueGroup()` (an undated task that has waited more than seven days is "Due
    this week"). The Clerk's opening queue in the seed changes with it: 1 overdue, 7 for this
    week, none later; `tests/seed.test.ts` and `lib/view/cityLists.test.ts` assert the new rows.
    It is recorded as an open question for the owner.
  - **C8**: Intake's Accept goes on to the case with Confirm routing open (the review's first
    option). Demo path 4's click-through in `tests/render/handoffs.test.tsx` follows the new step.
  - Six product choices the review left open are in `docs/readme.md` under "Open questions for
    the owner".

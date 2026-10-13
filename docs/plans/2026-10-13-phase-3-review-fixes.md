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

- [ ] A1 Board card sheet: a finished document offers "Replace this file" only after a new file is
      chosen, and only where the engine takes it
- [ ] A2 Board card sheet: a form card that is with the city or accepted is read-only
- [ ] A3 Wizard step 3: the lead-time banner says "N days away, needs M days' notice"
- [ ] A4 Wizard: Next on a blank wizard creates the draft and moves on
- [ ] A5 Wizard: one draft per visit, whatever the URL has caught up with
- [ ] A6 Wizard step 4: vendor names can be typed (raw text kept locally)
- [ ] A7 Wizard step 3: a date change rebuilds the recurrence's weekday and end
- [ ] A8 Wizard step 5: the lead-time gate and its three fixes are on the plan step too
- [ ] A9 Sheets are bottom sheets below 640px (side rules scoped to `sm` and up)
- [ ] A10 Board column tabs fit 375px (two rows of two)
- [ ] A11 `CaseHeader` takes `compactStepper`; the board and the quote set it when narrow
- [ ] A12 `FeeTable` takes `compact` (two columns); the wizard panel and narrow screens use it
- [ ] A13 Wizard: tier change is announced and highlighted from `WizardScreen`, on a phone too
- [ ] A14 Checkout: the paid state stays on screen until the next page arrives
- [ ] A15 State stepper reserves room for the Needs info pill

### Medium, city side

- [ ] C1 Cases search keeps its text in local state and writes the URL after a pause
- [ ] C2 Pipeline board: a State filter shows only that column; columns flex to fit
- [ ] C3 Closeout: `closeoutSettlement()` drives `reconcile_close`, the tab and the panel
- [ ] C4 Log closeout: refused once logged; the panel seeds from actuals and never doubles a line
- [ ] C5 Needs info: `Send quote` says what it waits for; an intake request keeps the intake set
- [ ] C6 Active permits: choosing a day opens its map; the day is marked; the map has a date field
- [ ] C7 Role overlay totals count the permits shown, not every case
- [ ] C8 Intake: Accept as complete goes on to Confirm routing

### Low (each a few lines)

- [ ] L1 Late fee chosen: the banner confirms it and offers Undo
- [ ] L2 Permit: the whole cancellation schedule, today's band marked, deposit named, hidden when
      cancelling is no longer possible
- [ ] L3 Finished payment and sign-off cards show the amount, date or signature and a link
- [ ] L4 Wizard stepper labels stay available to assistive tech below `sm`
- [ ] L5 Vendor rows carry a status word; the quote's condition checkbox has a visible "I accept"
- [ ] L6 Demo guide table wraps; landing page landmarks
- [ ] L7 In-person payment on a paid quote is disabled with a reason
- [ ] L8 j/k and arrow navigation leaves modified keys, handled events and widgets alone
- [ ] L9 My queue shows the review clock on review tasks only
- [ ] L10 Meeting cards open Schedule or Close for the Clerk and the host department
- [ ] L11 Confirm routing refuses a missing or past due date
- [ ] L12 An undated task that has waited more than a week is "This week", not "Later"
- [ ] L13 Copy: plurals, "None", endings, date chips, the Clerk's review row, board card date
- [ ] L14 Decided reviews drop "Decide your review"; commission is sent once
- [ ] L15 Cases table rows keep their semantics; sortable headers carry `aria-sort`

## Changes

- 2026-10-13: Plan created.

# Phase 2 review fixes

The Phase 2 review returned 21 findings (3 high, 14 medium, 4 low) against the merged `build`
tree. This plan fixes all of them before the seven Phase 3 screen builders start. Each finding is
confirmed in the code first, gets a failing test where the defect is in logic, and is fixed with
the smallest change that holds. The parent plan is `2026-10-12-permitopolis-prototype.md`.

## Order

Engine and seed first (later steps change the seed, so the seed test is edited once), then the
store and harness, then the shell and the shared components.

### Engine (`lib/state`, `lib/rules`)

- [x] E1 `complete_task` refuses cards that have their own action (pay, sign, sign-offs, submit,
      feedback, book again, carry permit, meetings), naming the action
- [x] E2 Days holding: counted from the last time the party's task opened; a plan card with no
      history falls back to the day the application went in (a Draft: the day it was started);
      cards added by an amendment are dated from the amendment
- [x] E3 A scheduled meeting is due on the day it is scheduled for (`schedule_meeting` sets the
      card's `dueDate`; unlocking keeps it)
- [x] E4 Review clock: the allowance is the Clerk's due date, not the config's default
- [x] E5 Ended cases: `pay` rows go through a shared `checkPay`; an ended case offers only
      `add_note`; its board has nothing in Do now, With the city or Coming up
- [x] E6 Payments: a `pay` row for a closed case with a final bill and for a permitted series
      with unpaid sessions; feedback can be given once
- [x] E7 Activity copy: "Decided: approved with conditions."
- [x] E8 A closed case releases its date hold (both close paths)
- [x] E9 Who's up: the Clerk keeps its own scope; the Clerk's `consolidate` task is created
      locked at routing so the Clerk reads "Waiting"; `PartyStatus.nextTask`
- [x] E10 Event-day series: the tick marks today's session `due`, relocks "Carry your permit"
      for the next session and dates it today on Event day

### Seed and demo script

- [x] S1 Queues: F2 and F3 reviews due in the coming week, F1 and F5 intake due on or after
      May 3, B11's verification after S5's; assert each role's opening queue exactly
- [x] S2 B16 pays its past sessions
- [x] S3 No city step on a weekend or blackout date
- [x] S4 Demo script: path 5's last step is the new applicant; every applicant step has a persona

### Store and render harness

- [x] H1 Hydrate once for every route (`StoreHydrator` in `app/layout.tsx`), one module-level
      flag behind `useHydrated()`, and no write to storage before the stored demo has been read
- [x] H2 Navigation mock is a reactive store: `push`/`replace` update pathname, search and
      params; one stable router; Link clicks navigate

### Shell

- [x] U1 "Set demo date" stays open (no focus hand-back to the menu trigger)
- [x] U2 Top bar shows only the wordmark and skeleton blocks until hydrated
- [x] U3 Role switch: the URL is kept only on shared city routes; a tool route belongs to its role
- [x] U4 Role switcher keyboard behaviour (roving tabindex); short demo date below 640 px
- [x] U5 `PlaceholderScreen standalone` gates on `useHydrated()`, as the pattern for shell-less pages

### Shared components

- [x] C1 `TaskCard`: scheduled date, locked card's date, changes requested with the reason,
      amendment chip, "Done <date>"
- [x] C2 `WhoIsUp`: heading, applicant name, next locked task above the note, up-now rows first
- [x] C3 `DeptStatusDots`: a status glyph and a keyboard-reachable tooltip

### Finish

- [x] `pnpm check` passes
- [x] `docs/readme.md`, `docs/log.md`, the parent plan's Changes section
- [x] Commit on `build`

## Result

All 21 findings fixed; none skipped. `pnpm check` passes: type-check, lint, 885 tests in 52 files
(was 760 in 49) and build. Every new test was run against the tree before the fixes and fails
there. Seven decisions the PRD does not settle are listed under "Open questions for the owner"
at the end of `docs/readme.md`.

## Changes

- 2026-10-12: Done. What changed from the plan as first written, and why:
  - **E2, days holding.** The review offered two fixes: write a first history entry on every plan
    card, or fall back to the case's own dates. The first would have changed S3's applicant from
    3 days (since Health & Legal asked) to 17 (since the card was created), so the fallback is
    what was built: a card with no history counts from the day the application went in, which
    gives S4 the 20 days the review asks for. Only amendment cards get a first entry, so they are
    not dated from the original booking. The count also had to start from the *last* time a task
    opened, not the first, or B16's "Carry your permit" would still read 63 days after E10.
  - **E3.** The date is set on the card (`dueDate`) and not derived in `taskDueDate()`, so the
    queue's grouping, which reads `task.dueDate`, agrees with it.
  - **E5.** Coming up is emptied for an ended case as well as Do now and With the city: a locked
    "Accept conditions and sign" on a denied case promises a quote that will not come.
  - **E1.** Two refusals beyond the review's list, same defect: a card with a reviewer's request
    open on it (answered with `respond_to_request`; completing it left the asker parked for
    good), and a city task named by id.
  - **E6.** The Clerk gets "Record an in-person payment" for a session and a final bill too: the
    engine takes both from the Clerk, and the Payments page (4E) needs the row.
  - **S1.** F2 and F3 were moved later (routed Apr 26 and Apr 27) and not only given later due
    dates, so their allowance stays the usual 14 days under E4. F2 is due Mon, May 10 and F3 Tue,
    May 11, so each role's queue opens with its planned overdue row and then its hero task.
  - **S3.** One weekend entry stays: F7's damage report on the Saturday of the picnic. An
    Instant event closes itself the next morning, so the report can only be logged on the day,
    and the PRD fixes that day. Recorded as an open question; the seed test names the exception.
  - **H1.** The write is held until the stored demo has been *read*, not until persist reports
    it hydrated: persist writes the fresh seed back when it drops a stale demo, before it sets
    that flag, and that write must go through.
  - **H2.** The harness also got a `stored` option and `prepareScreen()`, because the hydration
    gate (U2) can only be tested against the prerendered HTML and a demo already in storage.
  - **U4.** Arrow keys select as they move, as in a radio group. The alternative (toggle
    buttons) is noted as an open question, since a role switch can navigate.
  - **C3.** The tooltip is on the row of markers, one tab stop per table row, not on each marker.
- 2026-10-12: Plan created.

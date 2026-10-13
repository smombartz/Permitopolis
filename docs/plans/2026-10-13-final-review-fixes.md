# Final review fixes

The final read-only review of the merged `build` tree (after Phases 5 and 6 and the accessibility
pass) returned 17 findings: 3 high, 6 medium, 8 low. This plan fixes every high and medium one, and
each low one that takes a few lines. Each finding is confirmed in the code first (a reviewer can be
wrong), gets a test that fails because of it, and is fixed with the smallest change that holds. The
parent plan is `2026-10-12-permitopolis-prototype.md`.

Nothing here is checked in a browser (CLAUDE.md): what is visible is handed to the owner to look at.

## Order

The three high findings first, committed once `pnpm check` passes. Then the medium and low ones,
committed again.

### High

- [x] H1 A `submit_by` card is never due in the past: `cardDueDate()` in
      `lib/rules/requirements.ts`. Path 7's amendment cards read "Overdue by 11 days" the moment
      they appeared
- [x] H2 The plan a permit covers carries its own fee lines: `permittedPlan()` returns the prior
      fee lines, and `refundIfCancelled()` works from it, so the permit page and `cancel` refund
      one figure ($62.50) while an amendment is pending
- [x] H3 A pending amendment lapses when the event arrives: `lapseAmendment()` restores the
      original plan in `applyTick()` before the tier is read

### Medium

- [x] M1 The amendment wizard's fee difference is the engine's own arithmetic
      (`lib/view/amend.ts`, on `amendedPlan()`)
- [x] M2 An amendment at Quote sent brings the payment card's amount in step (`requote()`)
- [x] M3 Work orders: a done row shows its plain date, not the live "Overdue" label
- [x] M4 Walkthroughs and meetings: Schedule is a link only when the engine allows it
- [x] M5 An issued permit reads its components off the stored record (`permitCovers()`)
- [x] M6 An approved amendment's reopened payment card has the Reviewed card's wording, and
      signing is listed before paying
- [x] M7 Reviews tab: a department named on an amendment's card "checks the amendment's card"
      (`unroutedDeptNote()`)

### Low (each a few lines)

- [x] L1 A series' session price comes from the case's own fee lines (`sessionPrice()`)
- [x] L2 Day-of food inspections list only events with a live permit
- [x] L3 The closures day strip counts closures and bookings apart
- [x] L4 Demo coach on path 7: two steps, the second stays current on the board
- [x] L5 Meetings: the panel's attendee list is the calendar's (`meetingAttendees()`)
- [x] L6 Amendment wording (plural, permit sentence, the estimate with the late fee, "Submit
      amendment", an empty Conditions heading)
- [x] L7 Raw values: MIME types, the `{vendor}` token, the Blackout section's copy, "hold expired"

## Changes

- 2026-10-13: Plan created.
- 2026-10-13: The three high findings confirmed in the code and fixed; `pnpm check` passes
  (3,162 tests). What turned out differently from the review's suggested fix:
  - **H1**: as suggested. The seed did not move: no seeded board was made inside its lead time.
  - **H2**: as suggested, plus one case the finding did not name. A part payment toward an
    approved amendment (the Clerk records $100 of the $393.75) was lost on cancelling once the
    refund was the permit plan's; `paidTowardPendingAmendment()` adds it back whole.
  - **H3**: the lapse is decided at the top of `applyTick()`, not inside the Event day branch,
    and the day that counts is the last session of the plan the permit covers (`permittedPlan()`),
    or the amended plan's own last session if that comes first. Reading only the record's date
    would have missed an amendment that moves the event later (the permit's day passes with the
    record still saying Jun 12) and left the case Permitted for good once restored. A lapse does
    more than a decline has to, because it can come after an approval: the Clerk's open decision
    is closed as `lapsed`, the reopened payment card goes back to how it stood (kept on the
    stash as `priorPay`, for a permitted case only), anything paid toward the amendment is
    refunded, a signature on the amendment's own card goes with the card, "Issue food permits"
    goes with its card, and the work orders are brought back in step. The activity entry is
    worded for the day it is written on ("it was not in effect by the event, which goes ahead
    under the original plan"), since it is logged when event day starts, not after.
- 2026-10-13: The six medium and eight low findings confirmed and fixed; none skipped.
  `pnpm check` passes (3,197 tests, 35 more than after the high findings). What turned out
  differently from the review's suggested fix:
  - **M1**: `amend()` was split so there is one builder of an amended record (`amendedPlan()`),
    and the wizard's diff reads it, instead of the view rebuilding the engine's arithmetic. The
    diff says whether the event is permitted: before the permit the difference is "Added to" or
    "Taken off your fees" against the current total, never "to pay" or "refunded". A permitted
    series shows its later sessions on a line of their own, so New total, Already paid, Later
    sessions and the difference add up. **A second defect was found by the new test**: the
    wizard's When step empties the session list on any edit, and `amend` read which sessions were
    paid from that list, so an hour added to a booked series refunded the session already paid.
    `amendedPlan()` takes the billing from the record.
  - **M2**: the card fix only. It is applied whenever an amendment changes the fee lines of a
    case whose quote is out (a pending amendment too, and a decline puts the figure back), not
    only for a change that adds no card. Sending such an amendment back to the Clerk to re-issue
    the quote is the owner's call and is recorded as an open question; the conditions on the
    quote are untouched.
  - **M3**: a done row reads "Was due Thu, Apr 22". The day it was finished is not shown.
  - **M4**: seven of the ten seeded rows had a link to a refused panel for Public Works & Safety,
    not six: four held, and the three coordination meetings still to come.
  - **M5**: `permitCovers(c)` in `lib/state/amendment.ts` also reads the block-party exception
    off the record (its trigger), where Issue permit asked `classify()` under the live config.
    `buildOverview()` lost its `cfg` parameter.
  - **M6**: as suggested, and the card's own reason comes back when the balance is paid, so a
    done card does not read "What your change adds" beside the whole amount. The order is a
    tie-break in `byDueDate()` for cards due the same day (sign first, pay last), not in
    `boardColumns()` alone, so Who's up and the "Next:" sentence name the same card as the board.
  - **M7**: the sentence is built in the view-model and names where each card is.
  - **L1**: the helper is used by the engine as well (`dueAtQuote()`, `amendmentBalance()`), not
    only by the four screens: with the live rate there, a doubled Field rate made an untouched
    series owe a refund. `estimateFees()` says which of its lines are per session
    (`perSessionLabels`).
  - **L2**: applied. It reverses a choice the Phase 5 integration had listed for the owner, on
    the PRD's wording ("Day-of food booth list per event"): the page is now empty on the seed.
  - **L4**: done once the amendment is submitted (past `proposed`), as the review offered.
  - **L6**: the summary line reads "$518.75 with the $53.75 late fee", so the activity entry no
    longer needs its second sentence. The board's pending banner had the same permit sentence on
    a case with no permit and is fixed with the review step.
  - **L7**: the ending is worded with `nextMove()`'s own phrases ("lost its date hold").
  - Ten product choices are in `docs/readme.md` under "Open questions for the owner", "From the
    final review fixes"; four older entries there were brought up to date.

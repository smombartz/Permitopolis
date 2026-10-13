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

- [ ] M1 The amendment wizard's fee difference is the engine's own arithmetic
      (`lib/view/amend.ts`)
- [ ] M2 An amendment at Quote sent that adds no card brings the payment card's amount in step
- [ ] M3 Work orders: a done row shows its plain date, not the live "Overdue" label
- [ ] M4 Walkthroughs and meetings: Schedule is a link only when the engine allows it
- [ ] M5 An issued permit reads its components off the stored record, not the live tier rules
- [ ] M6 An approved amendment's reopened payment card has the Reviewed card's wording, and
      signing is listed before paying
- [ ] M7 Reviews tab: a department named on an amendment's card "checks the amendment's card"

### Low (each a few lines)

- [ ] L1 A series' session price comes from the case's own fee lines
- [ ] L2 Day-of food inspections list only events with a live permit
- [ ] L3 The closures day strip counts closures and bookings apart
- [ ] L4 Demo coach on path 7: two steps, the second stays current on the board
- [ ] L5 Meetings: the panel's attendee list is the calendar's
- [ ] L6 Amendment wording (plural, permit sentence, the estimate with the late fee, "Submit
      amendment", an empty Conditions heading)
- [ ] L7 Raw values: MIME types, the `{vendor}` token, the Blackout section's copy, "hold expired"

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

# Phases 5 and 6 integration: P1 and P2 in one tree

Part of `docs/plans/2026-10-12-permitopolis-prototype.md` (section 9, "Integrate"). Six builders
added the P1 and P2 scope in parallel worktrees: amendment (5A), the Clerk's payments page and
meetings on the calendars (5B), Public Works & Safety's closures map and work orders (5C), Health
& Legal's verifications, vendor permits and inspections (5D), the demo coach and the command
palette (5E), and the Clerk's settings (6A). The run was cut off by a usage limit and resumed;
three builders had finished and three were finished in their worktrees on the resume. This is what
the integrator does once their branches are in one tree. It commits at every checkpoint.

## Steps

- [x] Merge `phase5/amend`, `coach`, `clerk`, `pws`, `hl`, `settings` into `build`, one at a time,
      no fast-forward. Install, run the gate, fix what the merge broke. (No conflicts. The one
      failure was the expected one: `amend` now has a control, so it left `KNOWN_GAPS` in
      `tests/action-coverage.test.ts`. 2,086 tests in 102 files.)
- [x] Decide the builders' engine requests against the PRD and the main plan; apply the right
      ones test-first and take out the builder's workaround. (Ten applied, one declined, and one
      builder's note about test coverage taken up; table below.)
- [x] Make the pieces meet, each with a test: no placeholder route left; every new list opens
      the case and the case returns to it; the coach agrees with `tests/demo-paths.test.ts` after
      every step; the amendment on the city side; meetings, work orders and closures agree with
      the case; settings flow into the wizard; action coverage, the states matrix and the
      hand-offs pass, with demo path 7 clicked through; a consistency pass over the new pages.
      (Twelve seams fixed; tables below.)
- [x] `docs/readme.md`: "P1 and P2 (Phases 5 and 6)", "What is still a placeholder", the builders'
      new questions for the owner (28).
- [x] `docs/log.md`: one entry per workstream and one for the integration. The main plan: Phases
      5 and 6 ticked, section 12, a Changes line.
- [x] Gate (`pnpm check`: type-check, lint, 2,262 tests in 105 files, build), commit, remove the
      merged worktrees and branches.

## Engine requests

Decided against the PRD (`docs/spec/prd.md`) and the main plan's sections 3 and 5.

| From | Request | Decision | Why |
|---|---|---|---|
| 5A | `amend` leaves `KNOWN_GAPS` | **Applied** | The amendment wizard's last step dispatches it. The list is empty |
| 5A | The permit page links to the amendment | **Applied** | The brief's own step. "Change your event" on the permit, gated by `canAmend()` like the board's menu |
| 5A | No city-side action or panel for the Clerk's decision: `amend` is raised by the Clerk too, and told apart by comparing its answers with the pending plan or the kept one | **Applied**, as a dedicated action | `decide_amendment` (`{ decision: "approve" \| "decline", reason? }`), Clerk only; `amend` is the applicant's alone again. Submitting an amendment creates the Clerk's task `decide_amendment`, locked while a department has one of the amendment's cards or has sent one back, so Who's up reads the departments first and then the Clerk, as Issue permit waits for the insurance. `DecideAmendment.tsx` is its panel; the case carries a banner for every city role. Workaround removed: the answer-matching in `decideAmendment()` |
| 5A | `checkPay` takes no quote payment on a Permitted case, so the Clerk's approval charges the difference itself | **Applied**, the other way round | An approval that charges a card nobody presented is not what a quote is, and `tests/engines.test.ts` (Phase 2) already said of the amended plan's balance "the rest comes with the amendment's quote", with "Accept conditions and sign" among the amendment's cards. So approval reopens the payment card for the difference and opens the signature card where the event never had one; `checkPay` and `checkAcceptAndSign` pass on a permitted case while that card is open; `/events/[id]/quote` is the quote page for it; the amendment takes effect when nothing is left to sign or pay. A difference in the applicant's favor is refunded at once, as the builder had it. Workaround removed: the charge inside `approveAmendment()` |
| 5B, 5C, 5D | `BACK_LABEL` lines for Payments, Closures and routes, Work orders, Verifications, Inspections | **Applied** | A case opened from a filtered list has to come back to it. Named as the sidebar names each page |
| 6A | A `BACK_LABEL` line for Settings | **Declined** | The only link was from "What this changes" to an open Draft, and the city has no page for a Draft (the case detail answers "This application is still a draft"). The panel names the Draft and its id without a link |
| 5B | The Clerk's license review reads as a generic review | **Applied** | PRD, "Licenses": the Clerk reviews the alcohol license "as its own review section, like any department". `reviewTaskTitle()` titles it "Review the temporary alcohol license"; its queue row reads "Your own review section, routed ...". No vending license exists apart from Health & Legal's food permits, so no second title |
| 5B | `CalendarItem` has no kind, so a meeting is listed under the grid, not drawn in its day | **Applied** | PRD, "Consultation": the meeting "appears on all three calendars". `kind: "meeting"` and `detail` on `CalendarItem`; `MonthGrid`, `WeekGrid` and `DayStrip` draw one through `ItemMark` (an icon and a dashed outline, "Meeting:" in its name, not counted among a day's events). Workaround removed: `components/active/MeetingsList.tsx` |
| 5D | `issue_food_permits`: a Health & Legal task created by `issue_permit`, finished once every vendor's health permit is verified; the applicant's card then reads as issued | **Applied** | The applicant could "download" permits nobody had issued. The task is locked until the last vendor is verified (the refusal says how many are out), and finishing it raises a new unlock event, `food_permits_issued`, which the applicant's card now waits for. S6's script has Health & Legal issue them on Apr 15, the day before the organizer's download. Workaround removed: the button that was disabled "for want of an engine step" |
| 5E | `activeDemoPath` on the store | **Applied**, and the fallback removed | `activeDemoPath` and `setActiveDemoPath()`, stored with the demo and cleared by Reset. Set by the guide, the coach's menu, the palette and every scenario jump. Workaround removed: `activeDemoPathId()`, which guessed the path from the URL, so the strip vanished on My queue and Active permits (where paths 1 and 4 end) and read path 2 on any blank wizard. A dismissal is now the store's too, so it holds across the two shells |
| 6A | `setConfig()` re-classifies open Drafts; the config is persisted and restored by Reset | **Applied** | PRD, Settings: "Changing a threshold re-classifies open drafts". `setConfig()` runs `syncDraft()` over every open Draft. The config was already in the stored demo and in Reset's initial state; both are now held by tests |
| 5A, in its notes | Amendment render coverage lives in `amend.test.tsx`, and the Clerk's decision is only exercised at the store | **Applied** as tests | `tests/render/handoffs.test.tsx` clicks demo path 7 from the permit to the amended permit, through both departments' checks and the Clerk's panel, and a decline |

Found by the integration, not asked for by a builder:

| File | Change | Why |
|---|---|---|
| `lib/state/amendment.ts` (new) | `amendmentStage()`, `pendingAmendment()`, `permittedPlan()`, `amendmentBalance()` and the rest | One reading of where an amendment stands for the engine's checks, both boards and the Payments page |
| `lib/state/transitions/amendment.ts` (new) | `amend`, the amendment's `submit`, `decide_amendment` and what follows them, moved out of `applicant.ts` | The Clerk's half did not belong among the applicant's transitions |
| The same | A decline restores the fee lines it kept, and an earlier "Submit application" card | The builder's decline re-estimated the fees (losing a reviewer's lines and the Clerk's edits on a Reviewed case) and dropped every card tagged `amendment`, the application's own Submit card among them once an amendment had borrowed it |
| The same | A change that takes effect at once settles its money and its work orders | Two more hours at a shelter left $50 owed with no card to pay it on; dropping a service left its work order in Public Works & Safety's queue |
| `lib/types.ts` | `Payment.amendment?: true` | The Clerk's Payments page and the case called an amendment's payment "Quote payment" on a case that never had a quote, and its refund "Deposit refund after closeout" |

## Pieces that did not meet

Each builder tested its own page. These are the places one builder's work is read by another's,
or by the engine, and did not line up. Each is fixed and covered by a test.

| # | Between | What was wrong | Fix |
|---|---|---|---|
| 1 | The amendment (5A) and the city | Nothing on the city side showed an amendment: no task, no panel, no word on the case; the two departments checking its cards were up with the Clerk nowhere | The Clerk's task, panel and queue row; a banner on the case with whose move it is (`amendmentReview()`); the Amendment chip on the Documents tab |
| 2 | The amendment and the permit (3D) | While pending, the permit page and the public check showed the amended plan: Maya's permit read Reviewed, covering "Amplified sound approval" | Both render `permittedPlan(c)`, the plan from before the amendment |
| 3 | The amendment and the applicant's board (3C, 4E) | On an Instant event, never routed, the "With the city" note read "at intake with the City Clerk" for a card Health & Legal was verifying, and the reviewers row "Not involved" for the departments checking it | The note names the verify task's department and date (`withCityInfo()`); the reviewers row has an amendment's stages ("Checking your amendment", "Deciding your amendment") |
| 4 | The amendment and checkout (3D) | A permitted case with money owed opened "Nothing to pay here" | `checkoutDecision()` returns the quote for an amendment; the page says what was paid and what is due, shows no Sign section when there is nothing to sign, and holds "Your change is in effect" until the board arrives |
| 5 | The amendment and Payments (5B) | An amendment's balance was on no tab, and its payment and refund were misnamed | "Amendment balance" on Due, with the case's own payment panel behind "Record payment"; "Amendment payment" and "Amended plan costs less" |
| 6 | Meetings (5B) and the calendar (2C) | A meeting was in a list under the grid, not on its day | Engine requests, above |
| 7 | The coach (5E) and the pages a path ends on | The strip was gone on the last screen of paths 1 and 4, and a dismissal came back with every role switch | `activeDemoPath`, above. `tests/demo-paths.test.ts` asks the coach for its step after every step of every path |
| 8 | The demo guide's "Continue" (5E) | It opened the path's first screen again, whatever step the path was on | "Continue" opens the current step's page as that step's role; "Start this path" still opens the scenario's opening screen |
| 9 | Demo path 7's steps (5E) and the amendment page (5A) | The coach's button for "Add a DJ" opened the board | The first two steps name `routes.amend(S1)` |
| 10 | Settings (6A) and the case detail (3F) | An open Draft in "What this changes" linked to "This application is still a draft" | Named, with its id, and not linked |
| 11 | Payments' filters (5B) | "Clear filters" on Received cleared one filter of three: three `router.replace()` calls from one render | One call; the filters are `FilterBar`'s own select and "Clear filters" |
| 12 | Inspections (5D) and Drafts | An applicant's Draft with food vendors in the next two weeks was on Health & Legal's list | Only cases the city can see |

Walked and found to line up (`tests/tool-pages.test.ts`, on the seed and after demo paths 5, 6
and 7): the Work orders page and Public Works & Safety's queue, with each row's "Mark done"
opening a panel the engine takes; a meeting's day on the calendar, on the Work orders tab and on
the applicant's card; Closures and routes' Permitted cases and `permitSessions()`; the
Verifications queue and the Documents tab; the inspections booths and the vendor cards; Payments'
Due, Received and Refunds and the engine's own figures. Also: every sidebar tool link reaches a
built page for its role; the palette reaches every page of each role; a threshold edited in
Settings is the one a new applicant's wizard classifies with.

## Consistency

- **Tabs that split a list** (Payments, Work orders, Verifications) are the plain tab list with a
  `CountBadge` per tab, as Intake's are; the line variant stays the case detail's. Verifications
  had "Queue (12)" in the label and Work orders had no counts.
- **Group headings** carry a `CountBadge`, as My queue's do ("Insurance" with its count, where
  Verifications had "Insurance (3)"; Payments' "Owed" and "Issued" were `<h3>`s under the `<h1>`).
- **Filters** are `FilterBar`: Payments' method select is the bar's own, its dates are the `Input`
  the Work orders page uses, and "Clear filters" is the bar's.
- **An event in a list** is `EventTitle` (the event over its applicant) with `CaseId` and
  `TierBadge`: Inspections had the name alone.
- **An empty list says why.** Work orders tells "nothing matches these filters" from "no work
  orders yet"; the meetings tab, which has no filters, no longer mentions them.
- **A row that was decided is still a row**: Verifications' "Recently decided" rows open their
  case, as the waiting ones do.
- **"No due date"**, as My queue and Work orders say it, where Payments said "Not provided".
- **One chip for an amendment's card**: the board's, on the city's Documents tab too.
- **Left as they are, on purpose**: Settings' in-page navigation is vertical tabs (six sections
  of one page, not a list); Closures and routes shows an empty state in the map's place and in
  the side list; vendors appear twice on the Documents tab (an open question for the owner).

## Changes

- 2026-10-13: Written after the merges and the first gate, before any integration change.
- 2026-10-13: Three things came out differently from the plan as first written. (1) The
  amendment's approval: the plan said "keep the settlement at approval unless the applicant
  paying it is a small change". Reading `tests/engines.test.ts` settled it the other way: the
  Phase 2 engine already carried "Accept conditions and sign" among an amendment's cards and
  called the balance "the amendment's quote", so approval became that quote and the charge at
  approval went. It took the engine checks, the checkout page and the Payments page with it.
  (2) Settings' back label was declined, and the link it was for removed. (3) Writing the test
  that holds an amendment's "With the city" note to the city's queue found two more seams on the
  applicant's board (rows 3 above), which no builder's page could have shown.

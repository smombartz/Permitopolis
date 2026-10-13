# Phase 4 integration: role tools and edge states in one tree

Part of `docs/plans/2026-10-12-permitopolis-prototype.md` (section 9, "Integrate"). Five builders
deepened the prototype in parallel worktrees: the Clerk's tools (4A, with 4B's money and closeout),
the reviewer tools (4C), document verification (4D), the applicant depth pass (4E) and the city's
edge states and action coverage (4F). This is what the integrator does once their branches are in
one tree.

## Steps

- [x] Merge `phase4/states`, `clerk`, `review`, `verify`, `applicant` into `build`, one at a time,
      no fast-forward. Install, run the gate, fix what the merge broke. (No conflicts; the gate
      passed on the merged tree before any change: 1,699 tests in 80 files.)
- [x] Decide the builders' engine requests against the PRD and the main plan; apply the right ones
      test-first and take out the builder's workaround. (Four applied, two declined; table below.)
- [x] Make the pieces meet: the registry opens the new panels; Reviews, Documents and Conditions
      and fees agree on one case (S3 and S6 walked through all three after each role acts); the
      applicant's "expected by" is the city's due date on the same task; demo paths 5 and 6 clicked
      from first step to last in `tests/render/handoffs.test.tsx`; the consistency pass. (Ten
      seams fixed; tables below.)
- [x] `docs/readme.md`: "Role tools and edge states (Phase 4)", "What is still a placeholder", the
      builders' new questions for the owner (16).
- [x] `docs/log.md`: one entry per workstream and one for the integration. The main plan: Phase 4
      ticked, section 12, a Changes line.
- [x] Gate (`pnpm check`: type-check, lint, 1,746 tests in 82 files, build), commit, remove the
      merged worktrees and branches.

## Engine requests

Decided against the PRD (`docs/spec/prd.md`) and the main plan's sections 3 and 5.

| From | Request | Decision | Why |
|---|---|---|---|
| 4A | `checkConfirmRouting()` should refuse a routing that leaves out a department one of the applicant's cards names as its reviewer | **Applied**, for every department and card, not only insurance | The PRD's core model has no case with nobody tasked, and `docs/readme.md` listed this as open ("or `confirm_routing` should refuse"). `checkConfirmRouting(c, reviewers, today)` now refuses: `Route Health & Legal too: it checks "Certificate of insurance".` It counts documents and forms a department checks; the Clerk's own cards and meetings never force a reviewer. `tests/engines.test.ts` holds that `routing()` suggests every department a card names on all 38 scripts, so the prefill is never refused. Seed: B22 routed only Public Works & Safety and now routes Health & Legal too. Workaround removed: the panel's insurance-only guard is gone; it asks the engine about the list as it stands and shows that reason. The panel also lists every department (the unsuggested ones unchecked), so a reviewer can be added as the PRD says |
| 4C | `checkScheduleMeeting()` should check the date against the event date and the citywide blackouts | **Applied** | A walkthrough after the race is wrong whoever dispatches it. `checkScheduleMeeting(c, taskId, actor, { date, today })` refuses a date before today, on or after the next session, or on a blackout day (`citywideBlackoutOn()` in `lib/rules`, which Active permits' map now reads too). Without a date it answers only who may schedule, so `availableActions()` and a panel with an empty field are unchanged. Workaround removed: `meetingDateValid()` and `isBlackoutDate()` are gone from `lib/view/reviewTools.ts`; the panel shows the engine's reason on the date field |
| 4D | `ActionSheet` is fixed at `sm:max-w-md`; the verify panel wants preview and checklist side by side | **Applied**, as a width per action | The PRD's verification is "a mock preview and a checklist", and the Clerk's consolidation is "side by side"; in 28rem the quote's line editor left its label column about 26px. `panelWidthFor()` in `actions/registry.ts` names the wide panels (`send_quote`, `review_decide`, `verify_document`, `reject_document`, `log_closeout`, `reconcile_close`) and `ActionSheet` opens them at 48rem. Workaround removed: the verify panel is two columns from 1024px; the consolidation's department cards are one column each |
| 4D | `cardFromSpec()` should set `payload.vendorName` on a per-vendor health permit card | **Applied** | `TaskPayload` already listed the key and nothing wrote it. `requirements()` sets it; a board rebuilt after a vendor is renamed takes the new name and keeps the upload. Workaround removed: the title regex in `lib/view/verify.ts` |
| 4F | `CaseHeader` should truncate the event name and the applicant's name with a tooltip | **Declined**; a smaller change applied | The case's own page is the one place the whole name has to be readable, and a tooltip is not reachable on a phone, where the applicant's board uses the same header. The name wraps. Applied instead: `min-w-0 break-words` on the name and the applicant, so one long unbroken word cannot push the header wider than its box |
| 4F | `WhoIsUp` should say inline who can act on another party's task | **Declined** | Every task in Who's up already sits in a row headed by the party that holds it, with its status ("Health & Legal · Up now"). A caption per task would say the same thing a second time |

Found by the integration, not asked for by a builder:

| File | Change | Why |
|---|---|---|
| `lib/state/actions.ts`, `transitions/clerk.ts` | `send_quote` takes `merged?: boolean` | Without it an empty list means "as the case stands", so a Clerk who removed every condition in the quote builder sent a quote with all of them back on. The builder sends `merged: true` and its lists are taken as given. Scripts and tests that send `[]` are unchanged |

## Pieces that did not meet

Each builder tested its own panels and tabs. These are the places one builder's work is read by
another's, or by the engine, and did not line up. Each is fixed and covered by a test.

| # | Between | What was wrong | Fix |
|---|---|---|---|
| 1 | The quote builder (4A) and `send_quote` | The engine read an empty list as "as the case stands", so removing every condition in the builder sent a quote with all of them | `send_quote` takes `merged: true`; the builder's lists are taken as given. A quote with no fee line cannot be sent |
| 2 | The wide panels (4A, 4C, 4D) and `ActionSheet` (3F) | The sheet was 28rem for every panel. The consolidation drew three department columns in it, the quote's line editor left its label about 26px, and the estimate-against-actual table had six columns | A width per action (engine requests, above) |
| 3 | The applicant's "With the city" note (4E) and the city's Who's up | Before routing the board said "6 days with Health & Legal, no expected date yet" while the city showed Health & Legal as not started and the Clerk's intake check as due, or overdue | `withCityInfo()` names who holds the card now: the Clerk's intake before routing (with the intake check's date), the department after. `tests/both-sides.test.ts` holds every "With the city" card on the seed to the city's own task: holder, expected-by date, overdue, days waiting |
| 4 | The Documents tab's vendor group (4D) and demo path 3 | S3's one vendor permit sat inside a collapsed "Vendor health permits" group while it waited on the applicant, hiding the request Health & Legal had pinned to it | A lone vendor's permit is its own row; a group opens by itself while one of its permits is in flight, for every viewer |
| 5 | The review panel (4C) and the review's status | Conditions could be added under plain "Approve" and went out with a review recorded as approved, without conditions | The condition builder belongs to "Approve with conditions", which needs at least one; a plain approval sends none |
| 6 | The action-coverage test (4F) and the panels | It rendered each panel inside the sheet's portal, which renders nothing on the server: the test could not fail | It renders the panel itself, checks for its title, and also opens every open task in Who's up for each city role |
| 7 | The routing panel (4A) and the PRD | It listed only the suggested departments, so a reviewer could be removed and never added | Every department has a row; the unsuggested ones start unchecked |
| 8 | The case detail (4F) and the lists' Stalled chip (4F) | The case drew its own copy of the chip, because a case component may not import from the lists | `StalledBadge` and `CommissionBadge` are in `components/domain` |
| 9 | My queue's "why now" line (4F) and a first upload | A card uploaded for the first time after its review read "re-uploaded" | "uploaded" the first time, "re-uploaded" after that |
| 10 | The accessibility checklist (4D) and the applicant's form (3C) | The checklist failed a plan with no named viewing area; the form labels that field optional and no seeded plan fills it in, so S5's and S6's approved plans read as failing | The item passes on a named area or on the route "to every viewing area" being marked; a test holds every seeded plan to passing |

Walked and found to line up: the registry opens the shared panels for every role (no override
hides one); S3 and S6 through Reviews, Documents and Conditions and fees after each role acts
(`tests/render/role-tools.test.tsx`); the review panel's "Request information" opening the
request panel in the same sheet; the closeout log's running total, the Clerk's reconciliation and
the applicant's final bill, all from `closeoutSettlement()`; the quote builder's "Due now" and
`dueAtQuote()`; Issue permit's checklist and `checkIssuePermit()`; demo paths 5 and 6 from first
step to last across the board, the queues, the case, checkout, Active permits and the wizard
(`tests/render/handoffs.test.tsx`).

## Consistency

- **One fee-line row** (`components/case/FeeLineFields.tsx`) for the review panel and the quote
  builder: label, quantity, unit, unit price, the amount, remove. Fields are named for their line
  ("Unit price: Police").
- **One department picker** (`components/case/clerk/DeptSelect.tsx`), a native select, in place of
  three copies of the same class string.
- **One cleanup result** (`components/case/CleanupResult.tsx`): "Cleanup inspection", "Pass" or
  "Issues found", the notes. The closeout log, once logged, and the Clerk's panel show the same
  block; the log said "Cleanup check" and the Clerk's badge "Issues".
- **The logged closeout is `FeeTable showActual`**, the table the Clerk reconciles from and the
  Conditions and fees tab shows, in place of a list of its own that printed "+510.00".
- **Money is `Money` or `fmtMoney`**: a difference of $510 reads "$510" (it read "+510.00"), the
  cleanup crew's rate "$60 an hour" (it read "$60/hour" built from the raw number).
- **Dates are `fmtDate` and `fmtDateShort`**: a session payment reads "Session payment: Tue, Jun
  8" (it printed the ISO date).
- **Counts are `plural()`**: "1 fee line", "2 conditions".
- **A checklist reads the same** in Verify and in Issue permit: the item and its badge on one
  line ("Passes" or "Fails"; "Done" or "Waiting"), what is behind it below.
- **A meeting is held, a work order is done**: the Reviews tab's "Mark held" opens a panel whose
  button and toast say "held" too.
- **A condition's controls are named for it** in the quote builder as in the review panel
  (`Move "Sound ends at 9 pm" up`), so several rows do not carry several buttons of one name.
- **One reading of "submitted on"** (`taskSubmittedOn()` in `lib/state`) behind the applicant's
  "N days with ..." and the city's "waiting N days".
- **Left as they are, on purpose**: the review panel adds conditions with template buttons and
  the quote builder with a template select (the reviewer picks from its own short list; the Clerk
  picks a department first); a queue row's "why now" date has no weekday ("Routed Apr 20"),
  being one line under the task; the Documents tab's "Needs my check" filter is local state, not
  in the URL (an open question for the owner).

## Changes

- 2026-10-13: Written after the merges and the first gate, before any integration change.
- 2026-10-13: Two things were added to the plan as the work found them. The wide sheet grew from
  five panels to six: the closeout log joined once its read-only view became the full estimate
  against actual table. And an eighth and ninth seam came out of writing the docs: listing the
  seeded documents that fail their checklist showed every approved accessibility plan failing
  "viewing area", a field the applicant's form calls optional (the check now passes on the route
  the form asks for), and the queue's reason line saying "re-uploaded" for a first upload.

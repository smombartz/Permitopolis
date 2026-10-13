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
- [ ] Make the pieces meet: the registry opens the new panels; Reviews, Documents and Conditions
      and fees agree on one case (S3 and S6 walked through all three after each role acts); the
      applicant's "expected by" is the city's due date on the same task; demo paths 5 and 6 clicked
      from first step to last in `tests/render/handoffs.test.tsx`; the consistency pass.
- [ ] `docs/readme.md`: "Role tools and edge states (Phase 4)", "What is still a placeholder", the
      builders' new questions for the owner.
- [ ] `docs/log.md`: one entry per workstream and one for the integration. The main plan: Phase 4
      ticked, section 12, a Changes line.
- [ ] Gate (`pnpm check`), commit, remove the merged worktrees and branches.

## Engine requests

Decided against the PRD (`docs/spec/prd.md`) and the main plan's sections 3 and 5.

| From | Request | Decision | Why |
|---|---|---|---|
| 4A | `checkConfirmRouting()` should refuse a routing that leaves out a department one of the applicant's cards names as its reviewer | **Applied**, for every department and card, not only insurance | The PRD's core model has no case with nobody tasked, and `docs/readme.md` listed this as open ("or `confirm_routing` should refuse"). `checkConfirmRouting(c, reviewers, today)` now refuses: `Route Health & Legal too: it checks "Certificate of insurance".` It counts documents and forms a department checks; the Clerk's own cards and meetings never force a reviewer. `tests/engines.test.ts` holds that `routing()` suggests every department a card names on all 38 scripts, so the prefill is never refused. Seed: B22 routed only Public Works & Safety and now routes Health & Legal too. Workaround removed: the panel's insurance-only guard is gone; it asks the engine about the list as it stands and shows that reason. The panel also lists every department (the unsuggested ones unchecked), so a reviewer can be added as the PRD says |
| 4C | `checkScheduleMeeting()` should check the date against the event date and the citywide blackouts | **Applied** | A walkthrough after the race is wrong whoever dispatches it. `checkScheduleMeeting(c, taskId, actor, { date, today })` refuses a date before today, on or after the next session, or on a blackout day (`citywideBlackoutOn()` in `lib/rules`, which Active permits' map now reads too). Without a date it answers only who may schedule, so `availableActions()` and a panel with an empty field are unchanged. Workaround removed: `meetingDateValid()` and `isBlackoutDate()` are gone from `lib/view/reviewTools.ts`; the panel shows the engine's reason on the date field |
| 4D | `ActionSheet` is fixed at `sm:max-w-md`; the verify panel wants preview and checklist side by side | **Applied**, as a width per action | The PRD's verification is "a mock preview and a checklist", and the Clerk's consolidation is "side by side"; in 28rem the quote's line editor left its label column about 26px. `panelWidthFor()` in `actions/registry.ts` names the wide panels (`send_quote`, `review_decide`, `verify_document`, `reject_document`, `reconcile_close`) and `ActionSheet` opens them at 48rem. Workaround removed: the verify panel is two columns from 1024px; the consolidation's department cards are one column each |
| 4D | `cardFromSpec()` should set `payload.vendorName` on a per-vendor health permit card | **Applied** | `TaskPayload` already listed the key and nothing wrote it. `requirements()` sets it; a board rebuilt after a vendor is renamed takes the new name and keeps the upload. Workaround removed: the title regex in `lib/view/verify.ts` |
| 4F | `CaseHeader` should truncate the event name and the applicant's name with a tooltip | **Declined**; a smaller change applied | The case's own page is the one place the whole name has to be readable, and a tooltip is not reachable on a phone, where the applicant's board uses the same header. The name wraps. Applied instead: `min-w-0 break-words` on the name and the applicant, so one long unbroken word cannot push the header wider than its box |
| 4F | `WhoIsUp` should say inline who can act on another party's task | **Declined** | Every task in Who's up already sits in a row headed by the party that holds it, with its status ("Health & Legal · Up now"). A caption per task would say the same thing a second time |

Found by the integration, not asked for by a builder:

| File | Change | Why |
|---|---|---|
| `lib/state/actions.ts`, `transitions/clerk.ts` | `send_quote` takes `merged?: boolean` | Without it an empty list means "as the case stands", so a Clerk who removed every condition in the quote builder sent a quote with all of them back on. The builder sends `merged: true` and its lists are taken as given. Scripts and tests that send `[]` are unchanged |

## Pieces that did not meet

Filled in as each is found.

## Consistency

Filled in as each is found.

## Changes

- 2026-10-13: Written after the merges and the first gate, before any integration change.

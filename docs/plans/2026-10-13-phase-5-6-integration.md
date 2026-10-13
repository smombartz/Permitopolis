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
- [ ] Decide the builders' engine requests against the PRD and the main plan; apply the right
      ones test-first and take out the builder's workaround (table below).
- [ ] Make the pieces meet, each with a test: no placeholder route left; every new list opens
      the case and the case returns to it; the coach agrees with `tests/demo-paths.test.ts` after
      every step; the amendment on the city side; meetings, work orders and closures agree with
      the case; settings flow into the wizard; action coverage, the states matrix and the
      hand-offs pass, with demo path 7 clicked through; a consistency pass over the new pages.
- [ ] `docs/readme.md`: "P1 and P2 (Phases 5 and 6)", "What is still a placeholder", the builders'
      new questions for the owner.
- [ ] `docs/log.md`: one entry per workstream and one for the integration. The main plan: Phases
      5 and 6 ticked, section 12, a Changes line.
- [ ] Gate (`pnpm check`), commit, remove the merged worktrees and branches.

## Engine requests

To be decided against the PRD (`docs/spec/prd.md`) and the main plan's sections 3 and 5.

| From | Request | Plan |
|---|---|---|
| 5A | `amend` leaves `KNOWN_GAPS` | Done with the merge |
| 5A | The permit page links to the amendment | Apply: a link gated by `canAmend()` |
| 5A | No city-side action or panel for the Clerk's decision on an amendment; `amend` is overloaded for it and told apart by comparing answers | Apply as a dedicated action, `decide_amendment`, with a Clerk task in the queue and a panel on the case; `amend` goes back to the applicant alone |
| 5A | `checkPay` takes no quote payment on a Permitted case, so approval settles the fee difference itself | Decide after reading checkout: keep the settlement at approval unless the applicant paying it is a small change |
| 5B, 5C, 5D, 6A | `BACK_LABEL` lines for payments, closures, work orders, verifications, inspections, settings | Apply |
| 5B | The Clerk's license review reads as a generic review | Apply: its own task title and queue reason |
| 5B | `CalendarItem` has no kind, so a meeting cannot be drawn in a day's cell | Decide after reading the three calendar views |
| 5D | `issue_food_permits`: a Health & Legal task created by `issue_permit`, finished once every vendor's health permit is verified; the applicant's card then reads as issued | Apply; complete it in the seed scripts where the story says the permits were issued |
| 5E | `activeDemoPath` on the store | Apply; the coach reads it first and derives from the page only when no path was picked |
| 6A | `setConfig()` re-classifies open Drafts; the config is persisted and restored by Reset | Apply |

## Changes

- 2026-10-13: Written after the merges and the first gate, before any integration change.

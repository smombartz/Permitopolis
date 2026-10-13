# Phase 3 integration: make the seven surfaces meet

Part of `docs/plans/2026-10-12-permitopolis-prototype.md` (section 9, "Integrate"). Seven builders
built one surface each without seeing the others. This is what the integrator does once their
branches are in one tree.

## Steps

- [x] Merge `phase3/landing`, `wizard`, `board`, `checkout`, `lists`, `case`, `active` into `build`,
      one at a time, no fast-forward. (No conflicts; the gate passed on the merged tree before any
      change: 1,155 tests in 68 files.)
- [ ] Walk every hand-off, fix what does not line up, and cover each with a test in
      `tests/render/handoffs.test.tsx` that renders the real layouts and pages by URL.
- [ ] Consistency pass: the same thing reads the same on every surface.
- [ ] Decide the builders' contract change requests.
- [ ] `docs/readme.md`: "The screens (Phase 3)". `docs/log.md`: one entry per workstream and one for
      the integration. The main plan: Phase 3 ticked, "12. What to look at", a Changes line.
- [ ] Gate (`pnpm check`), commit, remove the merged worktrees and branches.

## Hand-offs found broken or missing

| # | From, to | What was wrong | Fix |
|---|---|---|---|
| 1 | My queue, Intake and Who's up, to the case detail | They pass a task id in `?task=`; the case detail read `?task=` only as its own action key, so the sheet opened empty | `resolveOpenKey()` in `lib/view/caseDetail.ts` takes either; the sheet opens only when a panel is found. The Clerk's Instant exception opens Reconcile and close |
| 2 | Intake, to the case detail | "Request info" opened the intake task (Accept as complete); the row had no link to the case | The link carries the `request_info` key; the event name links to the case |
| 3 | A case, back to its list | "Back to cases" whatever list the case was opened from | `routes.city.case(id, { from })`; the four lists pass their own URL and the case names the list it returns to |
| 4 | Wizard step 5 (Instant), to checkout | Booking's back link went to a board the Draft does not have | Back goes to the wizard's plan step |
| 5 | My events and the board, for a Draft whose board exists | My events sent it back into the wizard; the board offered "Amend" on a Draft and no way to the permit | A Draft with cards opens its board; the menu offers "Edit your plan" for a Draft; "View permit" once there is one |
| 6 | The board's payment card for a series, to checkout | In Quote sent it opened the session schedule, whose pay links the checkout refuses | The quote's own payment goes to the quote; the schedule offers "Pay this session" only where checkout takes it |
| 7 | Checkout, after a session or the final bill is paid | The page fell through to "Nothing to pay here" | A toast and back to the board |
| 8 | The permit, to `/verify/[id]` | The QR code held a path, not a URL, and nothing on the page linked to the check | The QR code holds the full URL; "Open the verification page" links to it |
| 9 | Landing "Plan an event" | Landed on My events for a persona who already has events | Always the wizard: the persona's one draft, or a blank one |
| 10 | A link to closed or ended cases | `state=closed` gave an empty pipeline unless the "Closed and ended" toggle was also on | Choosing that state shows those cases |
| 11 | A page opened under the wrong role (a typed or shared link), to the role it is built for | The Applicant on `/city/cases/[id]` got the "built for a city role" panel, and its "Switch to ..." button dropped the link for the role's queue or last page; a city role on an event page lost the page the same way | `resolveRoleSwitch()` stays on a page the new role owns (`pageIsFor()` in `lib/view/shell.ts`), and sets the event's own persona when the page is the Applicant's |

## Consistency

- One `applicantName()` (`lib/data/people.ts`) in place of five fallbacks.
- One narrow-viewport hook (`useIsNarrow`, from `@/components/shell`); the landing page's copy goes.
- One back link (`BackLink` in `components/ui/page-header.tsx`): the board, the quote and the case
  detail get the same one `PageHeader` renders.
- Block labels in the wizard, the board's status strip and the city lists take the system's label
  treatment (11 px, .12em), as the case detail, the permit and `KeyValueList` already do.
- Endings read from `ENDING_LABEL`; department icons from `DEPT_ICON`; tiers from `TierBadge` and
  `TIER_LABEL`; table dates from `DateText short`; a pipeline card names its case with `EventTitle`.
- The same action reads the same: "Request information", "Back to My events", the accept toast.
- Page rhythm: every screen's root is `gap-6`. The verify page gets its `<h1>`.

## Contract change requests

- **Applied**: `lib/state`'s barrel re-exports the money and check helpers the readme points to
  (3D's request), and the callers import from it.
- **Applied (integrator's own)**: `routes.city.case()` takes `from`, and documents what `task` holds.
- **Declined**: typing `sort`, `dir` and `closed` into `CasesFilters` (3E's request). No other
  surface links to a sorted pipeline; a link that wants closed or ended cases uses `state`, which
  now works on its own; a case's back link carries the list's whole URL.

## Changes

- 2026-10-12: Written before the fixes; boxes ticked as each step landed.

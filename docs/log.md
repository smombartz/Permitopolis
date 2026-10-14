# Change log

## 2026-10-13 - Merged into master and deployed to Vercel

**What Changed:**
- Fast-forwarded `master` to `build` (commit `fe690aa6`); the two branches are the same commit
- Created the Vercel project `permitopolis` in the team Studio M and deployed `master` to production: https://permitopolis.vercel.app
- Added a "Deployment" section to `docs/readme.md` (URL, project, how to redeploy, what was checked) and the live URL to `README.md`; updated the plan's deploy decision and Changes

**Why:**
- The owner asked for the build branch to be merged and the prototype deployed, so reviewers have a live link

**Files Modified:**
- `docs/readme.md`
- `README.md`
- `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-13 - Submission notes and the final gate

**What Changed:**
- Added "Presenting it" at the top of `docs/readme.md`: who the prototype is for, the workflow it goes deep on, seven decisions, what was deliberately not built, what it is made of and what no person has checked yet
- Rewrote `README.md` for the finished prototype (how to run it, where to start, where the docs are)
- Ticked workstream 6C in the plan and recorded the final gate: type-check, lint, 3,197 tests in 109 files and the production build pass on `build`

**Why:**
- Workstream 6C of the plan, and the close of the build through Phase 6

**Files Modified:**
- `docs/readme.md`
- `README.md`
- `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-13 - Final review fixes

**What Changed:**
- The final read-only review of `build` returned 17 findings (3 high, 6 medium, 8 low). All 17 were confirmed in the code and fixed, each with a test that failed before its fix. Plan, with what each fix turned out to be: `docs/plans/2026-10-13-final-review-fixes.md`. Product choices the fixes made are in `docs/readme.md` under "Open questions for the owner", "From the final review fixes"
- **High 1, amendment cards read "Overdue by 11 days" the moment they appeared (demo path 7).** A card to finish before submitting is due the tier's notice before the event; on a board made inside that notice (a late fee taken at the date gate, an amendment close to the day) that day is already gone. `cardDueDate()` now gives such a card today's date, never an earlier one. The seed is unchanged: no seeded board was made inside its lead time
- **High 2, the permit page and Cancel refunded the amended plan while the amendment was pending.** Maya's permit read "Your $250 deposit is returned in full ... $125 refund" for a deposit she never paid, and `cancel` paid the $125. `permittedPlan()` now carries the fee lines the plan had, and `refundIfCancelled()` works from it, so the permit page, the Cancel dialog and `cancel` are one figure again ($62.50). Anything already paid toward an amendment that has not taken effect goes back whole (`paidTowardPendingAmendment()`)
- **High 3, a pending amendment never lapsed.** Moving the demo date past the event ran the clock on the amended, unapproved tier: Maya's Instant picnic went to Closeout, into Public Works & Safety's queue, with $393.75 "due" and a $250 "deposit" to refund. `applyTick()` now lapses an amendment the event has caught up with (`lapseAmendment()`), before it reads the tier: the record goes back as a decline puts it back, the Clerk's open decision is closed, the payment card an approval reopened is the booking's again, anything paid toward the amendment is refunded, a signature given on the amendment's own card goes with the card, and the work orders follow the plan that stands. The day that counts is the last session of the plan the permit covers, or the amended plan's own date if that comes first
- **Medium 1, the amendment wizard's fee difference was a fresh estimate less what was paid.** An unchanged series read "$240 more will be due", a case before its permit read its whole quote as the change, and a late fee already charged read as a refund. `buildAmendmentDiff()` now prices the record `amend` itself builds (`amendedPlan()`, split out of `amend`): `amendmentBalance()` on a permitted event, the change in the total before the permit. The panel shows a series' later sessions on a line of their own, and says "Added to your fees" or "Taken off your fees" where nothing has been paid for. Found on the way: the wizard empties the session list when the hours or the date are edited, and `amend` took which sessions were paid from that list, so a longer class refunded the session already paid; the billing is now read off the record
- **Medium 2, an amendment at Quote sent left the board's payment card on the old figure.** `amend` (pending or not) and a decline now bring a quote that is out in step (`requote()`): the card asks for `quoteBalance()`, what checkout takes
- **Medium 3, finished work orders were drawn "Overdue by 94 days" beside their Done chip.** A done row reads "Was due Thu, Apr 22"; the countdown is for open rows
- **Medium 4, Walkthroughs and meetings offered Schedule on every row.** The link is drawn only when `checkScheduleMeeting()` allows it; otherwise the reason is text, and a held meeting shows neither
- **Medium 5, an issued permit re-read the live tier rules.** "This permit covers", the Overview's "What the permit covers" and Issue permit's list are `permitCovers(c)`: the record's stored triggers, and the plan the permit is for while an amendment is pending
- **Medium 6, the reopened payment card read "Pay and book · Payment holds your date ..." on a booked, permitted event.** It is "Pay fees and deposit · What your change adds, beyond what you have paid", gets its own reason back when paid, and the board, Who's up and the "Next:" sentence put signing before paying when both are due the same day
- **Medium 7, the Reviews tab said "waiting for routing" of a department that was checking an amendment's card.** `unroutedDeptNote()`: "Checks the amendment's card: Sound details (being checked)."
- **Low 1** a booked series keeps its session price when the fee schedule changes (`sessionPrice()`, used by Payments, the board, checkout, the Pay panel, `dueAtQuote()` and `amendmentBalance()`). **Low 2** Inspections list permitted events only. **Low 3** the closures day strip counts closures and bookings apart ("1 closure, 2 bookings"). **Low 4** demo path 7 is two steps, and the second stays current on the board until the amendment is submitted. **Low 5** the Schedule panel's "Attends" is the calendar's list (`meetingAttendees()`). **Low 6** amendment wording: "1 card no longer applies", the permit sentence only where there is a permit (the review step and the board's banner), "$518.75 with the $53.75 late fee" on the panel and in the activity log, the amendment's card titled "Submit amendment", "No conditions on this plan." under a signed quote's empty Conditions heading. **Low 7** a file's type is a word ("PDF"), Templates shows and copies "[vendor name]", the Blackout section no longer points at a rate, "This case lost its date hold; it cannot be amended."

**Why:**
- The final review before the prototype is handed over. The three high findings are all on demo path 7, the one the PRD's P1 scope is shown with; the rest are places where two screens, or a screen and the engine, said different things about the same case

**Files Modified:**
- `lib/rules/requirements.ts` - `submit_by` is never in the past
- `lib/rules/classify.ts` - `tierSummary()`, the one-line result with a late fee in it
- `lib/rules/fees.ts`, `lib/rules/types.ts` - `FeeEstimate.perSessionLabels`
- `lib/state/amendment.ts` - `permittedPlan()` carries the prior fee lines; `permitCovers()`; `paidTowardPendingAmendment()`; `AMENDMENT_SUBMIT_CARD`; `PendingAmendment.priorPay`
- `lib/state/core.ts` - `sessionPrice()`; `dueAtQuote()` uses it; `byDueDate()` sorts signing before paying among cards due the same day
- `lib/state/selectors.ts` - `refundIfCancelled()` reads the plan the permit covers
- `lib/state/transitions/amendment.ts` - `amendedPlan()`; `restorePlan()` shared by decline and lapse; `lapseAmendment()`; `requote()`; the reopened payment card's wording; "Submit amendment"
- `lib/state/transitions/payment.ts` - the payment card's own reason back when an amendment's balance is paid
- `lib/state/clock.ts` - `applyTick()` lapses an overtaken amendment first
- `lib/state/waitingOn.ts`, `lib/state/index.ts`, `lib/state/types.ts` - `ENDING_PHRASE` and the new selectors exported
- `lib/format.ts` - `fmtFileType()`
- `lib/data/demoScript.ts`, `lib/view/coach.ts` - path 7 in two steps
- `lib/view/amend.ts`, `lib/view/board.ts`, `lib/view/caseDetail.ts`, `lib/view/checkout.ts`, `lib/view/payments.ts`, `lib/view/closures.ts`, `lib/view/inspections.ts`, `lib/view/active.ts` - the view-models behind the fixes above
- `components/permit/PermitCard.tsx`, `components/case/CaseDetailScreen.tsx`, `components/case/tabs/OverviewTab.tsx`, `components/case/tabs/ReviewsTab.tsx`, `components/case/tabs/DocumentsTab.tsx`, `components/case/verify/DocumentPreview.tsx`, `components/case/actions/generic/IssuePermit.tsx`, `components/case/actions/generic/Pay.tsx`, `components/case/actions/generic/ScheduleMeeting.tsx`, `components/checkout/QuotePanel.tsx`, `components/wizard/amend/AmendResultPanel.tsx`, `components/wizard/amend/AmendReviewStep.tsx`, `components/city/workorders/WorkOrdersList.tsx`, `components/city/workorders/MeetingsTab.tsx`, `components/city/closures/ClosuresCalendarStrip.tsx`, `components/city/inspections/InspectionsScreen.tsx`, `components/city/settings/BlackoutSection.tsx`, `components/city/settings/InventorySection.tsx`, `components/city/settings/TemplatesSection.tsx` - the screens
- `lib/rules/requirements.test.ts`, `lib/format.test.ts`, `lib/state/clock.test.ts`, `lib/state/selectors.test.ts`, `lib/state/transitions/amendment.test.ts`, `lib/view/active.test.ts`, `lib/view/amend.test.ts`, `lib/view/board.test.ts`, `lib/view/caseDetail.test.ts`, `lib/view/closures.test.ts`, `lib/view/coach.test.ts`, `lib/view/inspections.test.ts`, `lib/view/payments.test.ts`, `tests/demo-paths.test.ts`, `tests/engines.test.ts`, `tests/tool-pages.test.ts`, `tests/render/amend.test.tsx`, `tests/render/case-detail.test.tsx`, `tests/render/checkout.test.tsx`, `tests/render/closures.test.tsx`, `tests/render/handoffs.test.tsx`, `tests/render/inspections.test.tsx`, `tests/render/permit.test.tsx`, `tests/render/settings.test.tsx`, `tests/render/work-orders.test.tsx` - a test per finding, each failing before its fix
- `docs/plans/2026-10-13-final-review-fixes.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`, `docs/readme.md` - the plan, its line in the parent plan, "Amendment, end to end", "What the final review changed" and the open questions

---

## 2026-10-13 - Accessibility and responsive pass

**What Changed:**
- Workstream 5F: one pass over the whole prototype against WCAG 2.2 AA, from the markup, the classes, the built stylesheet and jsdom. No browser, screen reader or phone was used (CLAUDE.md). Plan, with everything found: `docs/plans/2026-10-13-accessibility-responsive-pass.md`
- **The focus ring was never drawn.** The app writes it as `outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`; in Tailwind 4 `outline-none` sets `--tw-outline-style: none` and `focus-visible:outline-2` draws `outline-style: var(--tw-outline-style)`, so no button, link, tab or row showed keyboard focus. One unlayered rule in `app/globals.css` puts the style back, a base rule gives anything else focusable the same ring, the night surface has a mint one, and a forced-colors mode a system one. `--focus-ring` is opaque indigo-500 (the design doc's 70% is 2.95:1 on the page ground; it needs 3:1). Menu and select items and the palette's selected option show which one has focus (the highlight was 1.02:1, and a select's had none: `data-focus:` matches nothing Radix sets). Checkbox, radio, switch and tab panels take the ring
- **Focus was dropped when a sheet or dialog closed.** A card's sheet and a case's action panel open from the URL, the palette and every confirmation from state: Radix had no trigger to hand focus back to. `Dialog` and `Sheet` return it to whatever opened them (`components/ui/return-focus.tsx`); the Demo menu's date picker to the Demo menu's button
- **Skip link** in both shells and on the landing page (`components/ui/skip-link.tsx`); `<main>` is present before hydration. **Page titles**: every route shared one, which is also what Next's route announcer read out on each navigation; each `page.tsx` exports its own, and a page about one record adds its name (`useDocumentTitle`)
- **Shortcuts**: one rule for `/`, `?`, `j` and `k` (`lib/keyboard.ts`). `?` fired with Ctrl held and inside a menu, `/` pulled focus out from under an open sheet, and the arrow keys were taken from the whole page
- **Live regions**: `Banner`, `InlineAlert` and `EndingBanner` were `role="alert"` or `"status"` by variant on about 75 uses, nearly all static; they are plain content, with `live` for one that answers an action. `Field`'s error is a standing polite region (it was an alert on every keystroke). The wizard and the amendment have one announcer for tier and date gate (`WizardAnnouncer`); the case's status line no longer repeats what a toast said; filter counts, the demo date, the coach's step and "Copied" are polite
- **Names**: a `Select` inside a `Field` was unnamed everywhere (the label pointed at the Select root, which renders nothing); tables are named; per-row actions say which row on Intake, Payments, Work orders, Inspections and a case's Reviews and Documents tabs; calendar days are named by their date and are buttons only where a day can be chosen; the date picker reads its date; the rating stars say "3 stars"; `required` reaches a screen reader
- **Contrast**: `text-current/85` on a success or warning tint was 3.9:1 (banners, a badge's reason); calendar days outside the month were at 40% opacity with their events; the night section's label was 4.46:1
- **Responsive**: 36px buttons, menu items, tabs, date picker days and standalone links take a 44px tap on a touch screen (`pointer-coarse:`); availability reasons, street names and what-if sentences wrap; the landing headlines step down below 640px; the palette keeps a gutter on a phone; calendar day and item buttons are 24px (WCAG 2.5.8)
- **Color never alone**: a check on an active filter chip and on a chosen space or street
- **Checkout**: card fields are required and say so; a failed submit focuses the first wrong field; focus moves on to Pay after signing
- **Tests**: `tests/render/a11y.test.tsx` (every route for every role, 505 pages), `a11y-overlays.test.tsx` (221 action panels, 58 card sheets, the shell's menus and dialogs), `keyboard.test.tsx`, `live-regions.test.tsx`, the checks in `tests/render/a11yAudit.ts`; `lib/contrast.test.ts` extended to tints, the ring, the night section and standalone marks; guards for the ring rules, thinned text and outline resets. About 40 existing assertions follow renamed controls. The render tests' timeout is 20s (a demo path clicked end to end ran past five beside the new audits on a busy machine)
- **Docs**: `docs/readme.md` has "Accessibility" (what a test holds, what a builder keeps doing, what only a person can check, what is not met) and seven questions for the owner; the main plan has 5F ticked. Gate: type-check, lint, 3,148 tests in 109 files and build pass

**Why:**
- The PRD's bar is WCAG 2.2 AA, keyboard reachable with visible focus, status changes announced, color never alone, city screens from 1280px and applicant screens down to 375px. Six workstreams had each built to it by eye and by render test; nothing had checked the whole, and the one thing every keyboard user needs, a visible focus ring, was written everywhere and drawn nowhere

**Files Modified:**
- `app/globals.css`, `styles/tokens.css`, `app/layout.tsx` and every `app/**/page.tsx` (titles), `vitest.config.mts`
- `components/ui/`: `button`, `dialog`, `sheet`, `return-focus` (new), `skip-link` (new), `radio-keys` (new), `select`, `dropdown-menu`, `command`, `tabs`, `checkbox`, `radio-group`, `switch`, `field`, `banner`, `inline-alert`, `filter-bar`, `segmented-control`, `wizard-stepper`, `empty-state`, `copy-button`, `file-drop`, `page-header`
- `components/shell/`: `AppShell`, `CityShell`, `TopBar`, `CoachStrip`, `CommandCenter`, `CommandPalette`, `DemoMenu`, `DemoDatePicker`, `PersonaPicker`, `StorageBanner`, `SwitchRolePanel`, `CaseNotFound`, `useDocumentTitle` (new)
- `components/domain/`: `FeeTable`, `AvailabilityBadge`, `EndingBanner`, `LeadTimeRisk`, `StateStepper`, `ConditionList`, `CommissionBadge`
- `components/landing/**`, `components/wizard/**` (`WizardAnnouncer` new), `components/map/LocationPicker.tsx`, `components/board/**`, `components/checkout/**`, `components/permit/**`, `components/calendar/**`, `components/active/**`, `components/city/**`, `components/case/**`
- `lib/keyboard.ts` (new), `lib/view/wizard.ts`, `lib/contrast.test.ts`, `lib/view/wizard.test.ts`
- `tests/render/a11y.test.tsx`, `a11y-overlays.test.tsx`, `keyboard.test.tsx`, `live-regions.test.tsx`, `a11yAudit.ts` (all new), `tests/guards.test.ts`, and the render tests that named a renamed control
- `docs/readme.md`, `docs/rime-and-ink-design-system.md`, `docs/plans/2026-10-13-accessibility-responsive-pass.md` (new), `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-13 - Phases 5 and 6 integration: P1 and P2 in one tree

**What Changed:**
- Merged `phase5/amend`, `coach`, `clerk`, `pws`, `hl` and `settings` into `build`, one at a time, with no conflicts. The run that built them was cut off by a usage limit and resumed; three builders had finished and three were finished in their worktrees on the resume. The gate failed on the merged tree in one expected place (`amend` had a control and was still listed as a gap). Plan, and what turned out differently from it: `docs/plans/2026-10-13-phase-5-6-integration.md`
- **Engine requests** (ten applied, one declined, each applied one test-first, the builder's workaround removed):
  - The Clerk's decision on an amendment is its own action, `decide_amendment`, with a task in the Clerk's queue (locked while a department still has one of the amendment's cards) and a panel on the case (`DecideAmendment.tsx`). `amend` is the applicant's alone again; the Clerk's dispatch of it, told apart by comparing answers, is gone
  - Approving an amendment is its quote: nothing is charged. On a permitted case the payment card reopens for what the amended plan costs beyond what was paid, "Accept conditions and sign" opens where the event never had a signature, the applicant signs and pays at `/events/[id]/quote`, and the amendment takes effect when nothing is left. A difference in the applicant's favor is refunded at once. `checkPay` and `checkAcceptAndSign` pass on a permitted case only while that card is open
  - Declining needs a reason and restores the record exactly: the builder's decline re-estimated the fee lines and dropped the application's own "Submit application" card once an amendment had borrowed it. The plan from before is kept as `pendingAmendment(c)`; `permittedPlan(c)` is the case as its permit covers it
  - A change that takes effect at once settles its difference and brings Public Works & Safety's work orders in step with the plan (`syncWorkOrders()`)
  - `issue_food_permits`: Health & Legal's task, created by `issue_permit` for a plan with the "Download per-vendor food permits" card, locked until every vendor's health permit is verified, finished with `complete_city_task`. The applicant's card now unlocks on a new event, `food_permits_issued`. S6's script issues them on Apr 15
  - `activeDemoPath` and `setActiveDemoPath()` on the store: set by the demo guide, the coach's menu, the palette and every scenario jump, cleared by Reset and by dismissing the strip. The path guessed from the URL (`activeDemoPathId()`) is gone
  - `setConfig()` re-classifies every open Draft; the config and the demo path are in the stored demo and put back by Reset
  - `BACK_LABEL` for Payments, Closures and routes, Work orders, Verifications and Inspections. Declined for Settings: its open Drafts are named, not linked, since the city has no page for a Draft
  - The Clerk's license review is titled "Review the temporary alcohol license" (`reviewTaskTitle()`), with "Your own review section, routed ..." in the queue
  - A meeting is a kind of `CalendarItem`, drawn in its day's cell by `MonthGrid`, `WeekGrid` and `DayStrip` (`ItemMark`); the list under the grid (`MeetingsList.tsx`) is gone
  - The permit page links to the amendment ("Change your event"), gated by `canAmend()`
- **Twelve places the builders' work did not meet**, each fixed with a test (the table is in the plan): nothing on the city side showed an amendment; the permit page and the public check showed the amended plan while it was pending; the applicant's board said an amended Instant event's cards were "at intake with the City Clerk" and its departments "Not involved"; a permitted case with money owed opened "Nothing to pay here"; an amendment's balance was on no tab of Payments and its payment read "Quote payment" (`Payment.amendment`); the coach was gone on the last screen of paths 1 and 4 and a dismissal came back with every role switch; the demo guide's "Continue" reopened the first screen; path 7's first step opened the board, not the wizard; Settings linked a Draft to "This application is still a draft"; Payments' "Clear filters" cleared one filter of three; an applicant's Draft was on the inspections list
- **Tests that hold the pieces to each other:** `tests/tool-pages.test.ts` (new) holds each tool page to the case it lists, on the seed and after demo paths 5, 6 and 7; `tests/demo-paths.test.ts` asks the coach for its step after every step of all seven paths and takes path 7 through the checks, the decision, the signature and the payment; `tests/render/handoffs.test.tsx` gains "(j)": every tool link reaches a built page, every new list opens the case and the case comes back to it, Settings reach the wizard's live panel, the coach and the palette land on real screens, and demo path 7 is clicked from the permit to the amended permit; `tests/guards.test.ts` holds that no page renders `PlaceholderScreen`; `tests/both-sides.test.ts` holds an amendment's "With the city" cards to the city's own tasks
- **Consistency across the new pages:** tabs that split a list are the plain tab list with a `CountBadge` each; group headings carry a `CountBadge`; filters are `FilterBar`; an event in a list is `EventTitle` with `CaseId` and `TierBadge`; an empty list says whether it is the filters'; decided rows on Verifications open their case
- **Docs:** `docs/readme.md` has "P1 and P2 (Phases 5 and 6)" (the new pages, the amendment end to end, the coach, the palette, settings, day-of notes), an updated "What is still a placeholder" (no route is), and 28 new questions for the owner; the main plan has Phases 5 and 6 ticked, the builders' screens in section 12 and a Changes line
- Gate on the final tree: type-check, lint, 2,262 tests in 105 files and build pass. The six worktrees and the `phase5/*` branches are removed

**Why:**
- Six workstreams built in isolation agree with the engine and not with each other until something walks from one into the next. The amendment was the widest gap: the applicant's half was built and the city's half was a store dispatch with no screen

**Files Modified:**
- `lib/state/amendment.ts` (new), `lib/state/transitions/amendment.ts` (new, with `amend` moved from `applicant.ts`), `transitions/shared.ts`, `applicant.ts`, `city.ts`, `clerk.ts`, `payment.ts`
- `lib/state/actions.ts`, `checks.ts`, `availableActions.ts`, `waitingOn.ts`, `core.ts`, `transition.ts`, `store.ts`, `types.ts`, `index.ts`, `seed/scenarios/s6.ts`
- `lib/types.ts` (`UnlockEvent`, `Payment.amendment`), `lib/rules/catalog.ts` (`CITY_TASKS.issue_food_permits`, `decide_amendment`, `reviewTaskTitle()`, the food permits card's unlock)
- `lib/view/amend.ts`, `board.ts`, `caseDetail.ts`, `checkout.ts`, `cityLists.ts`, `clerkTools.ts`, `coach.ts`, `payments.ts`, `vendors.ts`, `inspections.ts`, `active.ts`, `settings.ts` (comment); `lib/data/demoScript.ts`
- `components/case/actions/generic/DecideAmendment.tsx` (new), `Pay.tsx`, `CompleteCityTask.tsx`, `index.ts`; `components/case/CaseDetailScreen.tsx`, `tabs/DocumentsTab.tsx`, `vendors/IssueFoodPermits.tsx`, `vendors/VendorsSection.tsx`
- `components/calendar/ItemMark.tsx` (new), `MonthGrid.tsx`, `WeekGrid.tsx`, `DayStrip.tsx`, `types.ts`; `components/active/ActiveScreen.tsx`, `ActiveCalendarView.tsx`, `TodayStrip.tsx`, `MeetingsList.tsx` (removed)
- `components/checkout/CheckoutScreen.tsx`, `QuotePanel.tsx`; `components/permit/PermitCard.tsx`, `PermitScreen.tsx`, `VerifyScreen.tsx`; `components/board/BoardScreen.tsx`; `components/wizard/amend/AmendReviewStep.tsx`
- `components/shell/CoachStrip.tsx`, `CommandPalette.tsx`, `DemoMenu.tsx`, `AppShell.tsx`, `CityShell.tsx`; `components/landing/DemoGuideScreen.tsx`
- `components/city/payments/PaymentsScreen.tsx`, `verifications/VerificationsScreen.tsx`, `inspections/InspectionsScreen.tsx`, `workorders/WorkOrdersScreen.tsx`, `WorkOrdersList.tsx`, `MeetingsTab.tsx`, `settings/SettingsScreen.tsx`, `TierRulesSection.tsx`
- `tests/tool-pages.test.ts` (new), `lib/state/transitions/amendment.test.ts` (new), `foodPermits.test.ts` (new), `tests/demo-paths.test.ts`, `both-sides.test.ts`, `guards.test.ts`, `action-coverage.test.ts`, `tests/render/handoffs.test.tsx`, `harness.tsx`, and the unit and render tests of the files above
- `docs/readme.md`, `docs/log.md`, `docs/plans/2026-10-13-phase-5-6-integration.md` (new), `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-13 - Phase 5A: Amendment (PRD P1, demo path 7)

**What Changed:**
- Added `/events/[id]/amend`: the wizard reopened on the same record in "Change your event" mode, with a local copy of the answers (nothing dispatched until confirmed) and a live result panel comparing the proposed plan to the current one.
- Added `components/wizard/amend/` (AmendWizardScreen, AmendResultPanel, AmendReviewStep) and `lib/view/amend.ts` (`buildAmendmentDiff`, `tierRiseBannerText`, `amendmentGateSatisfied`): the diff between two plans (tier, cards added and removed, fee difference, date gate), tested against the real seed, reproducing the PRD's Maya and DJ example (Reviewed, 19 days against 30 needed, a $53.75 late fee).
- Extended `lib/state/transitions/applicant.ts` and `lib/state/checks.ts`: the `amend` action applies at once when nothing material changes or the tier falls; a material change reopens the amendment's own "Submit application" card and leaves the permit on the original plan until decided.
- Extended `lib/view/board.ts` (`canAmend`, `amendmentBanner`) and `components/board/BoardMenu.tsx`, `BoardScreen.tsx`, `CardSheet.tsx`: the board menu's "Change your event" entry point, a pending-amendment banner, and "Submit amendment" copy on the reused card.
- Added `lib/view/amend.test.ts`, `tests/render/amend.test.tsx`; extended `lib/state/transitions/applicant.test.ts`, `lib/view/board.test.ts`, `tests/demo-paths.test.ts` (path 7 at the store).
- As built, the Clerk's decision was the same `amend` action raised by the Clerk, with no screen for it; the integration replaced that with `decide_amendment` and its panel (entry above).

**Why:**
- PRD P1, demo path 7: an applicant can change an event already past the wizard without losing anything already entered, and the record stays one shared one even when the change moves it up a tier.

**Files Modified:**
- `app/events/[id]/amend/page.tsx`
- `components/wizard/amend/AmendWizardScreen.tsx`, `AmendResultPanel.tsx`, `AmendReviewStep.tsx`
- `components/board/BoardMenu.tsx`, `BoardScreen.tsx`, `CardSheet.tsx`
- `lib/view/amend.ts`, `lib/view/amend.test.ts`
- `lib/view/board.ts`, `lib/view/board.test.ts`
- `lib/state/transitions/applicant.ts`, `lib/state/transitions/applicant.test.ts`
- `lib/state/checks.ts`
- `tests/render/amend.test.tsx`
- `tests/demo-paths.test.ts`

---

## 2026-10-13 - Phase 5B: the Clerk's Payments page, and meetings on Active permits

**What Changed:**
- Added `/city/payments` (`app/city/payments/page.tsx`, `components/city/payments/PaymentsScreen.tsx`, new `lib/view/payments.ts`): the City Clerk's Due, Received and Refunds tabs, kept in the URL with counts, totals, a header summary (collected this month, outstanding, refunds issued) and a search box.
- Extended `lib/view/active.ts` and `components/active/**`: every scheduled meeting and walkthrough shows on the Today strip and the Calendar view, for all three city roles, behind a "Show meetings" URL toggle; the Clerk's side panel gained "Day-of contact duty" for the day in view. (Built as a list beside the grid, `MeetingsList.tsx`; the integration drew meetings in the calendar's own cells instead.)
- New tests: `lib/view/payments.test.ts`, `tests/render/payments.test.tsx`, and additions to `lib/view/active.test.ts` and `tests/render/active.test.tsx`.

**Why:**
- PRD P1 scope: "City Clerk views" (Payments, Licenses, Consultation) and the Active permits role overlays' day-of contact duty.

**Files Modified:**
- `app/city/payments/page.tsx`
- `components/city/payments/PaymentsScreen.tsx`
- `components/active/ActiveScreen.tsx`, `ActiveCalendarView.tsx`, `ActiveMapView.tsx`, `TodayStrip.tsx`, `RoleOverlay.tsx`, `MeetingsList.tsx`
- `lib/view/payments.ts`, `lib/view/payments.test.ts`
- `lib/view/active.ts`, `lib/view/active.test.ts`
- `tests/render/payments.test.tsx`, `tests/render/active.test.tsx`

---

## 2026-10-13 - Phase 5C: Closures map and work orders (Public Works & Safety)

**What Changed:**
- Replaced the placeholders on `/city/map` and `/city/work-orders` with `ClosuresMapScreen` and `WorkOrdersScreen`.
- Added `components/city/closures/` (ClosuresMapScreen, ClosuresSideList, ClosuresCalendarStrip): the Permitopolis map for a day, a week or a custom range, every closure, route and occupied space by status (permitted, held, pending), overlaps named first with both events and their hours, a calendar strip with per-day counts and blackout or impacted marks, and a side list linking to each case.
- Added `components/city/workorders/` (WorkOrdersScreen, WorkOrdersList, MeetingsTab, TodayPanel): every open case's work orders grouped by event with a "Mark done" hand-off, a summary line, a Walkthroughs and meetings tab (Schedule, Reschedule, and Mark held gated by the engine), and a light day-of "Today" panel recording "Closed at" and "Reopened at" notes. This is where 6B's closure checklist went.
- Added `lib/view/closures.ts` and `lib/view/workOrders.ts` with tests against the real seed, plus render tests for both pages (`tests/render/closures.test.tsx`, `tests/render/work-orders.test.tsx`) covering demo path 5, the engine's schedule-meeting refusal, empty states, and the role gate.

**Why:**
- Phase 5 P1 and P2 scope: Public Works & Safety needed its own tool pages for closures and routes and for work orders, meetings, and day-of operations, per the PRD's "Public Works & Safety views" rows.

**Files Modified:**
- `app/city/map/page.tsx`, `app/city/work-orders/page.tsx`
- `components/city/closures/ClosuresMapScreen.tsx`, `ClosuresSideList.tsx`, `ClosuresCalendarStrip.tsx`
- `components/city/workorders/WorkOrdersScreen.tsx`, `WorkOrdersList.tsx`, `MeetingsTab.tsx`, `TodayPanel.tsx`
- `lib/view/closures.ts`, `lib/view/closures.test.ts`
- `lib/view/workOrders.ts`, `lib/view/workOrders.test.ts`
- `tests/render/closures.test.tsx`, `tests/render/work-orders.test.tsx`

---

## 2026-10-13 - Phase 5D: Health & Legal's Verifications, Vendor permits and Inspections

**What Changed:**
- Added `/city/verifications` (P1): one cross-case queue of documents waiting on Health & Legal's check, grouped by document type or event, filtered by type, result, overdue and search, with a "Verify the next one" shortcut and a "Recently decided" tab.
- Added a "Vendors" group to the case Documents tab: each food vendor's health permit status, valid-through date and overall progress, plus an "Issue food permits" action for a Special event once permitted. (Built against an engine step that did not exist; the integration added `issue_food_permits`.)
- Added `/city/inspections` (P2): day-of food booth inspections per event (today and the next 14 days), recording pass, fail or re-inspect as a fixed-wording activity note, with no new engine state. This is where 6B's food booth inspections went.

**Why:**
- PRD rows "Verifications", "Vendor permits" and "Inspections" under Health & Legal's views, demo paths 3 and 5.

**Files Modified:**
- `app/city/verifications/page.tsx`, `app/city/inspections/page.tsx`
- `components/city/verifications/VerificationsScreen.tsx` (new)
- `components/city/inspections/InspectionsScreen.tsx` (new)
- `components/case/vendors/VendorsSection.tsx`, `VendorPermitStatus.tsx`, `IssueFoodPermits.tsx` (new)
- `components/case/tabs/DocumentsTab.tsx`
- `lib/view/verifications.ts`, `lib/view/vendors.ts`, `lib/view/inspections.ts` (new, each with a `.test.ts`)
- `tests/render/verifications.test.tsx`, `tests/render/vendors.test.tsx`, `tests/render/inspections.test.tsx` (new)

---

## 2026-10-13 - Phase 5E: demo coach, demo guide live progress, command palette and keyboard help

**What Changed:**
- `lib/view/coach.ts` (new): a pure function per path (`pathProgress`) that reads the first step not yet done off the store's cases, role, persona and demo date, so the coach is right after a reload, after the presenter improvises, and after Reset.
- `lib/view/palette.ts` (new): builds and ranks the command palette's items (Cases, Go to, Switch role, Personas, Demo) for the current role and persona.
- `components/shell/CoachStrip.tsx`, `CommandCenter.tsx`, `CommandPalette.tsx`, `KeyboardHelp.tsx` (new): the coach strip under the top bar, the Cmd+K or Ctrl+K command palette (arrow keys, Enter, Esc, footer hints), and the "?" keyboard-shortcuts dialog, which does not open while a field has focus.
- `lib/data/demoScript.ts`: each `DemoStep` now carries an id, role, persona, page and the presenter's wording.
- `components/landing/DemoGuideScreen.tsx`: each path card shows "Step X of Y" or "Done" and a check per step from the same function, "Start this path" becomes "Continue" once under way, with "Reset and start", and a "Before you present" checklist.
- As built, the path on show was guessed from the URL; the integration put it on the store (`activeDemoPath`).
- The workstream was built in three commits before the run was cut off; the resume verified it against the brief and changed nothing.

**Why:**
- PRD P1, "Demo hints": callouts that say what to click next on each path, and a command palette for cases, roles and scenarios.

**Files Modified:**
- `lib/view/coach.ts`, `lib/view/coach.test.ts` (new)
- `lib/view/palette.ts`, `lib/view/palette.test.ts` (new)
- `lib/data/demoScript.ts`
- `components/shell/CoachStrip.tsx`, `CommandCenter.tsx`, `CommandPalette.tsx`, `KeyboardHelp.tsx` (new)
- `components/shell/AppShell.tsx`, `CityShell.tsx`, `TopBar.tsx`
- `components/landing/DemoGuideScreen.tsx`
- `tests/render/coach.test.tsx`, `tests/render/palette.test.tsx` (new)

---

## 2026-10-13 - Phase 6A: the City Clerk's Settings tool (/city/settings)

**What Changed:**
- Built `/city/settings` (PRD P2), replacing its placeholder: a page of six sections behind an in-page nav (`?section=` in the URL): Tier rules, Fees and deposits, Inventory and rates, Blackout calendar, Templates, Service levels.
- Tier rules: thresholds and lead times as number fields with guard rails (Reviewed below Special, lead times in order and not negative; an invalid value is never saved) and a live "What this changes" panel showing which open Drafts would change tier and how the Demo menu's six scenarios re-classify under the edited values. "Restore defaults" with a ConfirmDialog.
- Fees and deposits: every rate in `cfg.fees` as a grouped editable table, plus the late fee rate and the date-hold length.
- Inventory and rates, Blackout calendar, Templates: read-only views of `lib/data/{inventory,calendar,templates}.ts`.
- Service levels: `cfg.sla`'s review, response and verification days and the meeting and notice offsets, editable.
- New pure view-model `lib/view/settings.ts` (validation, the tier-change and scenario previews, the fee field registry, blackout and impacted rows) with `lib/view/settings.test.ts` against the real seed, plus `tests/render/settings.test.tsx` clicking through the built page.

**Why:**
- PRD P2 scope: the City Clerk needs to see and adjust the configured rules (tier thresholds, fees, service levels) that the rest of the prototype reads from `lib/rules/config.ts`, with the effect of a threshold change visible before it is relied on.

**Files Modified:**
- `app/city/settings/page.tsx`
- `components/city/settings/SettingsScreen.tsx`, `TierRulesSection.tsx`, `FeesSection.tsx`, `InventorySection.tsx`, `BlackoutSection.tsx`, `TemplatesSection.tsx`, `ServiceLevelsSection.tsx` (new)
- `lib/view/settings.ts`, `lib/view/settings.test.ts` (new)
- `tests/render/settings.test.tsx` (new)

---

## 2026-10-13 - Phase 4 review fixes

**What Changed:**
- The Phase 4 acceptance review returned 18 findings (1 high, 8 medium, 9 low). All 18 were confirmed in the code and fixed, each with a test that fails without its fix (the last finding was four tests that did not render the state they named, and is fixed in the tests). Plan, and what turned out differently from it: `docs/plans/2026-10-13-phase-4-review-fixes.md`
- **High, demo path 4's first screen:** the applicant's "With the city" note counted the days since a card was uploaded and said the current holder had had it that long. S4's cards read "31 days at intake with the City Clerk" while the Clerk's Intake row said 20 days, and "31 days with Health & Legal" on the day it was routed. `withCityInfo()` now counts from the day the party it names got the card: the day the application went in for a card at intake, the day of routing for a card under a review, the day its verify task opened for a card under one, or the day it was sent when that was later. `tests/both-sides.test.ts` compares the figure with `intakeRows().daysInIntake` and `queueFor().daysWaiting` for every such card on the seed, and walks S4 from intake to routed; demo path 4's click-through reads "20 days" on the board and on the Intake row, and "0 days" on the board and in the queue after routing
- **Medium:**
  - Cases table: "Next action" and "Due" are one task's, the open task due soonest among the parties that are up (`pipelineTableRow()`). S5 read "Accept conditions and sign" beside Health & Legal's May 7
  - Routing sections (`lib/rules/routing.ts`) are what a reviewer checks: documents, forms and anything sent for a check. Every vendor's permit is one section, "Vendor health permits"; the catalogue's "Health permit: {vendor}" reached the wizard's reviewers line and Confirm routing's Sections box. The sentence lower-cases each item
  - Request information: a template's `{vendor}` is filled when the template is picked (`fillRequestTemplate()`): the ticked card's vendor, or "each vendor". It was stored and shown to the applicant as typed
  - A review back from a request: My queue says "Answer received May 3" (and "Routed" from the review clock's start), `queueFor().daysWaiting` counts from the start of the stretch the task has been open for now, and `respond_to_request` moves the review's due date and its task's by the days paused. The row read "Routed May 3 · Due today · 14 days waiting · Day 11 of 14"
  - Case detail: "Your actions" lists the role's own open tasks that no row covers, ahead of the rows (`ownTaskRows()`): Health & Legal's document to verify, Public Works & Safety's work orders, the Clerk's meeting to schedule
  - Reviews tab: "Mark held" asks `checkCompleteCityTask()` and is off with the reason under it. The engine names what unlocks a locked card ("Unlocks when the permit is issued") and refuses a meeting before its day
  - Wizard stepper: `WizardStepper` takes `reached`; every step up to it but the one in view keeps its mark and its link. `WizardScreen` passes the furthest step seen on this visit or answered on the draft (`furthestAnsweredStep()`)
  - A series' cancellation refund applies the band to the fees paid, in `cancellationRefund()`: Sunrise Yoga's $20 less the $10 processing fee is $10, where the page said "full refund minus a $10 processing fee" and then $20
- **Low:**
  - The board's status strip reads off `involvement()`: "Starts after intake" for a department a card names before routing, "Nothing to review" for the Clerk on an Instant event
  - A reviewer's queue row shows `routingReasons()`, not every trigger on the case; `triggerLabels()` is gone
  - One name per step: seven `CITY_TASKS` titles start with their button's words ("Send quote: consolidate the reviews"), and the quote builder's sheet is headed "Send quote"
  - `ConditionList` shows "Merged" only with `showMerged`, which the city's screens pass
  - A fee preset starts at 1 when the plan gives 0, and a named line with no quantity stops the decision ("Give Police a quantity, or remove the line.")
  - `FeeTable`'s closeout row is "Actual fees", without the deposit; a quantity reads as a count (`fmtQty()`: "40 officer-hours")
  - `waitingOnOthers()` leaves out a case nobody is up on, unless it is stalled
  - Map shapes are keyed by id and position on the thumbnail and the display map; a route that laps a segment no longer counts as overlapping itself (found beside the key fix)
  - Copy: "(automatic for Instant)" on Instant plans only; "Not routed" once routing is behind the case; a cancelled case's reason is a sentence with the amount; Intake's "9 of 12 sign-offs"
  - States matrix: the four entries that did not render their state now do (an empty queue with a case waiting on somebody else; a choice the engine refuses in Confirm routing and in Schedule; B08's overdue card on its board; the Stalled chip in the queue)
- **Docs:** `docs/readme.md` has "What the Phase 4 review changed", the engine notes that changed, and nine questions for the owner; the main plan has a Changes line

**Why:**
- The review found the first screen of a P0 demo path showing a figure the next screen contradicted, and seventeen smaller places where two screens, or a screen and the engine, disagreed about one thing

**Files Modified:**
- `lib/view/board.ts`, `lib/view/cityLists.ts`, `lib/view/caseDetail.ts`, `lib/view/clerkTools.ts`, `lib/view/reviewTools.ts`, `lib/view/wizard.ts`, and their tests; `lib/view/permit.test.ts`
- `lib/rules/routing.ts`, `lib/rules/cancellation.ts`, `lib/rules/requirements.ts`, `lib/rules/catalog.ts`, `lib/rules/classify.test.ts`, `lib/rules/routing.test.ts`, `lib/rules/cancellation.test.ts`
- `lib/state/selectors.ts`, `lib/state/checks.ts`, `lib/state/waitingOn.ts`, `lib/state/core.ts` (comment), `lib/state/transitions/applicant.ts`, `lib/state/transitions/city.ts`, `lib/state/transitions/clerk.ts`, and their tests
- `lib/format.ts`, `lib/format.test.ts`, `lib/data/templates.ts` (comment)
- `components/case/ActionsPanel.tsx`, `CaseDetailScreen.tsx`, `tabs/ReviewsTab.tsx`, `tabs/ConditionsFeesTab.tsx`, `review/FeeLineBuilder.tsx`, `clerk/DepartmentConsolidation.tsx`
- `components/case/actions/generic/RequestInfo.tsx`, `ReviewDecide.tsx`, `SendQuote.tsx`, `IssuePermit.tsx`, `CompleteCityTask.tsx`
- `components/city/lists/QueueScreen.tsx`, `IntakeScreen.tsx`; `components/wizard/WizardScreen.tsx`; `components/ui/wizard-stepper.tsx`; `components/kit/KitScreen.tsx`
- `components/domain/ConditionList.tsx`, `FeeTable.tsx`; `components/map/MapThumbnail.tsx`, `PermitopolisMap.tsx`; and their tests
- `tests/both-sides.test.ts`, `tests/demo-paths.test.ts`, `tests/engines.test.ts`, `tests/seed.test.ts`
- `tests/render/handoffs.test.tsx`, `board.test.tsx`, `case-detail.test.tsx`, `role-tools.test.tsx`, `review-tools.test.tsx`, `city-lists.test.tsx`, `states-matrix.test.tsx`, `wizard.test.tsx`, `permit.test.tsx`, `checkout.test.tsx`, `map.test.tsx`, `blocks-seed.test.tsx`
- `docs/readme.md`, `docs/log.md`, `docs/plans/2026-10-13-phase-4-review-fixes.md` (new), `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-13 - Phase 4 integration: the role tools meet

**What Changed:**
- Merged `phase4/states`, `clerk`, `review`, `verify` and `applicant` into `build`, no fast-forward and no conflicts. The gate passed on the merged tree before any change (1,699 tests in 80 files). Plan, the builders' requests and every seam: `docs/plans/2026-10-13-phase-4-integration.md`
- **Engine requests, four applied (test first) and two declined:**
  - `confirm_routing` refuses a list that leaves out a department one of the applicant's documents or forms names as its reviewer (`Route Health & Legal too: it checks "Certificate of insurance".`), in `checkConfirmRouting()`. The routing panel's own insurance-only guard is gone: it asks the engine about the list as it stands. The panel now has a row for every department, so a reviewer can be added as well as removed. B22's seed script routes Health & Legal too
  - `schedule_meeting` checks its date: today or later, before the event, not a blackout day. `checkScheduleMeeting()` takes `{ date, today }`; `citywideBlackoutOn()` is new in `lib/rules`. `meetingDateValid()` and `isBlackoutDate()` left `lib/view/reviewTools.ts`
  - The action sheet opens at 48rem for the panels that need two columns or a table (`panelWidthFor()` in `actions/registry.ts`). The verify panel is preview beside checklist from 1024px; the consolidation is one column per routed department
  - A per-vendor card carries `payload.vendorName` (`requirements()`); a board rebuilt after an edit takes the new name and keeps what was uploaded. The title regex left `lib/view/verify.ts`
  - Declined: truncating the case header's name (it wraps; `break-words` added), and a per-task "who can act" caption in Who's up (each row already names its party)
- **Seams between the builders' work, each fixed and tested:**
  - `send_quote` takes `merged: true`. An empty list meant "as the case stands", so a Clerk who removed every condition in the quote builder sent them all. A quote with no fee line cannot be sent
  - The applicant's "With the city" note names who holds the card now. Before routing it said a department had it while the city showed that department as not started; it reads "at intake with the City Clerk, then Health & Legal" with the intake check's date. `tests/both-sides.test.ts` holds every such card on the seed to the city's own task
  - A lone vendor's permit is its own row on the Documents tab, and a vendor group opens while one of its permits is in flight: S3's pinned request was inside a collapsed group
  - The review panel offers conditions under "Approve with conditions" only, and that decision needs one; they could go out with a plain approval
  - The accessibility checklist passes its viewing-area item on the route the form asks for: the form calls the named area optional and no seeded plan names one, so every approved plan read as failing
  - `tests/action-coverage.test.ts` rendered panels inside the sheet's portal, which renders nothing on the server, so it could not fail. It renders each panel itself, and every open task in Who's up for each city role
  - `StalledBadge` and `CommissionBadge` moved to `components/domain`; the case detail drew its own copy of the chip
  - My queue's reason line says "uploaded" for a first upload and "re-uploaded" after that
- **Consistency:** one fee-line row (`components/case/FeeLineFields.tsx`) for the review panel and the quote builder; one department picker (`clerk/DeptSelect.tsx`); one cleanup result block (`CleanupResult.tsx`: "Cleanup inspection", "Pass" or "Issues found"); the logged closeout is `FeeTable showActual`; money through `Money` and `fmtMoney` ("$510", not "+510.00"), dates through `fmtDateShort` ("Session payment: Tue, Jun 8"), counts through `plural()`; a checklist reads the same in Verify and in Issue permit; a meeting is "Mark held"; a condition's buttons are named for it; one `taskSubmittedOn()` behind both sides' "days waiting"
- **Tests:** `tests/render/role-tools.test.tsx` (the registry, the sheet widths, the review-to-request hand-off, S3 and S6 through Reviews, Documents and Conditions and fees after each role acts); `tests/render/handoffs.test.tsx` clicks demo paths 5 and 6 from first step to last with the role switcher, as 3 and 4 were; `tests/both-sides.test.ts`
- **Docs:** `docs/readme.md` has "Role tools and edge states (Phase 4)" and 16 new questions for the owner; the main plan has Phase 4 ticked, the builders' screens in section 12 and a Changes line

**Why:**
- Five builders worked in parallel worktrees without sight of each other. The integration decides what they asked of shared code, joins what one built to what another reads, and proves the two P0 demo paths Phase 4 was for

**Files Modified:**
- `lib/state/checks.ts`, `lib/state/actions.ts`, `lib/state/core.ts`, `lib/state/index.ts`, `lib/state/transitions/clerk.ts`, `lib/state/transitions/city.ts`, `lib/state/transitions/applicant.ts`, `lib/state/seed/background/b22-b25.ts`, and their tests
- `lib/rules/availability.ts`, `lib/rules/requirements.ts`, `lib/rules/index.ts`, `lib/types.ts`, and their tests
- `lib/view/board.ts`, `lib/view/verify.ts`, `lib/view/clerkTools.ts`, `lib/view/reviewTools.ts`, `lib/view/cityLists.ts`, `lib/view/active.ts`, and their tests
- `components/case/ActionSheet.tsx`, `CaseDetailScreen.tsx`, `FeeLineFields.tsx` (new), `CleanupResult.tsx` (new), `actions/registry.ts`, `actions/clerk.tsx`, `actions/pws.tsx`, `actions/hl.tsx`, `actions/generic/index.ts`
- `components/case/actions/generic/ConfirmRouting.tsx`, `SendQuote.tsx`, `ScheduleMeeting.tsx`, `VerifyDocument.tsx`, `ReviewDecide.tsx`, `LogCloseout.tsx`, `ReconcileClose.tsx`, `IssuePermit.tsx`, `CompleteCityTask.tsx`
- `components/case/clerk/ConditionsEditor.tsx`, `QuoteLinesEditor.tsx`, `DepartmentConsolidation.tsx`, `DeptSelect.tsx` (new), `components/case/review/FeeLineBuilder.tsx`, `components/case/tabs/DocumentsTab.tsx`
- `components/domain/StalledBadge.tsx` and `CommissionBadge.tsx` (moved from `components/city/lists/`), `components/domain/index.ts`, `components/domain/CaseHeader.tsx`
- `components/city/lists/QueueScreen.tsx`, `PipelineBoard.tsx`, `PipelineTable.tsx`, `components/board/BoardColumns.tsx`
- `tests/action-coverage.test.ts`, `tests/both-sides.test.ts` (new), `tests/engines.test.ts`, `tests/seed.test.ts`
- `tests/render/role-tools.test.tsx` (new), `handoffs.test.tsx`, `clerk-tools.test.tsx`, `review-tools.test.tsx`, `board.test.tsx`
- `docs/readme.md`, `docs/log.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`, `docs/plans/2026-10-13-phase-4-integration.md` (new)

---

## 2026-10-13 - Phase 4A: City Clerk's tools (consolidation, quote builder, routing, permit, reconciliation)

**What Changed:**
- `lib/view/clerkTools.ts` (new) + `lib/view/clerkTools.test.ts`: condition-conflict detection (exact duplicates and cross-department value clashes), editable condition-row and fee-line-row helpers and totals (mirroring `dueAtQuote()`'s series math), routing's weekend-safe default due date and lead-time-left, the request-info card groups and card preview, the issue-permit checklist (who owes it, since when), closeout reconciliation lines, and payment rows for the Conditions and fees tab.
- `components/case/clerk/` (new): `ConditionsEditor.tsx`, `QuoteLinesEditor.tsx`, `DepartmentConsolidation.tsx` — the consolidation/quote builder's editable lists and side-by-side department view, built on native `<select>` pickers (not Radix) for the flat department/template lists.
- `components/case/actions/generic/SendQuote.tsx`: rebuilt into the Consolidation and quote builder panel.
- `components/case/actions/generic/ConfirmRouting.tsx`: weekend-safe default due date, a lead-time-left line, and a guard against routing without Health & Legal while an insurance card exists.
- `components/case/actions/generic/RequestInfo.tsx`: reworked to a multi-select of the applicant's cards by status (one request per chosen card), with a live preview of the card the applicant will see.
- `components/case/actions/generic/IssuePermit.tsx`: a checklist of what's owed, by whom and since when, plus what the permit covers and what issuing triggers.
- `components/case/actions/generic/ReconcileClose.tsx`: a full per-line estimate-vs-actual table and the cleanup result/notes, alongside the existing settlement stats.
- `components/case/actions/generic/Pay.tsx`: lets the Clerk choose which session when more than one sits overdue on a series.
- `components/case/tabs/ConditionsFeesTab.tsx`: added a payments and refunds table.
- `tests/render/clerk-tools.test.tsx` (new): render tests for S3 (quote + an edited line), S4 (routing), S5 (the permit checklist before/after each step), S6 (reconciliation) and Deny.

**Why:**
- Workstream 4A of Phase 4 (City Clerk's tools), per the PRD's City Clerk views table and the owner's build brief dated 2026-10-13. The plan's 4B (Clerk money and closeout) was built with it, as one workstream.

**Files Modified:**
- `lib/view/clerkTools.ts`, `lib/view/clerkTools.test.ts`
- `components/case/clerk/ConditionsEditor.tsx`, `components/case/clerk/QuoteLinesEditor.tsx`, `components/case/clerk/DepartmentConsolidation.tsx`
- `components/case/actions/generic/SendQuote.tsx`, `ConfirmRouting.tsx`, `RequestInfo.tsx`, `IssuePermit.tsx`, `ReconcileClose.tsx`, `Pay.tsx`
- `components/case/tabs/ConditionsFeesTab.tsx`
- `tests/render/clerk-tools.test.tsx`

---

## 2026-10-13 - Reviewer tools: review panel, PWS closeout, work orders and meetings (Workstream 4C)

**What Changed:**
- Rebuilt the shared review-decide panel (`components/case/actions/generic/ReviewDecide.tsx`) with a 4-way decision (Approve, Approve with conditions, Request information, Deny with a reason), the routing triggers and review clock, the applicant's submitted material per routed section, a reorderable condition builder fed by department templates plus free text, and a fee-line builder with per-department presets from the fee schedule and a note of what the plan's own estimate already carries.
- Added `components/case/review/SubmittedMaterial.tsx`, `ConditionBuilder.tsx` and `FeeLineBuilder.tsx`, the shared pieces the review panel is built from.
- Rebuilt Public Works & Safety's closeout (`LogCloseout.tsx`): per-line actual quantities against the estimate with a live difference and running total, an Instant event's own damage-report shape, and a read-only view once logged.
- Rebuilt `CompleteCityTask.tsx` (a work order's own detail: what, how many, for which event, due) and `ScheduleMeeting.tsx` (date validation against the event date and blackouts, and who attends).
- Enhanced `components/case/tabs/ReviewsTab.tsx`: the viewer's own department sorts first and is actionable; a department named on cards but not yet routed says so; the Clerk sees every review's clock against its due date; meeting cards are schedulable/completable from here.
- Added `lib/view/reviewTools.ts`, the pure view-model behind all of the above, with `lib/view/reviewTools.test.ts` against the real seed.
- Added `tests/render/review-tools.test.tsx`.

**Why:**
- Phase 4, workstream 4C: deepen the reviewer tools for Public Works & Safety and Health & Legal (and the Clerk's own license review, which shares the same panel) per the PRD's "Public Works & Safety views" and "Health & Legal views".

**Files Modified:**
- `components/case/actions/generic/ReviewDecide.tsx`
- `components/case/actions/generic/LogCloseout.tsx`
- `components/case/actions/generic/CompleteCityTask.tsx`
- `components/case/actions/generic/ScheduleMeeting.tsx`
- `components/case/tabs/ReviewsTab.tsx`
- `components/case/review/SubmittedMaterial.tsx` (new)
- `components/case/review/ConditionBuilder.tsx` (new)
- `components/case/review/FeeLineBuilder.tsx` (new)
- `lib/view/reviewTools.ts` (new)
- `lib/view/reviewTools.test.ts` (new)
- `tests/render/review-tools.test.tsx` (new)

---

## 2026-10-13 - Workstream 4D: document verification panel, checklists and Documents tab

**What Changed:**
- Added `lib/view/verify.ts` + `lib/view/verify.test.ts`: deterministic mock document preview and checklist for every reviewed catalogue id (insurance certificate, vendor health permit, accessibility plan, the other plan documents and forms, the posted-notice photo), plus Documents-tab grouping/progress/ordering/waiting helpers.
- Added `components/case/verify/DocumentPreview.tsx`, `ChecklistPanel.tsx`, `index.ts`: the two presentational pieces the panel is built from.
- Rewrote `components/case/actions/generic/VerifyDocument.tsx`: merged Verify and Send back into one panel — preview, a confirm/override checklist, and a reason field that appears and is prefilled once an item fails; the primary action switches from Verify to Send back accordingly.
- Rewrote `components/case/actions/generic/RejectDocument.tsx` to re-export the same merged panel under `reject_document` (no behavior of its own left to maintain).
- Rewrote `components/case/tabs/DocumentsTab.tsx`: grouped by reviewing department (viewer's own first), a "Needs my check" filter, read-only display for a non-reviewing department, per-vendor health permits collapsed into one progress row, request thread and verification history shown per card.
- Added `tests/render/verify.test.tsx`: S5's insurance clearing, S3's health-permit path, the wedding-photos JPEG failing with a prefilled Send back, read-only for another department, the filter, and the vendor group.

**Why:**
- Workstream 4D of the Phase 4 build: deepen document verification on the case detail screen and the Documents tab per the PRD's Health & Legal "Verifications" checklist and the applicant card catalogue.

**Files Modified:**
- `lib/view/verify.ts` (new)
- `lib/view/verify.test.ts` (new)
- `components/case/verify/DocumentPreview.tsx` (new)
- `components/case/verify/ChecklistPanel.tsx` (new)
- `components/case/verify/index.ts` (new)
- `components/case/actions/generic/VerifyDocument.tsx`
- `components/case/actions/generic/RejectDocument.tsx`
- `components/case/tabs/DocumentsTab.tsx`
- `tests/render/verify.test.tsx` (new)

---

## 2026-10-13 - Workstream 4E: applicant depth (after the event, series, With-the-city, states matrix, 375px)

**What Changed:**
- `lib/view/wizard.ts` — tightened `dateGateSatisfied()` and `buildResultPanel()`'s late-fee line to defer fully to `lateFeeCarriesDate()` (the engine's own `fixes`), instead of reading availability status directly; fixes a gap where a past-dated or stale draft's late-fee flag could carry a date the engine would refuse.
- `lib/view/board.ts` — added `closeoutStatusLine()`, `finalSettlement()`, `bookAgainDraftDate()`, `seriesTotals()`, `withCityInfo()`, `withCityColumnSummary()`.
- `components/board/BoardScreen.tsx`, `CardSheet.tsx`, `BoardColumns.tsx`, `SeriesScheduleSheet.tsx`, `CardForms.tsx`, `VendorStackSheet.tsx` — wired the above in: the Closeout status line, the final bill/refund settlement sentence + estimated/actual table + Pay button, Book-again's draft date before the click, the series schedule's paid/outstanding stats and "Pay the session due" action, every With-the-city card's who/how-long/expected-by note and the column summary line, plus a 375px pass (tap targets, a cramped form row).
- `components/checkout/BookingPanel.tsx` — a series' booking page now states what is charged now vs. later.
- `components/checkout/CardPaymentForm.tsx` — added per-field validation (was previously accepting any input, including empty, and "succeeding" regardless).
- `lib/view/wizard.test.ts`, `lib/view/board.test.ts`, `tests/render/board.test.tsx`, `tests/render/checkout.test.tsx` — extended for all of the above.
- `tests/render/applicant-states.test.tsx` — new file, 31 tests, one per state in the brief's applicant states matrix.

**Why:**
- Phase 4 brief, workstream 4E: deepen the applicant side's after-the-event flow, series billing, "With the city" visibility, edge/empty/error states, and mobile layout, per the PRD and the take-home brief's emphasis on realistic edge states. The plan's 4E ("After the event") became this wider applicant depth pass.

**Files Modified:**
- `lib/view/wizard.ts`, `lib/view/wizard.test.ts`
- `lib/view/board.ts`, `lib/view/board.test.ts`
- `components/board/BoardScreen.tsx`, `components/board/CardSheet.tsx`, `components/board/BoardColumns.tsx`, `components/board/SeriesScheduleSheet.tsx`, `components/board/CardForms.tsx`, `components/board/VendorStackSheet.tsx`
- `components/checkout/BookingPanel.tsx`, `components/checkout/CardPaymentForm.tsx`
- `tests/render/board.test.tsx`, `tests/render/checkout.test.tsx`, `tests/render/applicant-states.test.tsx` (new)

---

## 2026-10-13 - Phase 4F: city edge states, stalled cases and action coverage

**What Changed:**
- `lib/view/cityLists.ts`: `queueReasonLine()` for My queue's one-line "why now"; Group by (State default, Event date buckets) for the Cases board; table column visibility and a density toggle, all kept in the URL.
- `lib/view/caseDetail.ts`: `groupActivityByDay()`, `lastActedAt()`, `sinceLastActedCount()` for the Activity tab; `isHoldExpiringTomorrow()`.
- `lib/view/active.ts`: wires `isHoldExpiringTomorrow` into `activeListRows()`.
- `components/city/lists/StalledBadge.tsx`, `CommissionBadge.tsx` (new): dev-only "Stalled" chip and a "Sent to commission" marker, wired into `QueueScreen`, `PipelineBoard`, `PipelineTable`.
- `components/city/lists/{QueueScreen,CasesScreen,PipelineBoard,PipelineTable}.tsx`: queue reason line, Group by control, column-visibility chips, density toggle, the two markers.
- `components/case/CaseDetailScreen.tsx`: dev-only Stalled chip near the header; "expires tomorrow" alert.
- `components/case/tabs/ActivityTab.tsx`: day grouping and a "Since you last acted" marker, keeping the existing party filter.
- `components/active/ActiveListView.tsx`: "Expires tomorrow" flag on a held row.
- `tests/action-coverage.test.ts` (new): every action type has a dispatching control (or the one documented gap, "amend"), and every seeded case/role's `availableActions()` row has a panel that renders.
- `tests/render/states-matrix.test.tsx` (new): one render test per EMPTY/ERROR/EDGE cell across My queue, the Cases board/table, Intake, the case detail and Active permits.
- Extended `lib/view/{cityLists,caseDetail,active}.test.ts` and `tests/render/{city-lists,case-detail,active}.test.tsx` with matching unit/view-model coverage.

**Why:**
- Workstream 4F (Phase 4, plan section 8): the states matrix for the list and detail views, the Stalled chip the PRD's "Core model" calls for, the action-coverage gate, and the PRD's push ("officials may triage by deadline more than by state").

**Files Modified:**
- `lib/view/cityLists.ts`, `lib/view/caseDetail.ts`, `lib/view/active.ts`
- `components/city/lists/QueueScreen.tsx`, `CasesScreen.tsx`, `PipelineBoard.tsx`, `PipelineTable.tsx`, `StalledBadge.tsx` (new), `CommissionBadge.tsx` (new)
- `components/case/CaseDetailScreen.tsx`, `components/case/tabs/ActivityTab.tsx`
- `components/active/ActiveListView.tsx`
- `tests/action-coverage.test.ts` (new), `tests/render/states-matrix.test.tsx` (new)
- `lib/view/cityLists.test.ts`, `lib/view/caseDetail.test.ts`, `lib/view/active.test.ts`
- `tests/render/city-lists.test.tsx`, `tests/render/case-detail.test.tsx`, `tests/render/active.test.tsx`

---

## 2026-10-13 - Phase 3 review fixes

**What Changed:**
- The Phase 3 review returned 38 findings (2 high, 23 medium, 13 low). Plan: `docs/plans/2026-10-13-phase-3-review-fixes.md`
- **High: the refund on the permit page and in the board's Cancel dialog is the one `cancel` pays.** Both printed `cancellationRefund()` off the fee lines, which for a series cover every session: after demo path 1 (S2 pays $20 for the first of 13 sessions) they read "$250" and the transition then refunded $20. `refundIfCancelled(c, today, cfg)` in `lib/state` is now the one figure (the schedule's share plus the deposit, capped at what was paid); `cancel()` uses it and both screens print it. The Cancel dialog reads the store's fee settings instead of the defaults
- **High: a card's form is read back in words on the city's case detail.** The Documents tab and the Verify and Send back panels printed raw keys and `String(value)`: S3's vendor list read "vendors: [object Object]", S6's 25 times over. `formRows(task)` (in `lib/view/cardForms.ts`, exported from `lib/view/caseDetail.ts`) gives the label the applicant saw (a key nobody labelled reads as its own words), Yes or No, 12-hour times, and a list entry per line; `components/domain/FormAnswers.tsx` prints it in both places. The field specs moved from `components/board/CardForms.tsx` to `lib/view/cardForms.ts` so both surfaces share them
- **Applicant side, medium:**
  - Board card sheet: an accepted document opened with Send already armed (the file list was seeded from the accepted file), and one click put S3's verified Certificate of insurance back in front of Health & Legal, which blocks demo path 3's last step. It now shows the accepted file read-only and offers "Replace this file", enabled only after a new file is chosen and only while `complete_task` would take it (not once the permit is issued)
  - Board card sheet: a form card that is with the city or accepted showed its editable form and a Send that could only fail ("This card is already submitted."). It is read back with `FormAnswers` and a line saying who has it; this covers the vendor list and the city services request too
  - Wizard step 3: the lead-time banner printed the days until the event as the shortfall ("needs 19 more days"). It reads "19 days left, 30 needed. This event needs 11 more days of notice than it has." (`leadTimeGapText()`)
  - Wizard: on a blank wizard Next only rewrote the URL while the step was hard-wired to step 1, a dead click. The step is read from the URL with or without a draft, and no draft is started just for moving on
  - Wizard: a change made before the URL carried the new draft's id started another draft ("J", "Ja", ...), because `router.replace()` is a transition. The id of the draft this visit created is kept until the URL has it
  - Wizard step 4: vendor names could not be typed (the field was drawn from the parsed list, so a space or comma vanished as it was typed). The text as typed is kept locally; the hint says "separated by commas"
  - Wizard step 3: moving a series to another weekday left `recurrence.weekday` (and a passed end date) stale: "Repeats every Sunday" over a list of Saturdays, and a booked series that no longer held its slot. `scheduleOnDate()` rebuilds both
  - Wizard step 5: the date gate's three fixes were only on step 3, though the gate is usually tripped on step 4. `DateGateBanner` is on step 5 too, above the primary button
  - Sheets below 640px: the side rules (`data-[side=right]:w-3/4`, specificity 0,2,0) beat the `max-sm:` bottom-sheet rules, so a card sheet on a phone was a 75% panel pinned top-left. The left, right and top rules are scoped to `sm` and up
  - Board at 375px: the four column tabs overflowed the page (two rows of two now); the header's stepper drew eight nowrap labels in 295px (`CaseHeader` takes `compactStepper`, set by the board and the quote below 768px)
  - `FeeTable` takes `compact`: two columns, with "qty unit × price" under the line. The wizard's 320px panel and the plan, booking, quote and final bill on a phone use it, so the amount per line is in view
  - Wizard on a phone: the tier-change announcement and highlight lived in `ResultPanel`, which is not mounted while its sheet is shut. `WizardScreen` owns both and rings the bottom bar's badge
  - Checkout: after paying, the screen read "Nothing to pay here" until the next page arrived. The paid state stays on screen for that visit ("Booked and paid", "Session paid", "Final bill paid")
  - State stepper: the Needs info pill sat 28px above a row with 16px of room, over the header's meta line. The row reserves the room
- **Applicant side, low:** the late fee, once chosen, is confirmed in the banner with "Remove the late fee"; the permit lists the whole cancellation schedule with today's band marked, names the deposit, and drops "If cancelled today" once cancelling is refused; a finished payment, sign-off or permit card shows what was paid or signed and when, with a link (`cardRecord()`); the wizard stepper's labels are `sr-only` below `sm` instead of `display: none`, with "Step N:"; vendor rows carry a status word; the quote's condition checkbox has a visible "I accept"; the demo guide's scenario table wraps; the landing page's nav and footer are landmarks beside `<main>`
- **City side, medium:**
  - Cases search: the box was drawn from the URL and every key called `router.replace()`, a transition, so letters dropped and the caret jumped. The text is local state; the list filters at once and the URL is written 200 ms after the last key. A change from outside (a chip removed, Back) still reaches the box. `parseCasesFilters()` now ignores a `from` or `to` that is not a date
  - Pipeline board: under a State filter the board is that one column (it read "3 of 28 cases" over a row of "Nothing here", the matches off-screen); columns are flexible, so seven share the 932px a 1280px window leaves
  - Closeout: once the hours were in, the tab read "Due $750" with a $1,000 deposit in hand. `closeoutSettlement(c)` (over estimate, from deposit, refund or final bill) is what `reconcile_close` now calls, what the Conditions and fees tab shows in Closeout, and what the Reconcile and close panel shows above its button
  - Log closeout could be pressed again after logging: the panel showed the estimates under "Actual", reset police to its estimate and added a second "Cleanup crew" line. The engine refuses a second log ("Hours were logged on ...; the City Clerk is reconciling."), the panel starts from the logged quantities, a cleared field is left out instead of sent as 0, and an extra line replaces one of the same label
  - Needs info: the Clerk's "Send quote" on S3 read "This case is needs info."; it reads "Waiting on the applicant's response to Health & Legal's request.", and `requireState()` says "Not available while the case is in <State>." A case asked for information at intake offered "Send quote" and "Send to commission"; it keeps the intake set (Accept as complete, waiting on the answer; Request information; Deny)
  - Active permits: a day clicked in the Today strip changed nothing on the List and Closeout tabs. It opens that day's map; the chosen day is marked in the strip and both grids (`selected`, `aria-pressed`); the Map has a date field (Jul 11 was 69 presses of "Next day")
  - Active permits: the role overlay's side panel totaled every case in the store ("25 of 52" vendor permits). It totals the permits on show (25 of 25), and follows "Include held dates"
  - Intake: after Accept as complete the row vanished and only a toast was left. It goes on to the case with "Date held" in the header and Confirm routing open
- **City side, low:** "Record an in-person payment" on a paid quote is disabled with "The quote is paid in full." (the engine refuses the overpayment too); j/k and the arrow keys leave handled events, modified keys (Ctrl/Cmd+K) and radiogroups, menus, listboxes, dialogs and tablists alone; My queue shows the review clock on review rows only; a meeting card opens Schedule or Close for the Clerk and the department that holds it (`openKeyForTask()`); Confirm routing refuses a missing or past due date, in the panel and in `checkConfirmRouting()`; an undated task that has waited more than a week is grouped "Due this week" (the Clerk's opening queue: 1 overdue, 7 this week); copy ("3 tents or stages", no "Sessions: Not provided", "Add-ons: None", "this case lost its date hold", "Event date from Jun 1", "No license review on this case.", the event date on a pipeline card); a decided review no longer lists "Decide your review", and "Send to commission" is sent once; the Cases table's rows are rows again (the event's name is the link) and the sorted header has `aria-sort`
- **Render harness:** `holdNavigation()` and `releaseNavigation()` open the gap between a `router.push()` or `router.replace()` and the URL catching up, which the synchronous mock hid (the duplicate-draft, search-box and after-payment findings all live in it)

**Why:**
- A read-only review of the applicant side and the city side after the Phase 3 integration. Each finding was confirmed in the code and has a test that fails without its fix

**Files Modified:**
- `lib/state/selectors.ts`, `lib/state/index.ts`, `lib/state/transitions/applicant.ts` - `refundIfCancelled()`
- `components/permit/PermitCard.tsx`, `components/board/BoardMenu.tsx` - print it
- `lib/view/cardForms.ts` (new), `lib/view/caseDetail.ts` - `FORM_FIELDS`, `formRows()`
- `components/domain/FormAnswers.tsx` (new), `components/case/tabs/DocumentsTab.tsx`, `components/case/actions/generic/VerifyDocument.tsx`, `components/board/CardForms.tsx`, `components/board/CardSheet.tsx`
- `lib/view/permit.test.ts`, `lib/view/caseDetail.test.ts`, `tests/render/permit.test.tsx`, `tests/render/board.test.tsx`, `tests/render/case-detail.test.tsx`
- `lib/view/wizard.ts` (`scheduleOnDate`, `leadTimeGapText`, `lateFeeCarriesDate`), `lib/view/board.ts` (`cardRecord`), and their tests
- `components/wizard/{WizardScreen,StepWhen,StepPlan,StepSize,ResultPanel}.tsx`, `components/wizard/DateGateBanner.tsx` (new)
- `components/board/{CardSheet,BoardColumns,BoardScreen,VendorStackSheet}.tsx`
- `components/checkout/{CheckoutScreen,BookingPanel,SessionPanel,FinalPanel,QuotePanel}.tsx`
- `components/domain/{FeeTable,CaseHeader,StateStepper,ConditionList,FormAnswers}.tsx`, `components/domain/index.ts`
- `components/ui/{sheet,wizard-stepper}.tsx`, `components/landing/{LandingScreen,ClosingFooter,DemoGuideScreen}.tsx`
- `tests/render/{setup.ts,harness.tsx}`, `tests/render/{wizard,board,checkout,landing,handoffs}.test.tsx`, `components/ui/{sheet,wizard-stepper}.test.tsx`, `components/domain/{FeeTable,StateStepper,ConditionList}.test.tsx`
- `lib/state/{checks,availableActions,selectors,waitingOn,index}.ts`, `lib/state/transitions/{clerk,city,payment}.ts` - the engine changes above; `closeoutSettlement()`
- `lib/view/{cityLists,caseDetail}.ts` - board columns under a State filter, date chips and date params; overview copy; meeting cards
- `components/city/lists/{CasesScreen,PipelineBoard,PipelineTable,QueueScreen,IntakeScreen}.tsx`, `components/city/lists/useRovingListNav.ts`
- `components/case/CloseoutSettlementStats.tsx` (new), `components/case/tabs/{ConditionsFeesTab,ReviewsTab}.tsx`, `components/case/actions/generic/{ReconcileClose,LogCloseout,Pay,ConfirmRouting}.tsx`
- `components/active/{ActiveScreen,ActiveCalendarView,ActiveMapView,TodayStrip}.tsx`, `components/calendar/{DayStrip,MonthGrid,WeekGrid,tierStyles}.ts(x)`
- `lib/state/{availableActions,selectors,waitingOn}.test.ts`, `lib/state/transitions/{clerk,payment}.test.ts`, `lib/state/seed/replay.test.ts`, `lib/view/{cityLists,caseDetail,active}.test.ts`, `tests/{engines,seed,demo-paths}.test.ts`, `tests/render/{city-lists,case-detail,active,handoffs}.test.tsx`
- `docs/readme.md` (the harness, shared components, selectors, "How the engine behaves", "What the Phase 3 review changed", six questions for the owner), `docs/plans/2026-10-12-permitopolis-prototype.md` (Changes)
- `docs/plans/2026-10-13-phase-3-review-fixes.md` (new)

---

## 2026-10-13 - Phase 3 integration: the seven surfaces meet

**What Changed:**
- Merged `phase3/landing`, `wizard`, `board`, `checkout`, `lists`, `case` and `active` into `build` (2026-10-12; no conflicts) and made the surfaces hand off to each other. Plan, with the table of what was broken: `docs/plans/2026-10-12-phase-3-integration.md`. The work was cut off by a usage limit on 2026-10-12 with its changes uncommitted, and resumed and finished on 2026-10-13
- **Hand-offs fixed (11):**
  - My queue, Intake and Who's up pass a task's id in `?task=`, which the case detail read only as its own action key, so the sheet opened empty. `resolveOpenKey()` takes either and opens the panel that moves that task on for whoever is looking, or nothing
  - Intake's "Request information" opened Accept as complete, and a row had no link to its case. The link carries `request_info`; the event name opens the case
  - A case went "Back to cases" whatever list it came from. `routes.city.case(id, { from })`: the four lists pass their own URL and the case names the list it returns to, filters included
  - Booking's back link went to a board an Instant Draft does not have. It goes to the wizard's plan step
  - A Draft whose board exists was sent back into the wizard from My events, and its board offered "Amend". It opens its board; the menu offers "Edit your plan" for a Draft, and "View permit" once there is one
  - A series' payment card in Quote sent opened a session schedule whose links checkout refuses. The quote's own payment goes to the quote; the schedule offers "Pay this session" only where checkout takes it (`canPaySession()`)
  - After a session or the final bill was paid, checkout fell through to "Nothing to pay here". It shows a toast and returns to the board
  - The permit's QR code held a path, not a URL, and nothing linked to the check. It holds the full URL, and "Open the verification page" links to it
  - The landing page's "Plan an event" landed on My events for anybody with an event. It is always the wizard
  - `state=closed` gave an empty pipeline unless "Closed and ended" was also on. Choosing that state shows those cases
  - A page opened under the wrong role (the Applicant on a city case link) offered a switch that dropped the link for the role's queue. The switch stays on a page the new role owns (`pageIsFor()` in `lib/view/shell.ts`)
- The demo guide had no way back: it has a back link to the landing page
- **`tests/render/handoffs.test.tsx` (new, 69 tests)** mounts the real layouts and pages by URL and follows every hand-off of the brief into the screen it lands on: the wizard's last step to checkout and the permit, or to the board; the board's cards to checkout in each mode; the permit to the public check; every queue row of all three roles to its panel; pipeline, Intake and Active permits rows, calendar items and map bookings to the case and back; the landing page's doors and all seven demo paths; "Book again next year"; and every role switch on every shared city page and between the Applicant and a city role on a case. Demo paths 3 and 4 are clicked from their first step to their last, through the board, My queue, Intake, the case, checkout and Active permits, with the role switcher between them
- **Consistency:** one `applicantNameOf()`; one `useIsNarrow`; one `BackLink`; `BillingBadge` and `TierLegend` in `components/domain` (each had been built twice); one set of phase names (`TASK_PHASE_LABEL`, `TASK_PHASES`) for the wizard's plan and the board's swimlanes; "Reviewers" as the one heading; the board's reviewers row through `ReviewStatusDot`; a session's date and "Skipped" mark the same in the wizard, on the board and on the permit; `Stat`, `Money`, `DateText` and `plural()` where a surface had its own; the system's label treatment on block labels; every screen's root at `gap-6`; the verify page's `<h1>`
- **Toasts:** every toast is a sentence. The board confirms what an applicant did ("Sent.", "Application submitted.", "Permit cancelled.") as checkout and the city's panels do
- **Contract change requests:** applied 3D's (the `lib/state` barrel exports `dueAtQuote`, `quoteBalance`, `quotePaid`, `lateFeeApplies`, `insideLeadTime`, and with them the checks `transition()` runs); declined 3E's (typing `sort`, `dir` and `closed` into `CasesFilters`: nothing links to a sorted pipeline, and `lib/routes.ts` must not import the pipeline's own types)
- `docs/readme.md`: "The screens (Phase 3)", with the case detail's action registry and how to override a panel for a role; nine new questions for the owner. The main plan: Phase 3 ticked, "12. What to look at"

**Why:**
- Seven builders built one surface each without seeing the others. Each surface's own tests stop at "the router was pushed to X"; nothing had rendered X. The demo's six paths cross surfaces at every step, so a link that lands on an empty sheet or "Nothing to pay here" breaks the walkthrough

**Files Modified:**
- `lib/view/shell.ts`, `lib/view/caseDetail.ts`, `lib/view/board.ts`, `lib/view/checkout.ts`, `lib/view/cityLists.ts`, `lib/view/landing.ts`, `lib/view/wizard.ts` and their tests
- `lib/routes.ts` (contract: `from` on `routes.city.case`), `lib/types.ts` (contract: `TASK_PHASE_LABEL`, `TASK_PHASES`), `lib/state/index.ts`, `lib/data/people.ts`
- `components/shell/useRoleSwitch.ts`, `components/shell/index.ts`, `components/shell/DemoMenu.tsx`, `components/ui/page-header.tsx`
- `components/domain/BillingBadge.tsx` (new), `components/domain/TierLegend.tsx` (new), `components/domain/index.ts`, `components/map/PermitopolisMap.tsx`
- `components/landing/{Hero,Nav,StaffInterlude,ClosingFooter,TodoBoard,DemoGuideScreen}.tsx`, `components/landing/hooks.ts`
- `components/wizard/{WizardScreen,ResultPanel,StepPlan,StepWhen}.tsx`
- `components/board/{BoardScreen,BoardColumns,BoardMenu,CardSheet,MyEventsScreen,SeriesScheduleSheet,VendorStackSheet}.tsx`
- `components/checkout/{CheckoutScreen,BookingPanel,QuotePanel,SessionPanel,FinalPanel,CardPaymentForm}.tsx`, `components/permit/{PermitScreen,PermitCard,SessionList,VerifyScreen}.tsx`
- `components/city/lists/{QueueScreen,CasesScreen,PipelineBoard,PipelineTable,IntakeScreen}.tsx`
- `components/case/{CaseDetailScreen,ActionSheet}.tsx`, `components/case/tabs/{OverviewTab,DocumentsTab,ConditionsFeesTab}.tsx`, `components/case/actions/generic/*` (imports from the barrel)
- `components/active/{ActiveScreen,ActiveListView,ActiveCalendarView,ActiveCloseoutView,RoleOverlay}.tsx`
- `tests/render/handoffs.test.tsx` (new), `tests/render/city-lists.test.tsx`
- `docs/readme.md`, `docs/log.md`, `docs/plans/2026-10-12-phase-3-integration.md` (new), `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Workstream 3A: the public landing page and the presenter's demo guide

**What Changed:**
- Replaced the `/` placeholder with the Clerk's Office landing page, a resident-facing page in the full Rime & Ink treatment with no shell: a floating glass nav; a hero whose live preview panel runs the real `classify()` and `estimateFees()` on a small form and never writes to the store; a scroll-thread "how it works" walkthrough; three tier cards and a comparison table read from the rules engine and the seed; a to-do-board block built from Jazz in the Plaza's own `TaskCard`s; fee and cancellation panels from `DEFAULT_CONFIG`; a dark "for city staff" interlude; an eight-item FAQ; and a closing call to action and footer
- Replaced the `/demo` placeholder with the demo guide: what the prototype is, the four roles, the demo date jumps, Reset behind a confirmation, the seven `DEMO_PATHS` as "Start this path" cards, the six-scenario jump table, and a "what is faked" list. It waits for `useHydrated()`, since everything on it writes to the store
- The two doors ("Plan an event", "City staff") are plain links that also set the role once the stored demo has been read
- Added `lib/view/landing.ts`: the hero form's mapping to `EventAnswers`, the tier-card and comparison rows, the fee and cancellation rows, the FAQ text and the demo path jumps, tested against the real seed
- `tests/render/smoke.test.tsx` asserted the placeholder's literal "Permitopolis" heading; it now checks for an `<h1>`

**Why:**
- Workstream 3A of Phase 3 (plan section 7): the page a resident would arrive on, with fees and lead times rendered from the same config the app uses so they cannot drift, and the page a presenter starts the demo from

**Files Modified:**
- `app/page.tsx`, `app/demo/page.tsx`
- `components/landing/LandingScreen.tsx`, `Nav.tsx`, `Hero.tsx`, `HeroPreviewPanel.tsx`, `HowItWorks.tsx`, `EventTiers.tsx`, `ComparisonTable.tsx`, `TodoBoard.tsx`, `FeesPanels.tsx`, `StaffInterlude.tsx`, `Faq.tsx`, `ClosingFooter.tsx`, `SectionHeading.tsx`, `DemoGuideScreen.tsx`, `hooks.ts`
- `lib/view/landing.ts`, `lib/view/landing.test.ts`
- `tests/render/landing.test.tsx`, `tests/render/smoke.test.tsx`

---

## 2026-10-12 - Workstream 3B: the applicant wizard

**What Changed:**
- Replaced the `/apply` placeholder with `WizardScreen`, a five-step wizard (What, Where, When, Size, Plan) rendered inside `AppShell`
- Added `components/wizard/**`: `WizardScreen.tsx` (URL and store orchestration), `ResultPanel.tsx` (the live classify, what-if, fee estimate and date-gate panel), `StepWhat.tsx`, `StepWhere.tsx`, `StepWhen.tsx`, `StepSize.tsx`, `StepPlan.tsx`, `DatePickerPopover.tsx` (a Rime & Ink-styled react-day-picker popover, no new dependency), `constants.ts` (event-type icons and blurbs)
- With no `case` the wizard holds its answers until the first edit, then creates the Draft and puts its id in the URL; with `?case=` it opens the Draft at its saved step. Every field change autosaves. A case that is no longer a Draft goes to its board; an unknown id shows `CaseNotFound`
- The result panel sits beside the steps from 1024 px and becomes a one-line bar with a bottom sheet below that; a tier change is highlighted and announced
- The last step's button: an Instant event goes to the quote route, where checkout books it; a Reviewed or Special event dispatches `create_board` and goes to its board
- Added `lib/view/wizard.ts`: step order, `buildResultPanel`, add-on effect copy, the date gate's "drop an add-on" and late-fee helpers, missing-field detection, and the plan's cards grouped by phase, with `lib/view/wizard.test.ts` against the real seed
- Added `tests/render/wizard.test.tsx`: unknown and non-draft cases, S2's reopened draft, a full click-through of demo path 2, a booked date and the three gate fixes

**Why:**
- Workstream 3B of Phase 3: the applicant's five-step event wizard and its live result panel, so an applicant can describe an event and reach the quote or their board

**Files Modified:**
- `app/apply/page.tsx`
- `components/wizard/WizardScreen.tsx`, `ResultPanel.tsx`, `StepWhat.tsx`, `StepWhere.tsx`, `StepWhen.tsx`, `StepSize.tsx`, `StepPlan.tsx`, `DatePickerPopover.tsx`, `constants.ts`
- `lib/view/wizard.ts`, `lib/view/wizard.test.ts`
- `tests/render/wizard.test.tsx`

---

## 2026-10-12 - Workstream 3C: My events and the applicant to-do board

**What Changed:**
- `app/events/page.tsx`, `app/events/[id]/page.tsx` - swapped the placeholder for `MyEventsScreen` and `BoardScreen`, kept the `<Suspense>`
- `components/board/MyEventsScreen.tsx`, `EventRow.tsx` - My events: sorted rows, a Past section, the empty state, "Plan an event"
- `components/board/BoardScreen.tsx` - the board's status strip (`CaseHeader`, the waiting-on chips and the reviewers row), the grouping toggle, the Draft-not-yet-planned and case-not-found states, and all URL state (`group`, `tab`, `card`)
- `components/board/BoardColumns.tsx` - the four columns, tabs below 768 px, the phase swimlanes, and whether a card opens its sheet or links straight out
- `components/board/CardSheet.tsx`, `CardForms.tsx` - the card detail sheet and its small forms per catalogue id
- `components/board/SeriesScheduleSheet.tsx`, `VendorStackSheet.tsx` - a series' payment schedule and the stacked vendor-permit cards, expanded
- `components/board/BoardMenu.tsx` - Withdraw, Cancel (with today's refund) and Amend
- `lib/view/board.ts` and `lib/view/board.test.ts` - pure view-models (My events ordering, next-action text, column and swimlane grouping, vendor stacking, reviewer wording, waiting-on chips, direct links, series sessions), tested against the real seed
- `tests/render/board.test.tsx` - render tests for scenarios S3 to S6, a withdrawn background case, My events for Maya Chen and for a new applicant, and the tab layout below 768 px

**Why:**
- Workstream 3C of Phase 3: the applicant's event list and to-do board, per `docs/spec/prd.md` "Applicant to-do board" and demo paths 3, 4 and 6

**Files Modified:**
- `app/events/page.tsx`
- `app/events/[id]/page.tsx`
- `components/board/BoardColumns.tsx`
- `components/board/BoardMenu.tsx`
- `components/board/BoardScreen.tsx`
- `components/board/CardForms.tsx`
- `components/board/CardSheet.tsx`
- `components/board/EventRow.tsx`
- `components/board/MyEventsScreen.tsx`
- `components/board/SeriesScheduleSheet.tsx`
- `components/board/VendorStackSheet.tsx`
- `lib/view/board.ts`
- `lib/view/board.test.ts`
- `tests/render/board.test.tsx`

---

## 2026-10-12 - Workstream 3D: quote, permit and public verification

**What Changed:**
- Built the checkout screen at `/events/[id]/quote` with four modes: BOOKING (an Instant Draft books and pays in one step), QUOTE (accept conditions, sign, then pay: the one place an applicant pays for a quote), SESSION (`?pay=session&date=`, one series session) and FINAL (`?pay=final`, the closeout bill), chosen by a pure `checkoutDecision()`. Every other state explains where the case stands and links elsewhere instead of offering a payment the engine would refuse
- Built the permit screen at `/events/[id]/permit`: a mobile-first card with the QR code (qrcode.react, for `/verify/[id]`), a map thumbnail, every session's date with its paid, due, upcoming or skipped mark, attendance, what the permit covers, conditions, the City Clerk's day-of contact and today's cancellation refund. "Download PDF" calls `window.print()`; a print stylesheet scopes printing to the card
- Built the public check at `/verify/[id]` (no shell, no role): a large Valid or Not valid with its reason, gated on `useHydrated()`
- Added `lib/view/checkout.ts` and `lib/view/permit.ts`, pure view-models tested against the real seed (mode decision, plan summary, fee previews, session rows, verify status)
- Added render tests covering demo paths 1 and 5 end to end, S3's not-ready quote, S1's permit facts, `/verify` for S1 and S5, an unknown case id and the city-role guard

**Why:**
- Workstream 3D of Phase 3: the applicant's one payment surface, the permit they carry, and the officer's public verification check (PRD "Quote, permit, amend and cancel"; demo paths 1, 3 and 5)

**Files Modified:**
- `app/events/[id]/quote/page.tsx` - renders `CheckoutScreen`
- `app/events/[id]/permit/page.tsx` - renders `PermitScreen`
- `app/verify/[id]/page.tsx` - renders `VerifyScreen`
- `components/checkout/CheckoutScreen.tsx`, `BookingPanel.tsx`, `QuotePanel.tsx`, `SessionPanel.tsx`, `FinalPanel.tsx`, `CardPaymentForm.tsx`, `SignatureForm.tsx`, `PlanSummaryCard.tsx` - new
- `components/permit/PermitScreen.tsx`, `PermitCard.tsx`, `SessionList.tsx`, `VerifyScreen.tsx`, `PermitPrintStyles.tsx` - new
- `lib/view/checkout.ts`, `lib/view/checkout.test.ts` - new
- `lib/view/permit.ts`, `lib/view/permit.test.ts` - new
- `tests/render/checkout.test.tsx`, `tests/render/permit.test.tsx` - new

---

## 2026-10-12 - Workstream 3E: city lists (My queue, Cases pipeline, Intake)

**What Changed:**
- Built `QueueScreen` (`/city/queue`): `queueFor()` grouped Overdue, Due this week and Later with a briefing line, a collapsed "Waiting on others" group, the triggers and review clock for the two reviewing departments, and a designed empty state
- Built `CasesScreen` (`/city/cases`): a Board (one column per pipeline state) and a sortable Table, switched by a `SegmentedControl`, with tier, state, waiting-on, event-date range, Involves me, Closed and ended, search and sort all kept in the URL; a result count, removable filter chips, "Clear filters" and a no-result empty state. A case that has ended shows its ending on its board card as well as in the table
- Built `IntakeScreen` (`/city/intake`): Special, Reviewed and Instant-exceptions tabs with counts; each row's completeness summary, competing-application note (through `rules.availability()`), lead-time flag, and Accept as complete and Request information actions taken from `availableActions()`
- Added `lib/view/cityLists.ts`, the pure view-model behind all three screens (queue grouping and briefing, pipeline filtering, sorting and URL parsing, intake completeness and the competing-application finder), with `lib/view/cityLists.test.ts` (43 tests against the real seed)
- Added `tests/render/city-lists.test.tsx` (15 tests) and small local helpers (`useRovingListNav`, `KeyboardFooter`, `PipelineBoard`, `PipelineTable`) under `components/city/lists/`
- Swapped the placeholder in `app/city/queue/page.tsx`, `app/city/cases/page.tsx` and `app/city/intake/page.tsx` for the new screens

**Why:**
- Workstream 3E of Phase 3: the city's list views, the part of the brief ("interaction design for complex data: density, filtering, status changes, history, and the empty, error and edge states") this surface exists to answer

**Files Modified:**
- `app/city/queue/page.tsx`
- `app/city/cases/page.tsx`
- `app/city/intake/page.tsx`
- `components/city/lists/QueueScreen.tsx`
- `components/city/lists/CasesScreen.tsx`
- `components/city/lists/IntakeScreen.tsx`
- `components/city/lists/PipelineBoard.tsx`
- `components/city/lists/PipelineTable.tsx`
- `components/city/lists/KeyboardFooter.tsx`
- `components/city/lists/useRovingListNav.ts`
- `lib/view/cityLists.ts`
- `lib/view/cityLists.test.ts`
- `tests/render/city-lists.test.tsx`

---

## 2026-10-12 - Workstream 3F: city case detail

**What Changed:**
- Built `/city/cases/[id]` for the three city roles inside `CityShell`: the header (stepper, hold, review clock), Who's up with the next-move sentence, five tabs (Overview, Reviews, Documents, Conditions and fees, Activity), and a sticky "Your actions" panel driven by `availableActions()`
- Added one small, complete action panel per action type a city role can take (`components/case/actions/generic/*`), registered by type in `components/case/actions/registry.ts`, with empty per-role override maps (`clerk.tsx`, `pws.tsx`, `hl.tsx`) for a later phase to fill in richer tools
- The open action or task lives in the URL as `?task=` (an action type, or `type:arg`), resolved by pure helpers in `lib/view/caseDetail.ts`, so Who's-up tasks, Documents cards, Reviews buttons and links from outside all open the right panel in a right-hand sheet
- Handled the edge states the brief calls out: an unknown id, a Draft (not visible to the city), an ended case (banner, only "Add a note"), a department not routed, empty tabs, long names, a 25-card vendor stack and a 22-session series (summarized, not listed), and an `aria-live` region for status changes

**Why:**
- Workstream 3F of Phase 3: the case detail is one of the two views the take-home brief singles out for depth, and it is what makes demo paths 3 through 6 clickable end to end for the City Clerk, Public Works & Safety and Health & Legal

**Files Modified:**
- `app/city/cases/[id]/page.tsx` - swapped the placeholder for `CaseDetailScreen`
- `components/case/CaseDetailScreen.tsx`, `ActionSheet.tsx`, `ActionsPanel.tsx`
- `components/case/tabs/{OverviewTab,ReviewsTab,DocumentsTab,ConditionsFeesTab,ActivityTab}.tsx`
- `components/case/actions/{types.ts,panelKit.tsx,registry.ts,clerk.tsx,pws.tsx,hl.tsx}` and `components/case/actions/generic/*` (17 panels and their index)
- `lib/view/caseDetail.ts` and `lib/view/caseDetail.test.ts`
- `tests/render/case-detail.test.tsx`

---

## 2026-10-12 - Workstream 3G: Active permits (list, calendar, map, closeout)

**What Changed:**
- Built `/city/active`, shared by the City Clerk, Public Works & Safety and Health & Legal: a Today strip, List, Calendar, Map and Closeout tabs, an "Include held dates" toggle, and an overlay for each role (work orders for Public Works & Safety, vendor health permits for Health & Legal, the day-of contact and a compliance-log placeholder for the Clerk)
- Added `lib/view/active.ts`, the pure view-model: which cases are active or held, a series collapsed to its next session ("+N more") or expanded to every session, the calendar and map items, the Today-strip headline, the Closeout tab's rows, month and week navigation, and each role's overlay per case and in total
- `app/city/active/page.tsx` now renders `ActiveScreen` in place of the placeholder

**Why:**
- Workstream 3G of Phase 3: the PRD's shared "Active permits" view (list, calendar, map, day-of and closeout) for all three city roles

**Files Modified:**
- `app/city/active/page.tsx`
- `lib/view/active.ts`, `lib/view/active.test.ts`
- `components/active/ActiveScreen.tsx`, `ActiveListView.tsx`, `ActiveCalendarView.tsx`, `ActiveMapView.tsx`, `ActiveCloseoutView.tsx`, `TodayStrip.tsx`, `RoleOverlay.tsx`
- `tests/render/active.test.tsx`

---

## 2026-10-12 - Phase 2 review fixes

**What Changed:**
- Fixed all 21 findings of the Phase 2 review (3 high, 14 medium, 4 low), each confirmed in the code first and each with a test that fails without the fix. Plan: `docs/plans/2026-10-12-phase-2-review-fixes.md`
- **Demo menu (high):** "Set demo date" opened the date picker and it closed at once, because the closing menu handed focus back to its trigger and the popover took that for a click away. The menu no longer hands focus back when it closes to open the picker. A shell test now goes Demo menu, Set demo date, Fri, Jun 18 and finds a permitted Jazz in the Plaza on Event day
- **Render harness (high):** the `next/navigation` mock is a live router. `router.push()`, `router.replace()` and a click on a `<Link>` move the mocked location, and `usePathname()`, `useSearchParams()` and `useParams()` re-render with it; `useRouter()` returns one stable object. New `navigate()`, `prepareScreen()`, `flushHydration()` and a `stored` option (a demo left in localStorage by an earlier visit)
- **Store hydration (high):** the stored demo is read on every route (a `StoreHydrator` in the root layout) and once per page load; nothing is written to localStorage before it has been read, so a role or persona set on a shell-less page can no longer save the in-memory seed over the presenter's demo
- **Hydration gate:** `useHydrated()` is one flag for the page load, so the second shell to mount shows no skeleton and reads nothing again; the top bar shows the wordmark and placeholders until the demo has been read (the prerendered page showed the seed's Applicant and May 3 on every reload)
- **Role switch:** two city roles keep the URL only on the pages they share (My queue, Cases, a case, Active permits). From another role's tool page the switch goes to the new role's last page, then its queue; `CityShell` shows "This screen is built for ..." on a tool page typed in under the wrong city role and does not remember it
- **Engine, applicant cards:** `complete_task` refuses cards finished some other way (pay, sign, sign-offs, submit, feedback, book again, a pinned request, meetings, carry permit) and says what finishes them; it refuses a city task
- **Engine, Who's up:** days holding counts from the last time the party's task became its to do, and from the day the application went in for a card nobody has touched (S4: 20 days, was 0); the Clerk's `consolidate` task is created locked at routing, so the Clerk reads "Waiting · Unlocks when every review is in" (was "Done for now"); `PartyStatus.nextTask` names the task a waiting party gets next; the Clerk's scope is always its role on the case
- **Engine, dates and clocks:** a scheduled meeting is due on the day it is set for; a review's allowance is the days from routing to the Clerk's due date (S5 "Day 30 of 35", S6 "Day 35 of 42"); a closed case releases its date hold
- **Engine, actions:** an ended case offers `add_note` and nothing else, and its board keeps only its Done cards; both `pay` rows go through the engine's own check; new `pay` rows for a closed case's final bill and a permitted series' next session; feedback can be given once
- **Engine, series:** on a session's day the clock marks it due; "Carry your permit" locks again after each session, dated for the next, and opens dated for the day
- **Engine, copy:** "Decided: approved with conditions." (was "approved with_conditions")
- **Seed:** each role's opening queue has one overdue row, the planned one (F1, F2, F3 and F5 are due in the coming week), and is asserted row by row; B16's nine past sessions are paid for and today's is due; city staff act on working days in every history (F7's damage report excepted); B11's verification is due after S5's
- **Demo script:** path 5's last step is the new applicant in the wizard (was the Clerk); every applicant step names its persona
- **Shared components:** `TaskCard` shows "Scheduled for ...", a locked card's date, "Changes requested" with who sent it back and why, an "Amendment" chip and "Done Apr 21"; `WhoIsUp` has a "Who's up" heading, the applicant's name, the waiting party's next task, and the parties that are up first; `DeptStatusDots` has a glyph per status and a keyboard-reachable tooltip; all on `/dev/kit`
- **Accessibility:** the role switcher is one tab stop with Left/Right/Home/End; below 640 px the top bar shows the demo date as "May 3"
- `docs/readme.md`: the page-ownership rule for city routes, hydration on shell-less pages, the live navigation mock, the engine notes above, and a new "Open questions for the owner" section (seven)

**Why:**
- The review ran against the merged Phase 2 tree, the one the seven Phase 3 screen builders start from. Three findings would have blocked them outright (the date picker, a harness that could not follow a URL change, a store that could lose the demo), and the rest would have been copied into every screen

**Files Modified:**
- `lib/state/checks.ts`, `core.ts`, `clock.ts`, `selectors.ts`, `availableActions.ts`, `waitingOn.ts`, `store.ts`, `index.ts`, `types.ts` (contract: `PartyStatus.nextTask`), `lib/state/transitions/{applicant,city,clerk,payment}.ts`
- `lib/state/seed/scenarios/{s5,s6,f1,f2,f3,f5}.ts`, `lib/state/seed/background/{b05-b09,b10-b16,b17-b21,b22-b25}.ts`
- `lib/view/shell.ts`, `lib/data/demoScript.ts`
- `components/shell/{TopBar,DemoMenu,CityShell,PlaceholderScreen}.tsx`, `components/shell/StoreHydrator.tsx` (new), `components/shell/index.ts`, `app/layout.tsx`
- `components/domain/{TaskCard,WhoIsUp,DeptStatusDots}.tsx`, `components/ui/segmented-control.tsx`, `components/kit/KitScreen.tsx`
- `tests/render/setup.ts`, `tests/render/harness.tsx`, `tests/render/harness.test.tsx` (new), `tests/render/{hydration,shell,blocks-seed,kit}.test.tsx`
- `tests/seed.test.ts`, `tests/demo-paths.test.ts`, `tests/engines.test.ts`
- `lib/state/{availableActions,clock,persist,waitingOn}.test.ts`, `lib/state/transitions/{applicant,city,clerk}.test.ts`, `lib/view/shell.test.ts`
- `components/domain/{TaskCard,WhoIsUp}.test.tsx`, `components/domain/DeptStatusDots.test.tsx` (new), `components/ui/segmented-control.test.tsx` (new)
- `docs/readme.md`, `docs/log.md`, `docs/plans/2026-10-12-phase-2-review-fixes.md` (new), `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Phase 2 merge: the seed, the shell and the shared components wired together

**What Changed:**
- Merged `phase2/seed`, `phase2/blocks` and `phase2/shell` into `build` (no conflicts; the gate passed on the merged tree before any change) and removed `tests/replay.ts`, the Phase 1 replay helper nothing imports any more
- The shell against the real seed: `tests/seed.test.ts` now checks every Demo menu jump (the case exists, in the state the PRD's seed table gives it, with the role, page and persona of the demo script's first step), the persona picker's seven entries and the date jumps; `tests/render/shell.test.tsx` runs on the 38 seeded cases (queue counts for all three roles, every jump, the persona picker, Reset)
- `lib/data/demoScript.ts`: each scenario jump carries its `caseId` and always a `personaId` (the case's applicant, also for the two city jumps); the "Set demo date" quick jumps moved here as `DEMO_DATE_JUMPS` and are formatted with `fmtDate`; the two block captain personas are spelled as the PRD spells them
- Role and persona switching (`lib/view/shell.ts`, `components/shell/useRoleSwitch.ts`): picking a persona navigates (a blank wizard for a new applicant, the wizard at its step for someone whose only event is a draft, My events otherwise); landing on the Applicant sets the persona of the case the page is about, also when returning to a remembered page; a Draft is not followed to a city role; two city roles keep the URL with its query string (nothing is pushed); a role's remembered page includes its query string (`components/shell/RememberPath.tsx`)
- Shell layout: `AppShell` and `CityShell` both put the screen inside the page container, so `PlaceholderScreen` and `CaseNotFound` no longer add `page-container` (inside the city layout they were wider than their column by the sidebar's width); `PlaceholderScreen` takes `standalone` for the two routes with no shell
- Demo menu: Reset goes to the Applicant's home afterwards (it resets the role, so a city page was left showing its "built for a city role" panel); the day picker marks the demo date as today, not the real date
- The shell uses the shared components where it had its own: `ConfirmDialog` for Reset, `PageHeader` on the placeholder and the 404 page, `PersonaAvatar` in the persona picker and mobile menu, `CountBadge` on My queue (read out as "My queue, 8 tasks to do"); sidebar links and the wordmark carry the system focus ring; Cases stays current on a case's own page
- Render harness (`tests/render/harness.tsx`): defaults to the real seed; new `scenario` option (a Demo menu jump); a query string in `path` becomes the search params; `params.id` is read off the path; returns a `user` session; new `storedCase(id)`; uses testing-library's `act`
- Shared components against the seed: new `tests/render/blocks-seed.test.tsx` renders the case components for all 38 seeded cases. `WhoIsUp` now lists every open action of a party with its own due date (it showed only the first; S5's applicant has two) and no longer reads the party name twice to a screen reader; `CaseHeader` accepts a Draft with no date; `TaskCard` and `WhoIsUp` take the due date from `taskDueDate()`; `PageHeader`'s back link is a `next/link`
- Contract changes applied: `StateApi` lists `boardColumns`, `whoIsUp`, `involvement`, `actorsFor`, `hasActivePermit`, `holdsDateAtQuote`, `activePermits` and `permitSessions`, with the `Involvement` and `PermitSession` types (`lib/state/types.ts`); `RulesApi.routing` takes an optional config; the Security and medical plan card follows the tier instead of a hardcoded 1,000, and its reason no longer quotes the number (`lib/rules/catalog.ts`); comments on `DateGate`, `involves`, `queueFor`, `dispatch` and six actions now say what the engine does; plan 5.4 lists the applicant as an actor for `simulate_signoff`
- Contract change declined: `DateGate.daysUntil` as `number | null` (it would break every caller for a state the wizard never shows; the comment now says it is 0 when no date is chosen)
- `docs/readme.md`: new section "Building a screen (Phase 2)"; the engine notes cover who may act, the seed and the open items
- Set the Dropbox ignore attribute on `node_modules` again; it was missing on the main tree

**Why:**
- The three workstreams were built apart: the shell against an empty seed, the shared components against hand-made fixtures, the seed without a screen. This is the first tree where they meet, and the seven screen builders of Phase 3 start from it

**Files Modified:**
- `lib/data/demoScript.ts`, `lib/data/people.ts`, `lib/view/shell.ts`, `lib/view/shell.test.ts`
- `components/shell/{AppShell,CityShell,CitySidebar,TopBar,DemoMenu,DemoDatePicker,PersonaPicker,MobileNavMenu,PlaceholderScreen,CaseNotFound}.tsx`, `components/shell/useRoleSwitch.ts`, `components/shell/index.ts`, `components/shell/RememberPath.tsx` (new)
- `app/not-found.tsx`, `app/demo/page.tsx`, `app/verify/[id]/page.tsx`
- `components/domain/{WhoIsUp,CaseHeader,TaskCard}.tsx`, `components/domain/WhoIsUp.test.tsx`, `components/ui/page-header.tsx`
- `lib/rules/catalog.ts`, `lib/rules/types.ts`, `lib/state/types.ts`, `lib/state/actions.ts` (contracts)
- `lib/state/index.ts`, `lib/state/selectors.ts`, `lib/state/waitingOn.ts`, `lib/rules/requirements.test.ts`
- `tests/render/harness.tsx`, `tests/render/shell.test.tsx`, `tests/render/blocks-seed.test.tsx` (new), `tests/seed.test.ts`, `tests/replay.ts` (removed)
- `docs/log.md`, `docs/readme.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Phase 2B: App shell and demo controls

**What Changed:**
- Added `components/shell/**`: `AppShell` and `CityShell` (sibling top-level shells sharing `TopBar`, `StorageBanner`, `SwitchRolePanel`, the hydration/skeleton gate and one `useRoleSwitch()` hook), `CitySidebar` (My queue with a live `queueFor()` count, Cases, Active permits, then the role's own tools), `RoleSwitcher`, `PersonaPicker`, `MobileNavMenu` (the <768px collapse, driven by `useIsNarrow()`'s real `matchMedia` check, not CSS alone), `DemoMenu` + `DemoDatePicker` (Reset with a confirming Dialog, Set demo date via a react-day-picker Popover with the PRD's 3 quick jumps, the S1-S6 scenario jumps, a hints toggle, a `/demo` link), `PlaceholderScreen`, `CaseNotFound`.
- Added `lib/view/shell.ts` + `shell.test.ts`: the pure `resolveRoleSwitch()` rule (two city roles keep the URL; Applicant <-> a city role follows a case on screen and sets its persona; otherwise the role's remembered path, then its home) plus `cityToolLinks`/`CITY_CORE_LINKS`.
- Added `lib/data/demoScript.ts`: `SCENARIO_JUMPS` (S1-S6) and `DEMO_PATHS` (the PRD's 7 demo-script paths as data) for the Demo menu, the later demo guide and demo hints.
- Added `app/apply/layout.tsx`, `app/events/layout.tsx`, `app/city/layout.tsx`, `app/not-found.tsx`, and 19 placeholder `page.tsx` files for every route not yet built, each rendering `PlaceholderScreen` inside the required `<Suspense>` boundary.
- Updated `tests/render/setup.ts` with a `next/navigation` + `next/link` mock (`navState`/`resetNavState`); added `tests/render/harness.tsx` (`renderScreen`, `lastPush`, `lastReplace`, `switchRole`) and `tests/render/shell.test.tsx` (11 tests).

**Why:**
- Phase 2, workstream 2B: every later screen needs a shell to mount inside, a role-switch rule that matches the PRD exactly, the demo controls (reset/date/scenario jumps/hints), and a shared render-test harness so later workstreams don't each reinvent next/navigation mocking.

**Files Modified:**
- `lib/view/shell.ts`, `lib/view/shell.test.ts`
- `lib/data/demoScript.ts`
- `components/shell/AppShell.tsx`, `CityShell.tsx`, `CitySidebar.tsx`, `TopBar.tsx`, `RoleSwitcher.tsx`, `PersonaPicker.tsx`, `MobileNavMenu.tsx`, `DemoMenu.tsx`, `DemoDatePicker.tsx`, `SwitchRolePanel.tsx`, `StorageBanner.tsx`, `PlaceholderScreen.tsx`, `CaseNotFound.tsx`, `useRoleSwitch.ts`, `useIsNarrow.ts`, `index.ts`
- `app/apply/layout.tsx`, `app/apply/page.tsx`
- `app/events/layout.tsx`, `app/events/page.tsx`, `app/events/[id]/page.tsx`, `app/events/[id]/quote/page.tsx`, `app/events/[id]/permit/page.tsx`, `app/events/[id]/amend/page.tsx`
- `app/verify/[id]/page.tsx`
- `app/demo/page.tsx`
- `app/city/layout.tsx`, `app/city/queue/page.tsx`, `app/city/cases/page.tsx`, `app/city/cases/[id]/page.tsx`, `app/city/active/page.tsx`, `app/city/intake/page.tsx`, `app/city/payments/page.tsx`, `app/city/settings/page.tsx`, `app/city/map/page.tsx`, `app/city/work-orders/page.tsx`, `app/city/verifications/page.tsx`, `app/city/inspections/page.tsx`
- `app/not-found.tsx`
- `tests/render/setup.ts`, `tests/render/harness.tsx`, `tests/render/shell.test.tsx`

---

## 2026-10-12 - Workstream 2D: shared building blocks and Phase 1 polish

**What Changed:**
- Phase 1 review fixes: PartyChip's party hue confined to its avatar tile (neutral chip surface, ink text); tier icon/label added next to the tier dot in MonthGrid, WeekGrid, DayStrip, PermitopolisMap (plus a new legend) and MapThumbnail; StateStepper's compact mode gained a visible current-state label and every marker an accessible name; the system focus ring added to every previously-unstyled raw button in LocationPicker's keyboard lists, the PermitopolisMap list, and the calendar day/item buttons; LocationPicker's area drag now uses pointer capture and ends on both pointerup and pointercancel.
- New `components/ui` primitives: PageHeader, Section, KeyValueList, ConfirmDialog, WizardStepper, FilterBar/FilterChip, CountBadge, Toolbar, Progress, InlineAlert, StickyAside, Truncate, CopyButton.
- New `components/domain` components: PersonaAvatar, TaskKindLabel, AvailabilityBadge, EndingBanner, EventTitle, LeadTimeRisk, DeptStatusDots, CaseHeader, ActivityTimeline, FeeTable, ConditionList, WhoIsUp, TaskCard, StackedTaskCard — all presentational, typed against the real `lib/types.ts`/`lib/state/types.ts` contracts, exported from `components/domain/index.ts`.
- `components/kit/KitScreen.tsx`: ten new sections demonstrating every component above in its interesting states, including a 101-character event name, an 80-character organization name, "Not provided" for missing fields, an overdue task and an ended (Denied) case.
- New tests: `components/domain/{PartyChip,StateStepper,FeeTable,ConditionList,WhoIsUp,TaskCard,ActivityTimeline}.test.tsx`, `components/ui/truncate.test.tsx`, and expanded `tests/render/{kit,map,location-picker}.test.tsx`.

**Why:**
- Seven builders build the city/applicant screens next in parallel; this gives them a complete, consistent shared vocabulary so they don't each invent cards, headers, fee tables and filter bars differently, and fixes the Phase 1 review findings scoped to this workstream (party-chip tinting, tier-by-dot-alone, unlabeled compact stepper, missing focus rings, and the area-drag pointer-capture bug).

**Files Modified:**
- `components/domain/PartyChip.tsx`, `components/domain/StateStepper.tsx`, `components/domain/index.ts`
- `components/calendar/MonthGrid.tsx`, `components/calendar/WeekGrid.tsx`, `components/calendar/DayStrip.tsx`
- `components/map/PermitopolisMap.tsx`, `components/map/MapThumbnail.tsx`, `components/map/LocationPicker.tsx`
- `components/kit/KitScreen.tsx`
- `components/ui/{page-header,section,key-value,confirm-dialog,wizard-stepper,filter-bar,count-badge,toolbar,progress,inline-alert,sticky-aside,truncate,copy-button}.tsx` (new)
- `components/domain/{PersonaAvatar,TaskKindLabel,AvailabilityBadge,EndingBanner,EventTitle,LeadTimeRisk,DeptStatusDots,CaseHeader,ActivityTimeline,FeeTable,ConditionList,WhoIsUp,TaskCard}.tsx` (new)
- `tests/render/kit.test.tsx`, `tests/render/map.test.tsx`, `tests/render/location-picker.test.tsx`
- `components/domain/{PartyChip,StateStepper,FeeTable,ConditionList,WhoIsUp,TaskCard,ActivityTimeline}.test.tsx`, `components/ui/truncate.test.tsx` (new)

---

## 2026-10-12 - Phase 2A: seed by replay, demo-path tests and engine hardening

**What Changed:**
- `lib/state/seed/replay.ts` (new): `replayScripts()` replays every seed script through the real engine, all cases interleaved in time order, with the clock advanced for every case between steps and on to the demo date. A refused step throws a `SeedReplayError` naming the script, the step and the reason.
- `lib/state/seed/index.ts`: `buildSeed()` returns all 38 cases as they stand on Mon, May 3, 2027. The replay runs once and each call gets a deep copy. `seedFingerprint()` is new.
- `lib/state/store.ts`: the demo is stored under the seed's fingerprint, so a demo saved by an earlier build is dropped on load. The storage key is unchanged.
- `tests/seed.test.ts` (new, 94 tests): the PRD seed table, the seven fillers, the background set, the stress rows and the reserved slots of plan 6.2.
- `tests/demo-paths.test.ts` (new, 8 tests): the PRD's seven demo paths through the store, with `reset()` checked against a fresh seed after each.
- Seed scripts B14, B18 and B19: pre-application meetings, community notices, later meetings and work orders added to their histories.
- Review finding (a): `transition()` rejects an action from a party that may not take it. `verify_document`, `reject_document`, `schedule_meeting` and `complete_city_task` also check the card's reviewer or owner.
- Review finding (b): `confirm_routing` refuses an empty or duplicated reviewer list.
- Review finding (c): `dateGate()` offers only the fixes that help, and reports no failure when there is no date yet.
- Review finding (d): every fee line, total and paid-in-full comparison is to the cent.
- Review finding (e): paying a quote in full clears the hold's expiry.
- Review finding (f): `waitingOn().openTasks` is oldest due first, and a department not yet routed reads Waiting.
- Review finding (g): `routing()` reads the block-party exception from the classification and the crowd threshold from the config.
- Review finding (h): plan 6.1's missing assertions added (S2, S4 and S6 lead times and reviewers; the late-fee case's exact fixes and amount).
- `amend` (for demo path 7): takes only the answers, runs the date gate again, charges the late fee, replaces the plan's fee lines and keeps lines a reviewer added.
- `nextMove()` names the waiting party whose task unlocks soonest. `availableActions()` offers Request information and the Clerk's own review.
- New selectors exported from `lib/state`: `boardColumns`, `whoIsUp`, `hasActivePermit`, `holdsDateAtQuote`, `activePermits`, `permitSessions`, `involvement`, `actorsFor`, `buildSeed`.
- `tests/replay.ts` is now a deprecated wrapper over `replayScripts()`.

**Why:**
- Workstream 2A of the build plan: the engine has to be proven on the seed and on all demo paths before any screen is built on it, and the Phase 1 review left eight engine findings open.
- The PRD's seed table said "then the Clerk reconciles" for S6 where the engine named the applicant; the engine was fixed, not the assertion.

**Files Modified:**
- `lib/state/seed/replay.ts`, `lib/state/seed/replay.test.ts`, `lib/state/actors.test.ts`, `lib/state/persist.test.ts`, `tests/seed.test.ts`, `tests/demo-paths.test.ts` (new)
- `lib/state/seed/index.ts`, `lib/state/seed/scripts.ts`, `lib/state/seed/helpers.ts`, `lib/state/seed/scripts.test.ts`, `lib/state/seed/background/b10-b16.ts`, `lib/state/seed/background/b17-b21.ts`
- `lib/state/checks.ts`, `lib/state/core.ts`, `lib/state/transition.ts`, `lib/state/transitions/applicant.ts`, `lib/state/transitions/city.ts`, `lib/state/transitions/clerk.ts`, `lib/state/transitions/payment.ts`
- `lib/state/waitingOn.ts`, `lib/state/selectors.ts`, `lib/state/availableActions.ts`, `lib/state/store.ts`, `lib/state/index.ts`
- `lib/state/waitingOn.test.ts`, `lib/state/selectors.test.ts`, `lib/state/availableActions.test.ts`, `lib/state/store.test.ts`, `lib/state/transitions/city.test.ts`, `lib/state/transitions/clerk.test.ts`, `lib/state/transitions/payment.test.ts`
- `lib/rules/routing.ts`, `lib/rules/classify.ts`, `lib/rules/dateGate.ts`, `lib/rules/index.ts`, `lib/rules/routing.test.ts`, `lib/rules/classify.test.ts`, `lib/rules/dateGate.test.ts`
- `tests/engines.test.ts`, `tests/replay.ts`

---

## 2026-10-12 - Phase 1 review fixes

**What Changed:**
- Who's up (S4): `submit` creates the Clerk's intake check locked (`payload.awaitingSignoffs`, no due date) while a block party's neighbor sign-offs are out; the last sign-off opens it. The Clerk reads "Waiting on 3 neighbor sign-offs" and S4 is no longer in its queue
- Date gate: `book_and_pay` and `submit` refuse a date inside the tier's lead time ("Needs 10 days of notice; pick a later date or add the late fee."). `updateDraft` takes `lateFee` and writes `flags.lateFee`; `create_board`, `book_and_pay` and `submit` then add the "Late fee" line, charged only while the date is inside the lead time. A series' late fee is due with its first session
- Series sessions: the store runs `syncDraft()` (sessions, then tier and triggers) on `createDraft` and every `updateDraft`, so a new weekly series is 13 sessions and $260 without the wizard listing dates; the slot check reads the sessions the schedule has now, not the stored list; "Book again" drafts are prepared the same way
- Verification: a card uploaded after its department has decided gets its own verify task (one per card, reopened by a second upload), through Permitted and Event day; `accept_complete` accepts answers to the Clerk's own intake requests
- Reviewer denial: `review_decide` deny finishes the department's review task and gives the Clerk a "Decide: a reviewer denied" task; `send_quote` names the department that denied
- Issue permit: re-uploading verified insurance locks an unlocked Issue permit again until it is re-verified (B11 loads with Health & Legal up and the Clerk waiting)
- Stale board: `book_and_pay` always rebuilds the board and fee lines from the answers; `create_board` takes the payment card from the new plan and re-locks Submit application when an edit added a card; `submit` checks the cards themselves
- Payments: a part payment of a quote leaves `pay_fees` open for the balance; `pay` refuses $0 or less, a final invoice outside Closeout or Closed, a session on a non-series, and booking or refund kinds
- Reviewed series quote: `dueAtQuote()` is the one-off lines plus the first session (F2: $2,120 of $5,320); it sets the pay card, unlocks Issue permit, stops the hold expiring, and paying it marks the first session paid. Follows the PRD's quote section; awaiting the owner's confirmation
- `useHydrated()` starts false on the server and the client alike, so a skeleton-until-hydrated page no longer mismatches
- Review clock: stops on the day the department decides; a second request keeps the first pause's start. Left as days elapsed (not 1-based), so the due date reads "Day 14 of 14"
- `LocationPicker` reads its selection from `value` and emits the tab's own selection on a tab switch; an unchosen area is shown as a dashed suggestion with "No area chosen yet"
- Tertiary text replaced with `fg-secondary` or `fg-label` in ten places, the chip suffix is no longer dimmed, and `tests/guards.test.ts` fails on `text-fg-tertiary` outside a placeholder
- Fees: every space booked is billed (Fields 1 and 2 for six hours is $240), the kind read from the inventory
- `request_info` refuses an unknown card ("Card not found.") and a department that has already decided
- `withdraw` after a payment records the refund; `reconcile_close` gives an Instant exception with a charge a final-bill card (F7's $95)
- Seed scripts: B03 to Fri, May 28, B04 to Sat, Jun 5, B16 booked Feb 18 and B19 submitted Jan 4 (all were inside their lead times); B05 to Thu, May 13 so the overdue Public Works & Safety review is also at lead-time risk; `newCase()` writes "Started a draft.", which is B01's one activity entry
- Contract changes: `DemoActions.updateDraft` takes `lateFee?: boolean` (`lib/state/types.ts`); comments in `lib/rules/catalog.ts` on the intake, verify, consolidate and Issue permit tasks now say what the engine does
- Tests: 61 new (381 in all). `tests/replay.ts` replays seed scripts through both engines for `tests/engines.test.ts`, which now checks that all 38 scripts replay with no refused step; new render tests for the picker and for hydration

**Why:**
- The Phase 1 review found 3 high and 15 medium defects where the engine disagreed with the PRD's transitions table, seed table or quote section, or left a case with nobody up. Fixing them before Phase 2 means the seed replay and the first screens are built on the behavior the PRD describes

**Files Modified:**
- `lib/state/{checks,core,clock,newCase,selectors,store,waitingOn,availableActions,index}.ts`, `lib/state/transitions/{applicant,city,clerk,payment,shared}.ts` and their tests
- `lib/state/types.ts`, `lib/rules/catalog.ts` (contracts: one additive field, comments)
- `lib/rules/fees.ts`, `lib/rules/fees.test.ts`
- `lib/state/seed/background/{b01-b04,b05-b09,b10-b16,b17-b21}.ts`
- `components/map/LocationPicker.tsx`
- `components/domain/{HoldStatus,StateStepper,WaitingOnChips,PartyChip}.tsx`, `components/ui/{file-drop,table,dropdown-menu,command}.tsx`, `components/calendar/DayStrip.tsx`, `components/kit/KitScreen.tsx`
- `tests/engines.test.ts`, `tests/guards.test.ts`, `tests/replay.ts` (new), `tests/render/{location-picker,hydration}.test.tsx` (new)
- `docs/log.md`, `docs/readme.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Phase 1 merge: the rules engine and the state machine wired together

**What Changed:**
- Merged `phase1/rules`, `phase1/state`, `phase1/scripts`, `phase1/design` and `phase1/map` into `build` (no conflicts) and ran the gate on the merged tree
- Merge fixes: the map's "Undo last segment" button used a `Button` variant the restyle removed (`outline`, now `secondary`); ESLint now ignores `.claude/`, where the agent worktrees and their `.next` output live
- Rules: a case with an ending (cancelled, denied, withdrawn, hold expired) no longer books its slot, so a cancelled permit frees its date; a session a series skips for a blackout neither books the slot nor counts as the next session for a cancellation
- State, where it calls the rules engine: `create_board` now lists the sessions with `occurrences()` (a blackout session is skipped, so it is not billed or held); `book_and_pay` and `accept_complete` check every held session over the setup-to-teardown window; `book_and_pay` pays the first held session and leaves skipped ones skipped; `cancel` never refunds more than was paid
- State, found by running both engines together: the Clerk's `issue_permit` and `reconcile` tasks are finished by the action that does them; `reconcile` unlocks when hours are logged; verifying insurance last unlocks `issue_permit`; issuing a permit clears the hold's pay-by date; "Carry your permit" is done once the last session has passed; a request for information parks the asker's own review (or intake check) until the applicant answers, so "Who's up" shows only the applicant; `caseTotals()` treats the deposit as settled after reconciliation and an ended case as owing nothing
- Drafts keep their tier: `classifyDraft()` runs on `createDraft`, `updateDraft` and the draft "Book again" spawns
- The "Next:" sentence names the applicant when given a name, says who re-reviews, and words command-titled tasks properly ("issues the permit"); activity entries format money, dates and party names through `lib/format.ts`
- Contract changes: `StateApi.nextMove` gained an optional `applicantName`; the comments on `Closeout.balance` and `Closeout.refund` now say what `reconcile_close` stores. Declined: a `pickable` flag on `Persona` (the picker list is read off `scenario` in `lib/data/people.ts` instead)
- Seed scripts corrected against the real engines: payments now equal the engine's totals (B11, B14, B17, B18, B19, B20); Special events complete their site and accessibility plans (B14, B18, B19); F4's quote is still on hold on the demo date; B10 and B05 moved off slots held by F6 and F2; B20's overage now exceeds its deposit; S6's history includes the meetings, community notice, food permits and work orders the PRD's board shows as done
- Tests: `tests/engines.test.ts` runs the two engines together with nothing mocked (S1 booking and cancel, the S2 series, first complete application wins, S6 from permit to Closed with $750 over and $250 refunded); `lib/state/seed/scripts.test.ts` now checks every task id against the catalogue and every PRD slot against every background case

**Why:**
- The five workstreams were built in separate worktrees, each against stubs or mocks of the others. This is the first tree where they meet, and the place to fix what none of them could see alone

**Files Modified:**
- `eslint.config.mjs`, `components/map/LocationPicker.tsx`
- `lib/rules/availability.ts`, `lib/rules/cancellation.ts` and their tests
- `lib/state/{checks,clock,core,index,newCase,selectors,store,waitingOn}.ts`, `lib/state/transitions/{applicant,city,clerk,payment}.ts` and their tests
- `lib/state/types.ts`, `lib/types.ts` (contract)
- `lib/data/people.ts`
- `lib/state/seed/scenarios/{f4,s6}.ts`, `lib/state/seed/background/{b05-b09,b10-b16,b17-b21}.ts`, `lib/state/seed/scripts.test.ts`
- `tests/engines.test.ts` (new)
- `docs/log.md`, `docs/readme.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Permitopolis map and calendar (workstream 2C)

**What Changed:**
- Added `lib/data/mapGeometry.ts`: the fictional city as SVG geometry in a 1200 by 800 viewBox (one shape per `lib/data/inventory.ts` space id, one path per `lib/data/streets.ts` segment id), scaled 1 SVG unit to 1 ft so the full City Hall Plaza rectangle is exactly 20,000 sq ft and the full Great Lawn rectangle is exactly 40,000 sq ft
- Added `lib/view/map.ts` and `lib/view/map.test.ts` (38 tests): pure helpers `rectToSquareFeet`, `capacityForArea`, `clampRectToArea`, `isConnectedRoute`, `canAppendSegment`, `routeMiles`, `mergeStreetLabel`, and `buildInventoryLocation`, `buildAreaLocation`, `buildStreetsLocation`, `buildRouteLocation`
- Added `components/map/LocationPicker.tsx`: four mode tabs (bookable spaces, draw an area, street segments, draw a route), starting mode driven by `eventType`, a keyboard-operable list beside the map (number inputs for area mode), mirrored by clickable SVG shapes
- Added `components/map/PermitopolisMap.tsx`, `MapThumbnail.tsx`, `CityBackground.tsx`, `geometry.ts` and `types.ts`: tier-colored, status-styled, labeled highlights with overlap detection, built on the shared city background
- Added `components/calendar/{MonthGrid,WeekGrid,DayStrip}.tsx`, `types.ts`, `utils.ts`, `tierStyles.ts`, `index.ts`: three calendar views over a shared `CalendarItem` type, marking blackout and impacted days and today
- Added `app/dev/map/page.tsx` and `components/map/MapDevScreen.tsx`, the visual checkpoint for this workstream, and `tests/render/map.test.tsx`

**Why:**
- Workstream 2C of the plan, built a phase early because it depends only on Phase 0: the map and calendar primitives the wizard, Active permits and the closures map build on

**Files Modified:**
- `lib/data/mapGeometry.ts`
- `lib/view/map.ts`, `lib/view/map.test.ts`
- `components/map/LocationPicker.tsx`, `PermitopolisMap.tsx`, `MapThumbnail.tsx`, `CityBackground.tsx`, `geometry.ts`, `types.ts`, `index.ts`, `MapDevScreen.tsx`
- `components/calendar/MonthGrid.tsx`, `WeekGrid.tsx`, `DayStrip.tsx`, `types.ts`, `utils.ts`, `tierStyles.ts`, `index.ts`
- `app/dev/map/page.tsx`
- `tests/render/map.test.tsx`

---

## 2026-10-12 - Rime & Ink design system (workstream 1D)

**What Changed:**
- Restyled every shadcn component in `components/ui` (button, input, textarea, select, checkbox, switch, radio-group, label, tabs, dialog, sheet, dropdown-menu, popover, tooltip, accordion, table, sonner, badge, skeleton, scroll-area, separator, command, input-group) to Rime & Ink tokens and removed all dark-mode variants (the app is light only)
- Added new primitives: `components/ui/panel.tsx`, `chip.tsx`, `eyebrow.tsx`, `kbd.tsx`, `banner.tsx`, `callout.tsx`, `empty-state.tsx`, `segmented-control.tsx`, `field.tsx`, `file-drop.tsx`, `page-skeleton.tsx`, `stat.tsx`
- Added domain components: `components/domain/icons.ts` (party, tier, task-kind, case-state and ending icon maps) and `TierBadge`, `PartyChip`, `PartyAvatar`, `StateChip`, `StateStepper`, `WaitingOnChips`, `ReviewStatusDot`, `DueDate`, `Money`, `DateText`, `CaseId`, `HoldStatus`, `ReviewClock`, exported from `components/domain/index.ts`
- Added page chrome to `app/globals.css`: `.page-atmosphere` (stacked gradients, masked 56px grid, fractal-noise grain), `.app-ground` (quieter grid, no grain), the `.page-container` utility, and keyframes for material settle, idle float, surface sweep, breathing selection and caret blink
- Added `lib/contrast.ts` (alpha-blend-aware WCAG contrast math) and `lib/contrast.test.ts`, which parses `styles/tokens.css` directly and checks every required text and surface pair reaches 4.5:1
- Added `components/kit/KitScreen.tsx` and `app/dev/kit/page.tsx`, the Phase 1 visual checkpoint, and `tests/render/kit.test.tsx`
- Added two tokens to `styles/tokens.css`: `--grain-image` and `--grid-opacity-app` (nothing renamed or removed)

**Why:**
- Workstream 1D of the plan: the shared design system every later surface imports, with the token set proven to meet AA contrast before anyone builds on it

**Files Modified:**
- `app/globals.css`, `styles/tokens.css`
- `components/ui/*.tsx` (restyled, plus 12 new files)
- `components/domain/*.tsx`, `components/domain/icons.ts`, `components/domain/index.ts`
- `components/kit/KitScreen.tsx`, `app/dev/kit/page.tsx`
- `lib/contrast.ts`, `lib/contrast.test.ts`
- `tests/render/kit.test.tsx`

---

## 2026-10-12 - Seed scripts, personas and templates (workstream 1C)

**What Changed:**
- Added `lib/data/people.ts`: 39 personas (the six scenario personas and "new" for the picker, plus 32 that only appear in city lists) and `CITY_STAFF`, one named contact per department
- Added `lib/data/templates.ts`: `REVIEW_SECTIONS`, `CONDITION_TEMPLATES` (8 to 12 per department) and `REQUEST_TEMPLATES` by department
- Added `lib/state/seed/helpers.ts`: location, schedule, step and file builders used by every script
- Added `lib/state/seed/scenarios/{s1..s6,f1..f7,index}.ts` (the 13 PRD cases) and `lib/state/seed/background/{b01-b04,b05-b09,b10-b16,b17-b21,b22-b25,index}.ts` (the 25 background cases), each a set of wizard answers plus a dated list of actions
- Added `lib/state/seed/scripts.ts`, which exports `SEED_SCRIPTS`
- Added `lib/state/seed/scripts.test.ts`: static checks on ids and keys, date order and the cutoff, reference data, the PRD's weekdays, the background counts in plan section 6.2, every stress row, and the reserved slots

**Why:**
- Workstream 1C of the plan: the seed as pure, replayable scripts, which workstream 2A turns into the 38-case demo seed by running them through the real engines

**Files Modified:**
- `lib/data/people.ts`, `lib/data/templates.ts`
- `lib/state/seed/helpers.ts`
- `lib/state/seed/scenarios/s1.ts` to `s6.ts`, `f1.ts` to `f7.ts`, `index.ts`
- `lib/state/seed/background/b01-b04.ts`, `b05-b09.ts`, `b10-b16.ts`, `b17-b21.ts`, `b22-b25.ts`, `index.ts`
- `lib/state/seed/scripts.ts`, `lib/state/seed/scripts.test.ts`

---

## 2026-10-12 - State machine and store (workstream 1B)

**What Changed:**
- Implemented every function of `StateApi` (`lib/state/index.ts`): transitions split by actor across `lib/state/transitions/{applicant,clerk,city,payment,shared}.ts`, dispatched by `lib/state/transition.ts`
- Added `lib/state/core.ts` (task and activity helpers, unlocking by event), `lib/state/checks.ts` (precondition checks shared by `transition()` and `availableActions()`, so a disabled action gives the reason a dispatch would), `lib/state/clock.ts` (session dates, `computeNow`, `applyTick`, `advanceClock`), `lib/state/selectors.ts`, `lib/state/waitingOn.ts` (`waitingOn`, `nextMove`, `isStalled`), `lib/state/availableActions.ts` and `lib/state/newCase.ts`
- Added the persisted Zustand store in `lib/state/store.ts` (`useDemo`, `useHydrated`, `demoToday`, `resetDemoStoreForTests`), with guarded storage, safe for node tests and server rendering
- Added `lib/state/testSupport.ts` (`makeCase`, `makeTask`, `makeCtx`) and a test file next to every module: one test per row of the PRD's transitions table, a failing-precondition test with its reason for every guarded action, the S3 to S6 chains, the clock (hold expiry, event day, Closeout, an Instant event closing itself and its cleanup exception, a weekly series returning to Permitted), `waitingOn`, and the store's `dispatch`, `reset` and `setDemoToday`

**Why:**
- Workstream 1B of the plan: the one place every change to a case goes through, so the board, the queues and the case detail read case state instead of working it out again

**Files Modified:**
- `lib/state/index.ts`, `core.ts`, `checks.ts`, `clock.ts`, `newCase.ts`, `selectors.ts`, `waitingOn.ts`, `availableActions.ts`, `transition.ts`, `store.ts`, `testSupport.ts`
- `lib/state/transitions/applicant.ts`, `clerk.ts`, `city.ts`, `payment.ts`, `shared.ts`
- `lib/state/*.test.ts`, `lib/state/transitions/*.test.ts`

---

## 2026-10-12 - Rules engine (workstream 1A)

**What Changed:**
- Added `lib/rules/classify.ts` (`classify`, `whatIf`, `isBlockPartyException`), `routing.ts` (`routing`, `buildRouting`), `requirements.ts` (`requirements`, `permitComponents`), `fees.ts` (`estimateFees`), `availability.ts` (`availability`, `occurrences`), `dateGate.ts`, `cancellation.ts` (`cancellationRefund`), `timeline.ts` (`planTimeline`), `closeout.ts` (`closeoutCards`, `capacityWarning`), `shared.ts` (`occupiedWindow`, `locationsOverlap`, `dueDate` and internal helpers) and `test-helpers.ts` (fixture builders for the tests)
- Rewrote `lib/rules/index.ts` to export them, keeping the `satisfies RulesApi` check
- Added a test file next to each module, covering every row and boundary of plan section 6.1: the S1 to S6 tiers, reviewers and fee totals ($125, $260, $715, $510, $6,530, $9,645), the attendance and capacity boundaries, demo path 2, the block-party exception and its fireworks case, the S1 amendment's lead-time gate, the $62.50 cancellation refund, booked, impacted and blackout dates, and S3's exact card list

**Why:**
- Workstream 1A of the plan: every rule as a pure function over `lib/rules/config.ts`, `lib/data/` and the card catalogue, so no screen ever works out a tier, a fee or a requirement itself

**Files Modified:**
- `lib/rules/classify.ts`, `routing.ts`, `requirements.ts`, `fees.ts`, `availability.ts`, `dateGate.ts`, `cancellation.ts`, `timeline.ts`, `closeout.ts`, `shared.ts`, `test-helpers.ts`, `index.ts`
- `lib/rules/*.test.ts` (one per module)

---

## 2026-10-12 - Phase 0: scaffold, contracts and reference data

**What Changed:**
- Scaffolded Next.js 16.4 with Tailwind v4 and shadcn/ui (Radix), installed every dependency, and set up Vitest with a node project and a jsdom project
- Wrote the frozen contracts: domain types, the Action union, the rules and state API interfaces with stub barrels, the rules config, routes, date and format helpers
- Wrote the reference data (spaces, streets, calendar, fees) and the Rime & Ink tokens, and pointed shadcn's variables at them
- Added lint guards (no real clock, no randomness, no browser dialogs, no direct localStorage) and guard tests (no raw colors, no imports between surfaces)
- Converted the PRD, flows document and scenarios sheet into `docs/spec/`
- Filled in `CLAUDE.md` with the project overview and build rules for agents; wrote `README.md` and `docs/readme.md`
- Recorded in the plan that the build runs through Phase 6 without visual checkpoints, with no deploy and with jsdom render tests instead of Playwright

**Why:**
- Phase 0 of the plan: every later workstream builds against these files in parallel

**Files Modified:**
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`, `components.json`, `.gitignore`, `AGENTS.md`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `styles/tokens.css`, `components/ui/*` (shadcn)
- `lib/types.ts`, `lib/routes.ts`, `lib/format.ts`, `lib/dates.ts`, `lib/utils.ts`
- `lib/rules/{types,config,index}.ts`, `lib/state/{actions,types,index,storage}.ts`, `lib/state/seed/index.ts`
- `lib/data/{inventory,streets,calendar,fees}.ts`
- `tests/guards.test.ts`, `tests/render/{setup.ts,smoke.test.tsx}`, `lib/**/*.test.ts`
- `docs/spec/*`, `docs/readme.md`, `README.md`, `CLAUDE.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Implementation plan for the Permitopolis prototype

**What Changed:**
- Created the phased, multi-agent implementation plan: seven phases, file ownership per workstream, shared contracts (types, rules and state signatures, action list), acceptance tables and the workflow shape for each phase
- Recorded the decisions that go beyond the PRD: public landing page at `/`, 25 background seed cases (38 in total), one workflow per phase, Rime & Ink replacing the PRD's look and feel, and ten seed-data fixes

**Why:**
- Requested plan for building the landing page and the applicant and city web app from the PRD, decision tree, design system and demo scenarios, structured so several agents can work in parallel

**Files Modified:**
- `docs/plans/2026-10-12-permitopolis-prototype.md` - new plan

---

## 2026-10-12 - Project scaffolded

**What Changed:**
- Created the project folder with CLAUDE.md, README.md, and the docs/ layout

**Why:**
- New project created from DashCode

**Files Modified:**
- `CLAUDE.md`
- `README.md`
- `docs/readme.md`
- `docs/log.md`

---

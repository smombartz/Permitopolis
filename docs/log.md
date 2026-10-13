# Change log

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

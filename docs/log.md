# Change log

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

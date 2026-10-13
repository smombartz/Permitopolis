# Permitopolis Events Permitting Prototype: Implementation Plan

> **For agentic workers:** this plan runs as one orchestrated workflow per phase (section 9), not task by task. A builder receives one workstream brief from section 8 and must also read sections 2, 4 and 5. You own only the paths named in your brief. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable, front-end-only prototype of the Permitopolis City Clerk's event permitting site: a public landing page, an applicant wizard and to-do board, and queue, pipeline and case views for the City Clerk, Public Works & Safety and Health & Legal, seeded with 38 cases on a fixed demo date.

**Architecture:** One `EventCase` record per event lives in a single client-side Zustand store. Pure functions in `lib/rules` derive tier, reviewers, cards and fees; pure functions in `lib/state` apply every change through one `transition()`. Screens are thin views over that store and integrate with each other only through routes and store actions, which is what lets several agents build them at once.

**Tech stack:** Next.js (latest stable, App Router, TypeScript), Tailwind CSS v4, shadcn/ui (Radix), lucide-react, Zustand with `persist`, date-fns, react-day-picker, qrcode.react, Vitest, pnpm. Deploy target is Vercel.

**Spec:** `docs/spec/prd.md`, `docs/spec/flows.md`, `docs/spec/scenarios.json` and `docs/spec/img/` (converted in Phase 0 from the `.docx` and `.xlsx` files in `docs/`), plus `docs/rime-and-ink-design-system.md`. Where this plan and the PRD disagree, section 3 says which wins and why.

---

## 1. Summary

Seven phases. Phase 0 is done inline by the orchestrating session; every later phase is one workflow of parallel builders, a merge and an automated gate. Phases run back to back through Phase 6 (see 3.1); the "Stop point" column now names what each gate proves, and you look at the UI once, at the end.

| Phase | Builds | Builders in parallel | Demo paths | Stop point |
|---|---|---|---|---|
| 0 Bootstrap and contracts | Scaffold, spec conversion, types, action list, rules config, reference data, tokens, guards | none (inline) | none | You review three contract files |
| 1 Engine and design system | Rules engine, state machine and store, scenario scripts, Rime & Ink primitives, SVG map and calendar | 5 | none | Kit page, map |
| 2 Skeleton | Seed replay (38 cases), app shell and demo controls | 2 | 1 to 6 pass as store-level tests | Shell |
| 3 P0 surfaces | Landing, wizard, board, quote and permit, city lists, case detail, active permits | 7 | 1 to 4 clickable | First full walkthrough |
| 4 Role tools and money | Clerk hand-offs, Clerk money and closeout, reviewer panel, verification, after-event, edge states | 6 | 5 and 6 clickable | **P0 complete** |
| 5 P1 depth | Amendment, payments, closures map, work orders, verifications page, hints, accessibility pass | 5, then 1 | 7 | P1 complete |
| 6 P2 and ship | Settings, day-of tools, inspections, deploy | 3 | none | Submission |

- **About 40 agent runs in total**, never more than 9 in one workflow. Builders run on Sonnet; contracts, merges and reviews run on the session model.
- **Phase 4 is the complete P0 demo.** Phases 5 and 6 add the P1 and P2 work on top of it.
- **Depth is concentrated on the two views the brief requires:** the cases list (workstream 3E) and the case detail (3F), each with an explicit matrix of empty, error and edge states (4F).

---

## 2. Global constraints

Every workstream's requirements include this section.

- Front-end only. No server code, no environment variables, no backend, auth, email or real payments.
- All state lives in one Zustand store persisted to localStorage under the key `permitopolis-demo-v1`. Every storage access is wrapped in try/catch so the app works when storage is blocked.
- The demo date defaults to `2027-05-03`. Never call `new Date()` with no arguments or `Date.now()` in `app/`, `components/` or `lib/`; use `demoToday()`. An ESLint rule enforces this.
- Rules and state transitions are pure functions in `lib/`, covered by tests. Components call them and never re-implement them.
- Tier thresholds, lead times and fees live in `lib/rules/config.ts` and `lib/data/`, never in component code.
- Every state change goes through `transition(case, action, actor, ctx)`, which checks preconditions, updates tasks and writes an activity entry.
- Copy is plain language. Dates read like "Sat, Jun 26, 2027"; money reads like "$1,240". Use `fmtDate` and `fmtMoney` from `lib/format.ts`.
- No `window.confirm` or `alert`. Confirmations use the Dialog component.
- City screens work from 1280 px wide. Applicant screens and the landing page work down to 375 px.
- WCAG 2.2 AA: keyboard reachable, visible focus, status changes announced through `aria-live`. Color always comes with an icon and a label.
- Visual style comes from Rime & Ink tokens only. No raw hex values in `app/` or `components/`; a guard test enforces this.
- Uploads keep only file name, size and type. Every upload has a "Use sample file" button.
- Payments and signatures are simulated forms that always succeed, with a test card prefilled.
- No map tiles or geocoding. Permitopolis is drawn as SVG.
- English only. Denials are final.
- **Verification (from `CLAUDE.md`):** no agent starts a dev server, drives a browser or takes screenshots. Agents verify with type-check, lint, tests and build. You check how things look.
- **Logging (from `CLAUDE.md`):** every change gets a `docs/log.md` entry. A builder in a worktree does not edit `docs/log.md`; it returns its entry and the integrator writes all entries at merge, newest first. This avoids every builder editing the top of the same file.
- No builder adds a dependency. All packages are installed in Phase 0; a builder that needs another one reports it instead.

---

## 3. Decisions beyond the sources

### 3.1 Your answers (Oct 12, 2026)

| Question | Decision |
|---|---|
| Landing page | A public, resident-facing Clerk's Office site at `/` in the full Rime & Ink marketing layout. The demo guide moves to `/demo` and the Demo menu. |
| Seed data | The PRD's 13 cases plus 25 background cases, 38 in total, covering every state and off-path ending plus stress rows. |
| Agent runner | One workflow per phase: parallel builders in isolated git worktrees, then merge and gate. |
| How far to build | Through Phase 6 without stopping. The per-phase visual checkpoints are dropped; there is one hand-off at the end with a list of screens to look at. |
| Deploy | None. The prototype stays on the `build` branch on this machine. |
| Runtime check | Render tests in Vitest with jsdom: every page mounted against the seed for each role. No dev server, no browser. Playwright is dropped. |

### 3.2 Rime & Ink replaces the PRD's "Look and feel"

You asked for the design system document to set the visual style, so it overrides the PRD's "white surfaces, Public Sans, one blue accent". The mapping:

| PRD asks for | Rime & Ink answer |
|---|---|
| Public Sans | System SF stack for text. IBM Plex Mono for case IDs, dates and money in tables, timestamps in activity logs, and keyboard hints. |
| One blue accent | Indigo is the only action color: indigo 650 buttons, indigo 500 hover, focus and selection. |
| Party colors (slate, blue, amber, teal) | Identity tints confined to a small avatar tile and a chip's leading dot, always with icon and label: Applicant ink 650, City Clerk indigo 500, Public Works & Safety amber `#d88a1d`, Health & Legal teal `#0f9f9a`. Chip text stays ink. |
| Tier badges (green, blue, purple) | Outline micro-badges with the name spelled out: Instant success green, Reviewed indigo, Special event aubergine `#7c4d8f`. |
| Status | Rime & Ink semantics: success for approved, done and valid; warning for Needs info and due soon; danger for overdue, denied and not valid. |

Three places where the plan bends or tightens the design system, each worth a look at the Phase 1 kit page:

- **Identity tints bend "one action color".** Teal and amber are atmosphere and rating colors in Rime & Ink. Here they also mark two parties. They never mark an action, and they appear only on avatars and dots.
- **Tertiary text fails AA.** Measured against the page and glass surfaces, tertiary text (`#4350668f`) is 2.6 to 2.7:1 and teal as text is 2.9 to 3.2:1; secondary text is 4.9 to 5.1:1 and passes. The app therefore uses tertiary only for placeholders and decoration, and adds one token, `fg-label` (ink 650 solid, 7.3:1 or better), for form labels, table headers and metadata. A contrast test in workstream 1D checks every allowed text and surface pair.
- **Quiet glass in the app.** The landing page gets the full treatment: grid, grain, radial atmosphere, idle float, surface sweep and the scroll thread. App screens keep the frost ground and a fainter grid. Backdrop blur is used on chrome only (top bar, sidebar, sheets, dialogs); repeated rows and cards use plain surface fills, because dozens of blurred cards on a pipeline board will stutter. App motion is limited to interaction feedback, sheet and dialog entrances, and the tier-change highlight. Reduced motion is honored everywhere.

### 3.3 Seed-data fixes

Every weekday, session count and fee total in the PRD was recomputed and is correct. These conflicts were found and are resolved as follows:

| Finding | Resolution |
|---|---|
| Riverside Farmers Market (Great Lawn, 17 Saturdays from Jun 5) and Movie Night on the Lawn (Great Lawn, Sat, Jun 12) are both In review, so both hold the same space and date. | Availability compares time windows, which the "Impacted 6 to 11:30 am" rule already needs. Market runs 8 am to 1 pm; Movie Night runs 7 to 10:30 pm with setup from 5 pm. |
| Oak Avenue is not in the PRD's map inventory. | Add Oak Avenue, 100 and 200 blocks, residential. |
| Little League Opening Day (Instant, Fields 1 and 2) and Company picnic (Instant, Shelter 4) would classify as Reviewed at 100 or more people. | Seed 90 and 80 people. |
| S5's meetings are Mon, Jun 21 and Fri, Jul 2, but "21 days before" is Sun, Jun 20 and "7 days before" is Sun, Jul 4. No single rounding rule gives both. | The catalogue's defaults are the deadline for scheduling. The seeded dates are explicit `scheduledFor` values set by the Clerk in the case history. Builders must not "correct" them. |
| The card catalogue says "Carry your permit" is created when Permitted, but S3's board shows it in Coming up while In review. | All applicant cards are created when the plan is confirmed, locked with `unlocksOn`. The catalogue's "Created when" column is the condition for including the card. This matches the PRD's goal of showing the whole journey on day one. |
| S3's board must show exactly one card in Do now, yet the catalogue has both "Vendor health permit" and "Respond to a request". | A request can target an existing card: it pins that card with the reviewer's message and its own due date. A new "Respond to a request" card is created only when the request targets nothing. S3's pinned card is the Rolling Dumpling Co. health permit card. |
| S4 closes a street, which would create a Traffic control plan card the PRD's S4 board does not list. | The block-party exception replaces the traffic control plan with the City services request (barricades). |
| S5 is in Quote sent while Health & Legal still has an insurance check open. | A verification is a Task owned by Health & Legal, separate from the Review decision. Quote sent requires every Review approved; Issue permit requires the insurance task done. |
| S6 has 25 food vendors, which means 25 health-permit cards in Done. | The board stacks repeated per-vendor cards into one card with progress ("Vendor health permits, 25 of 25") that expands in its detail sheet. |
| S2's Jul 11 session at Field 4 shows Impacted, though Field 4 is not one of the three places the 5K closes. | An impacted date warns for the listed places and for places reached through them (Riverside Park is reached by River Road). Impacted is always a warning, never a block. |

Case IDs follow the wireframes: S3 is `PMT-27-0118` and S5 is `PMT-27-0097`. The rest are assigned in submission order by the seed, with S2's draft taking `PMT-27-0142`.

### 3.4 Open questions, with the placeholder this build uses

| Open question in the PRD | Placeholder |
|---|---|
| Date hold length | 14 days after the quote is sent. A hold does not expire during review. |
| Late fee floor | 25% of fees excluding the deposit, always offered. `config.lateFee.minDaysBeforeEvent` is 0 and can be raised. |
| Do applicants see reviewers' notes? | No. Reviewers write a separate message to the applicant. |
| Send to commission | A flag and a banner only. |
| Free cancellation within 24 hours | No. |
| Organizer names for S2 to S6 | The PRD's placeholders. |

### 3.5 Needs your confirmation before Phase 0

1. **One Event-day case on the seed date.** Covering every status at load means one case is on Event day on Mon, May 3 (a Monday tai chi series session at Field 3). The PRD's Today strip example reads "no events today"; that empty state stays reachable by changing the demo date.
2. **Editing `CLAUDE.md`.** Phase 0 fills its empty Project Overview and Key Features sections and adds a short "Build rules for agents" section. Every subagent has `CLAUDE.md` injected, so this is the cheapest way to brief all of them.
3. **Commits.** Worktree builders must commit on their own branches for the merge to work. Approving this plan authorizes commits on a `build` branch and its phase branches. Nothing is pushed; the repo has no remote.
4. **Browser tests.** The PRD's Playwright smoke test (P1) drives a browser, which `CLAUDE.md` reserves for you. The demo script is instead tested at the store level in Vitest. Playwright stays in Phase 6 and runs only if you say so.
5. **Deploys.** The PRD wants a Vercel preview per milestone. A deploy publishes the work, so each one waits for your go-ahead at a gate.

All five were confirmed on Oct 12, 2026. Items 4 and 5 were then settled: no Playwright run and no deploy (see 3.1).

---

## 4. File structure and ownership

Two builders never own the same path in the same phase. The bracket shows the workstream that creates each path.

```
app/
  layout.tsx  globals.css             [0, then 1D for globals.css and 2B for layout]
  page.tsx                            landing                              [3A]
  demo/page.tsx                       demo guide                           [3A]
  apply/                              wizard, ?step=what|where|when|size|plan  [3B]
  events/page.tsx                     my events                            [3C]
  events/[id]/page.tsx                board                                [3C]
  events/[id]/quote/  permit/         quote, booking, permit               [3D]
  events/[id]/amend/                  amendment                            [5A]
  verify/[id]/                        public permit check                  [3D]
  city/layout.tsx                     city shell with sidebar              [2B]
  city/queue/  cases/page.tsx  intake/    lists                            [3E]
  city/cases/[id]/                    case detail                          [3F]
  city/active/                        active permits                       [3G]
  city/payments/                      [5B]     city/settings/              [6A]
  city/map/  work-orders/             [5C]     city/verifications/         [5D]
  city/inspections/                   [6B]
  dev/kit/  dev/map/                  visual checkpoints, not linked       [1D, 2C]
lib/
  types.ts  routes.ts  format.ts      contracts, frozen after Phase 0      [0]
  rules/config.ts                     thresholds, lead times, fees         [0]
  rules/                              classify, routing, requirements, fees, availability, dateGate, cancellation, timeline  [1A]
  state/actions.ts                    the Action union, frozen             [0]
  state/                              transitions, waitingOn, availableActions, clock, store, selectors  [1B]
  state/seed/scenarios/  background/  scripts as data                      [1C]
  state/seed/index.ts  replay.ts      seed by replay                       [2A]
  data/inventory.ts streets.ts calendar.ts fees.ts   reference data        [0]
  data/people.ts templates.ts         personas, condition and request templates  [1C]
  data/mapGeometry.ts                 SVG coordinates                      [2C]
  view/<surface>.ts                   pure view-models, one file per surface, tested  [owner of the surface]
styles/tokens.css                     Rime & Ink tokens                    [0, then 1D]
components/
  ui/                                 Rime & Ink primitives over shadcn    [1D]
  domain/                             TierBadge, PartyChip, StateChip, StateStepper, WaitingOnChips, DueDate, Money, DateText, CaseId, HoldStatus, ReviewClock  [1D]
  shell/                              top bar, role switcher, persona picker, Demo menu, sidebar  [2B]
  map/  calendar/                     [2C]
  landing/ [3A]  wizard/ [3B]  board/ [3C]  checkout/ permit/ [3D]
  city/lists/ [3E]  case/ [3F]  active/ [3G]
  case/actions/generic.tsx            default action panels                [3F]
  case/actions/clerk.tsx pws.tsx hl.tsx   rich role panels; stubs in 3F, owned by 4A to 4D
tests/
  guards.test.ts                      no raw hex, no window.confirm        [0]
  seed.test.ts  demo-paths.test.ts    [2A]
  action-coverage.test.ts             every Action type has a control      [4F]
  render/<surface>.test.tsx           each page mounted against the seed for each role  [owner of the surface]
  render/harness.tsx                  seeded store and next/navigation mocks  [2B]
docs/spec/                            prd.md flows.md scenarios.json img/  [0]
```

**The integration rule.** A surface imports from `lib/`, `components/ui`, `components/domain`, `components/map` and `components/calendar` only. It never imports another surface's components. Surfaces hand off to each other through `lib/routes.ts` and store actions. For example, the wizard's "Book and pay $125" navigates to `/events/[id]/quote`, which 3D renders in booking mode; the wizard does not import a payment form.

---

## 5. Contracts

Phase 0 writes these as real TypeScript. The files are frozen afterwards: a builder that needs a change returns a change request, and the orchestrator decides.

### 5.1 Domain types (`lib/types.ts`)

```ts
export type ISODate = string;       // '2027-05-03'
export type ISODateTime = string;   // '2027-04-30T14:10'
export type HHmm = string;          // '18:00'

export type Tier = 'instant' | 'reviewed' | 'special';
export type Party = 'applicant' | 'clerk' | 'pws' | 'hl';
export type Dept = 'clerk' | 'pws' | 'hl';
export type Actor = Party | 'system' | 'neighbor';
export type CaseState = 'draft' | 'submitted' | 'in_review' | 'needs_info' | 'quote_sent'
  | 'permitted' | 'event_day' | 'closeout' | 'closed';
export type Ending = 'withdrawn' | 'denied' | 'cancelled' | 'hold_expired';
export type EventType = 'picnic_party' | 'performance_rally' | 'market_festival'
  | 'race_parade' | 'block_party' | 'class_meetup';

export type TriggerId =
  | 'street' | 'route' | 'attendance_1000' | 'fireworks_drones' | 'heavy_resources'
  | 'plaza_open_area' | 'attendance_100' | 'amplified_sound' | 'alcohol' | 'food_vending'
  | 'tents_stages' | 'cooking_generators' | 'admission' | 'city_services' | 'block_party';
export interface Trigger { id: TriggerId; raisesTo: Tier; label: string }

export interface Location {
  mode: 'inventory' | 'area' | 'streets' | 'route';
  inventoryIds: string[];                              // 'shelter-3', 'field-4'
  areaId?: 'city-hall-plaza' | 'great-lawn';
  areaRect?: { x: number; y: number; w: number; h: number };   // SVG viewBox units
  segmentIds: string[];                                // ordered for a route
  capacity?: number; squareFeet?: number; miles?: number;
  label: string;                                       // 'Shelter 3, Riverside Park'
}
export interface Availability {
  status: 'open' | 'impacted' | 'booked' | 'blackout';
  reason?: string; nextOpen?: ISODate[];
}
export interface Occurrence {
  date: ISODate; availability: Availability;
  billing: 'upcoming' | 'due' | 'paid' | 'skipped';
}
export interface Schedule {
  date: ISODate; start: HHmm; end: HHmm; setupStart?: HHmm; teardownEnd?: HHmm;
  recurrence?: { frequency: 'weekly' | 'biweekly'; weekday: number; until: ISODate };
  occurrences: Occurrence[];                           // one entry for a single event
}
export interface AddOns {
  amplifiedSound: boolean; alcohol: boolean;
  foodVending: { vendors: number } | null;
  tentsStages: { count: number } | null;
  cookingGenerators: boolean; fireworksDrones: boolean; admission: boolean;
  cityServices: { barricades: number; trash: boolean; power: boolean;
                  policeOfficers: number; policeHours: number } | null;
}
export interface EventAnswers {                        // what the wizard collects
  eventType: EventType | null; name: string; description?: string;
  location: Location | null; schedule: Schedule | null;
  attendance: number | null; addOns: AddOns;
}

export interface Review {
  dept: Dept; sections: string[];
  status: 'not_routed' | 'pending' | 'approved' | 'approved_with_conditions' | 'needs_info' | 'denied';
  dueDate: ISODate | null;
  clock: { startedOn: ISODate | null; pausedSince: ISODate | null; pausedDays: number; allowedDays: number };
  internalNote: string; messageToApplicant: string;
}
export type TaskKind = 'document' | 'form' | 'action' | 'payment' | 'sign_off'
  | 'meeting' | 'review' | 'inspection';
export type TaskStatus = 'locked' | 'todo' | 'submitted' | 'changes_requested' | 'done';
export type Phase = 'before_submitting' | 'review' | 'permit' | 'before_event' | 'event_day' | 'after';
export type UnlockEvent = 'presubmit_done' | 'submitted' | 'accepted' | 'quote_sent' | 'paid'
  | 'permitted' | 'event_day' | 'closeout' | 'hours_logged' | 'invoice_issued' | 'closed';
export interface Task {
  id: string; catalogId: string; owner: Party; kind: TaskKind;
  title: string; why: string; reviewer: Dept | null;
  dueDate: ISODate | null; status: TaskStatus; unlocksOn: UnlockEvent | null; phase: Phase;
  request?: { from: Dept; message: string; at: ISODateTime; dueDate: ISODate; resolved: boolean };
  payload: Record<string, unknown>;                    // files, form values, progress, scheduledFor, amount
  history: { at: ISODateTime; actor: Actor; status: TaskStatus; note?: string }[];
  tags: ('amendment')[];
}
export interface FeeLine {
  id: string; dept: Dept; label: string; qty: number; unit: string; unitPrice: number;
  estimate: number; actual: number | null; kind: 'fee' | 'deposit' | 'late_fee';
}
export interface Condition { id: string; dept: Dept; text: string; mergedByClerk: boolean; acceptedByApplicant: boolean }
export interface DateHold { status: 'none' | 'held' | 'expired' | 'released'; placedOn: ISODate | null; expiresOn: ISODate | null }
export interface Payment {
  id: string; at: ISODateTime; amount: number; method: 'card' | 'in_person';
  kind: 'booking' | 'quote' | 'session' | 'final_invoice' | 'refund'; occurrenceDate?: ISODate;
}
export interface Activity { at: ISODateTime; actor: Actor; text: string }
export interface Permit { issuedOn: ISODate; signature: string | null }

export interface EventCase extends EventAnswers {
  id: string;                                          // 'PMT-27-0118'
  applicantId: string; tier: Tier; triggers: Trigger[];
  state: CaseState; ending: Ending | null; endingReason?: string;
  dateHold: DateHold; reviews: Review[]; tasks: Task[]; conditions: Condition[];
  feeLines: FeeLine[]; payments: Payment[]; activity: Activity[]; permit: Permit | null;
  flags: { sentToCommission: boolean; lateFee: boolean; accepted: boolean };
  wizardStep: 'what' | 'where' | 'when' | 'size' | 'plan';
  createdAt: ISODateTime; submittedAt: ISODateTime | null;
}
```

### 5.2 Rules (`lib/rules`)

```ts
export interface RulesCtx { today: ISODate; cases: EventCase[]; cfg: RulesConfig }

classify(a: EventAnswers, cfg?: RulesConfig): Classification
// { tier, triggers, blockPartyException, leadTimeDays, reviewers: RoutingSuggestion[],
//   components: PermitComponent[], summary: string }
whatIf(a: EventAnswers, cfg?: RulesConfig): { triggerId: TriggerId; tier: Tier; text: string }[]
routing(a: EventAnswers, cls: Classification, cfg?: RulesConfig): { dept: Dept; reasons: string[]; sections: string[] }[]
requirements(a: EventAnswers, cls: Classification, today: ISODate): Task[]      // applicant cards only
estimateFees(a: EventAnswers, cls: Classification, cfg?: RulesConfig): FeeEstimate
// { lines: FeeLine[], fees: number, deposit: number, total: number, perSession?: number, sessions?: number }
availability(loc: Location, win: { date: ISODate; start: HHmm; end: HHmm }, ctx: RulesCtx, ignoreCaseId?: string): Availability
occurrences(s: Schedule, loc: Location, ctx: RulesCtx): Occurrence[]
dateGate(a: EventAnswers, cls: Classification, ctx: RulesCtx): DateGate
// { availability, daysUntil, leadTimeOk, earliestDate, fixes: ('new_date' | 'drop_addon' | 'late_fee')[], droppable: TriggerId[] }
cancellationRefund(c: EventCase, today: ISODate): { refund: number; kept: number; rule: string }
planTimeline(a: EventAnswers, cls: Classification, today: ISODate): { key: string; label: string; date: ISODate }[]
```

- `whatIf` returns one entry for each trigger whose removal alone lowers the tier, computed by re-running `classify` without it.
- `requirements` returns applicant cards. City tasks are created inside `transition()`.
- A slot is taken when another case has `dateHold.status === 'held'` or is in Permitted, Event day or Closeout, and its location overlaps and its setup-to-teardown window overlaps.

### 5.3 State (`lib/state`)

```ts
transition(c: EventCase, action: Action, actor: Actor, ctx: RulesCtx):
  { ok: true; case: EventCase } | { ok: false; reason: string }
availableActions(c: EventCase, role: Party, ctx: RulesCtx):
  { type: Action['type']; label: string; enabled: boolean; reason?: string; primary?: boolean }[]
waitingOn(c: EventCase, today: ISODate): PartyStatus[]       // always four rows: applicant, clerk, pws, hl
// PartyStatus { party, status: 'up_now' | 'done_for_now' | 'waiting' | 'not_involved',
//               openTasks: Task[], oldestDue: ISODate | null, daysHolding: number, note: string,
//               scope: string, nextTask?: Task }   // nextTask: the locked task a waiting party gets next
nextMove(c: EventCase, today: ISODate, applicantName?: string): string
// 'Next: Downtown Arts Collective uploads ..., then Health & Legal re-reviews.' Without a name: 'The applicant'.
boardColumn(t: Task): 'do_now' | 'with_city' | 'coming_up' | 'done'
boardColumns(c: EventCase): Record<BoardColumn, Task[]>      // the applicant's cards by column, Do now in the PRD's order; an ended case keeps only Done
whoIsUp(c: EventCase, today: ISODate): Party[]               // the parties that are up now
involvement(c: EventCase, party: Party): 'active' | 'awaiting_routing' | 'none'
actorsFor(type: Action['type']): Actor[]                     // who may raise an action; transition() refuses anyone else
hasActivePermit(c: EventCase): boolean                       // Permitted, Event day or Closeout, and not ended
holdsDateAtQuote(c: EventCase): boolean                      // Quote sent and holding its date
activePermits(cases: EventCase[], today: ISODate, options?: { includeHolds?: boolean }): EventCase[]
permitSessions(cases: EventCase[], options?: { from?; to?; includeHolds? }): { case: EventCase; date: ISODate }[]
advanceClock(cases: EventCase[], from: ISODate, to: ISODate, cfg: RulesConfig): EventCase[]
buildSeed(): EventCase[]                                     // lib/state/seed, deterministic
demoToday(): ISODate
useDemo: {                                                   // Zustand, persisted, skipHydration
  cases: EventCase[]; demoToday: ISODate; role: Party; personaId: string; hints: boolean;
  lastPathByRole: Record<Party, string>;
  dispatch(caseId: string, action: Action, actor?: Actor): { ok: boolean; reason?: string };
  createDraft(applicantId: string, answers?: Partial<EventAnswers>): string;
  updateDraft(caseId: string, patch: Partial<EventAnswers> & { wizardStep?; lateFee?: boolean }): void;
  setRole(r: Party): void; setPersona(id: string): void; setDemoToday(d: ISODate): void;
  toggleHints(): void; reset(): void;
}
useHydrated(): boolean                                       // gate rendering until localStorage is read
```

`transition()` is payload-driven and does not derive rules. The Clerk's routing panel calls `routing()` to prefill, and the confirmed list travels in the action's payload. The same holds for quote lines. The one rule call inside `transition()` is `availability()`, for "the first complete application wins".

### 5.4 Actions (`lib/state/actions.ts`)

| `type` | Actor | Payload | Effect |
|---|---|---|---|
| `create_board` | applicant | none | Stores tier and triggers, generates cards from `requirements()` |
| `book_and_pay` | applicant | `method` | Instant only. Draft to Permitted, hold placed on payment, permit issued |
| `complete_task` | applicant | `taskId, files?, form?` | Card to submitted when a reviewer must check it, else done |
| `simulate_signoff` | neighbor, applicant | none | Neighbor sign-off progress plus one; card done at 12 of 12. The applicant may raise it too: the demo button sits on the block captain's own card and the store dispatches as the current role |
| `submit` | applicant | none | Draft to Submitted; creates the Clerk's intake task |
| `accept_complete` | clerk | none | Places the date hold if the slot is free; creates the routing task. Block parties need every sign-off |
| `confirm_routing` | clerk | `reviewers: { dept, sections, dueDate }[]` | Submitted to In review; creates review tasks, starts clocks |
| `request_info` | clerk, pws, hl | `taskId?, message, dueDate` | To Needs info; pins or creates the applicant card; pauses that clock |
| `respond_to_request` | applicant | `taskId, files?, message?` | Card to submitted; re-review task for the asker; back to In review when no request is open |
| `verify_document` | clerk, pws, hl | `taskId` | Applicant card to done |
| `reject_document` | clerk, pws, hl | `taskId, reason` | Card to changes requested |
| `review_decide` | clerk, pws, hl | `decision, conditions, feeLines, internalNote?, message?` | Sets the department's Review |
| `send_to_commission` | clerk | none | Sets the flag |
| `send_quote` | clerk | `conditions, feeLines` | In review to Quote sent; hold expiry set; unlocks sign and pay |
| `deny` | clerk | `reason` | Ending Denied; hold released |
| `accept_and_sign` | applicant | `signature, conditionIds` | Marks conditions accepted |
| `pay` | applicant, clerk | `amount, method, occurrenceDate?` | Records a payment; the Clerk uses it for in-person payments |
| `issue_permit` | clerk | none | Quote sent to Permitted. Needs signed, paid and insurance verified; creates work-order tasks |
| `schedule_meeting` | clerk, pws | `taskId, date` | Sets `scheduledFor` |
| `log_closeout` | pws | `cleanup, notes?, actuals: { feeLineId, qty }[], extraLines?` | Fills actuals; creates the Clerk's reconciliation task |
| `reconcile_close` | clerk | none | Closeout to Closed; final invoice or refund; unlocks the applicant's last cards |
| `withdraw`, `cancel` | applicant | none | Ending Withdrawn before a permit, Cancelled after, with the refund recorded |
| `submit_feedback`, `book_again` | applicant | `form?` | `book_again` clones the record as a Draft on the same weekday a year later |
| `add_note`, `remind` | clerk, pws, hl | `text` | Activity entry only |
| `amend` | applicant | `answers` | P1. Re-classifies the same record; adds cards tagged `amendment` |
| `tick` | system | none | Raised by `advanceClock`: hold expiry, Event day, Closeout, Instant straight to Closed |

### 5.5 Component names surfaces may rely on

- `components/ui`: `Button`, `Panel`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `SegmentedControl`, `Tabs`, `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip`, `Accordion`, `Toast`, `Table`, `Chip`, `Eyebrow`, `Kbd`, `Banner`, `Callout`, `EmptyState`, `Skeleton`, `FileDrop`.
- `components/domain`: `TierBadge`, `PartyChip`, `PartyAvatar`, `StateChip`, `StateStepper`, `WaitingOnChips`, `ReviewStatusDot`, `DueDate`, `Money`, `DateText`, `CaseId`, `HoldStatus`, `ReviewClock`.
- `components/map`: `LocationPicker` (four mode tabs, map and keyboard list; `value: Location | null`, `onChange`), `PermitopolisMap` (display: highlights for a set of cases on a date range), `MapThumbnail`.
- `components/calendar`: `MonthGrid`, `WeekGrid`, `DayStrip`.
- Added in Phase 2 (workstream 2D). `components/ui`: `PageHeader`, `Section`, `KeyValueList`, `ConfirmDialog`, `WizardStepper`, `FilterBar`, `FilterChip`, `CountBadge`, `Toolbar`, `Progress`, `InlineAlert`, `StickyAside`, `Truncate`, `CopyButton`. `components/domain`: `PersonaAvatar`, `TaskKindLabel`, `AvailabilityBadge`, `EndingBanner`, `EventTitle`, `LeadTimeRisk`, `DeptStatusDots`, `CaseHeader`, `ActivityTimeline`, `FeeTable`, `ConditionList`, `WhoIsUp`, `TaskCard`, `StackedTaskCard`.
- `components/shell` (workstream 2B): `AppShell`, `CityShell`, `PlaceholderScreen`, `CaseNotFound`, `useRoleSwitch`, `usePersonaSwitch`.
- Added in Phase 3 (integration). `components/domain`: `BillingBadge`, `TierLegend`. `components/ui/page-header`: `BackLink`. `components/shell`: `useIsNarrow`. `lib/types.ts`: `TASK_PHASE_LABEL`, `TASK_PHASES`. `lib/data/people.ts`: `applicantNameOf(c)`. `lib/routes.ts`: `routes.city.case(id, { task, tab, from })`, where `task` is a task id or an action key and `from` is the list to go back to. `@/lib/state` also exports `dueAtQuote`, `quoteBalance`, `quotePaid`, `lateFeeApplies`, `insideLeadTime` and the `check*` functions `transition()` runs.

---

## 6. Acceptance tables

### 6.1 Rules engine

| Case | Key answers | Tier | Lead time | Reviewers | Fees |
|---|---|---|---|---|---|
| S1 | Picnic, Shelter 3, Sat, May 22, 11 am to 4 pm, 45 people | Instant | 10 | none | $125 |
| S2 | Class, Field 4, Sundays Jun 6 to Aug 29, 8 to 9 am, 20 people | Instant | 10 | none | $20 a session, 13 sessions, $260 |
| S3 | Performance, City Hall Plaza area, Fri, Jun 18, 6 to 9 pm, 150, sound, 1 vendor | Reviewed | 30 | pws, hl | 50 + 300 + 40 + 75 + 250 = $715 |
| S4 | Block party, Maple 400 block, Sat, Jun 26, 2 to 8 pm, 120, 4 barricades | Reviewed by exception | 30 | pws, hl | 50 + 150 + 60 + 250 = $510 |
| S5 | Race, 3.1-mile route, Sun, Jul 11, 7 to 11 am, 1,200, sound, 8 officers for 5 hours, 40 barricades | Special | 60 | clerk, pws, hl | 250 + 1,240 + 40 + 3,400 + 600 + 1,000 = $6,530 |
| S6 | Festival, Main Street 1st to 4th (3 blocks), Sat, Apr 24, noon to 9 pm, 3,000, 25 vendors, alcohol, 1 stage, 66 officer-hours, 20 barricades | Special | 60 | clerk, pws, hl | $9,645 |

Further cases that must pass:

- Boundaries: 99 and 100 people; 249 and 250 at a block party; 999 and 1,000; 40 and 41 people at Shelter 2 (capacity 40).
- Demo path 2 in one test: Shelter 2 with 40 people is Instant; alcohol on is Reviewed and `whatIf` offers the way back; two Main Street blocks is Special; 1,200 people with no street is still Special.
- A block party with fireworks is Special: the exception removes only the street trigger.
- S1 with amplified sound on May 3: Reviewed, 19 days left of 30, so the gate offers a new date, dropping sound, or the late fee.
- Cancelling S1 on May 3 refunds $62.50.
- S6 closeout: 72 officer-hours and 4 crew-hours come to $750 over; $250 of the $1,000 deposit is refunded.
- Shelter 3 on May 22 is Booked. City Hall Plaza and Field 4 on Jul 11 are Impacted. All parks on May 31 are Blackout. The S5 route's segments sum to exactly 3.1 miles.

### 6.2 Seed on Mon, May 3, 2027

The table "Seed data" in `docs/spec/prd.md` is the contract for the six scenarios and seven fillers. Dates the seed states explicitly:

| Case | Dates in the history |
|---|---|
| S3 | Submitted Fri, Apr 16; hold placed Mon, Apr 19; insurance verified Wed, Apr 21; Public Works & Safety approved with three conditions Wed, Apr 28; vendor list accepted and health permit requested Fri, Apr 30; response due Wed, May 5; clock paused since Apr 30 |
| S4 | 9 of 12 sign-offs; no hold |
| S5 | Quote sent and insurance certificate uploaded Fri, Apr 30; pay by Fri, May 14; verification due Fri, May 7; coordination meeting Mon, Jun 21; walkthrough Fri, Jul 2 |
| S6 | Event Sat, Apr 24; closeout opened Sun, Apr 25; cleanup check and hours due Fri, May 7; $9,645 paid |

Board assertions: S3 shows exactly 1 card in Do now, 0 With the city, 3 Coming up and 4 Done. For the other scenarios, every card the PRD names is in the column it names.

**Background cases (25).** Exact counts by state:

| State or ending | Count | Must include |
|---|---|---|
| Draft | 2 | One with only a name; one complete but failing the date gate |
| Submitted | 2 | One missing insurance and six days old at intake |
| In review | 3 | One overdue Public Works & Safety review (lead-time risk red); one flagged Sent to commission |
| Needs info | 2 | One where the applicant is overdue; one asked by the Clerk at intake |
| Quote sent | 2 | One whose hold expires tomorrow; one paid and waiting on insurance |
| Permitted | 4 | One within the next 7 days; one series; one Special with work orders |
| Event day | 1 | The Monday tai chi series; its May 31 session is skipped for the blackout |
| Closeout | 2 | One with hours logged, waiting on the Clerk; one with a failed cleanup inspection |
| Closed | 3 | One refund, one extra invoice, one Instant closed automatically |
| Denied, Withdrawn, Cancelled, Hold expired | 1 each | Each with its reason in the activity log |

Stress rows, each at least once: an event name of 90 or more characters; an organization name of 60 or more; a name with diacritics and an apostrophe; no description; no setup or teardown times; a series of 20 or more sessions; a case with one activity entry and one with 30 or more; an overdue task for each of the four parties; a $0 fee line; a route over 10 miles.

**Reserved slots** that background cases must leave untouched, enforced by `tests/seed.test.ts`: every slot used by the 13 PRD cases; all of Shelter 2 from May 13 on (demo path 2); Field 4 on every Sunday from Jun 6 to Aug 29; the Maple Street 400 block on Jun 26; Main Street 1st to 4th Avenue on Sat, Apr 22, 2028 (demo path 6). The opening queue of each role must still contain the hero task the PRD names for it.

### 6.3 Demo paths

`tests/demo-paths.test.ts` runs each path from a fresh seed as a sequence of `dispatch` calls and asserts the state after every step. Paths 1 to 6 are P0, path 7 is P1. After each path, `reset()` must restore the seed exactly, checked by a snapshot. `tests/action-coverage.test.ts` (Phase 4) fails if any `Action` type used by paths 1 to 6 has no control in `app/` or `components/`.

---

## 7. Landing page

The landing page is a real city page, built from Rime & Ink's marketing patterns, with content rendered from `lib/rules/config.ts` so fees and lead times cannot drift from the app.

| Section | Rime & Ink pattern | Content |
|---|---|---|
| Nav | Floating glass nav | Wordmark and "City Clerk · Events Permitting"; How it works, Event tiers, Fees, Questions; "City staff" (secondary) and "Plan an event" (primary) |
| Hero | Two columns, 72 px headline with the hand-drawn underline, floating rotated panel | The product visual is live: a small panel running the real `classify()` on a few toggles, so the tier changes as a visitor plays with it |
| How it works | Scroll thread with five numbered markers | The five wizard questions, each with a small mock of its step |
| Three tiers | Three-card grid | Instant, Reviewed, Special event: lead time, who reviews, a typical fee, an example from the scenarios |
| What sets the tier | Comparison table | Triggers against tiers, the recommended-column wash on Reviewed |
| Your to-do board | Alternating feature block | A board mock taken from S3 |
| Fees and cancellations | Frosted panels | Fee schedule and cancellation schedule from config |
| For city staff | Dark interlude | A queue and Who's up mock with a mono activity log; the door to `/city/queue` |
| Questions | Accordion | Insurance, lead times, block parties, recurring events, cancelling |
| Close | Closing CTA card and footer | "Plan an event"; office hours; a line saying Permitopolis is fictional |

---

## 8. Phases and workstreams

Each workstream lists what it owns, what it reads first, its tasks and how it is checked. "Gate" means `pnpm check` (type-check, lint, tests, build) on the merged branch.

### Phase 0: Bootstrap and contracts (inline, session model)

- [x] Create the `build` branch. Add `.gitignore` (`node_modules`, `.next`, `.vercel`, `coverage`, `.DS_Store`).
- [x] Convert the sources with pandoc and openpyxl into `docs/spec/prd.md`, `flows.md`, `scenarios.json` and `img/`. Commit the four source files as well.
- [x] Scaffold Next.js with `pnpm create next-app@latest` in a temporary folder (the repo root is not empty) using TypeScript, App Router, Tailwind, ESLint, no `src` folder and the `@/*` alias, then move it into the repo root. Record the installed versions in `docs/readme.md`.
- [x] Install every dependency in the tech stack. Run `shadcn init` and add: button, dialog, sheet, tabs, dropdown-menu, tooltip, accordion, select, checkbox, switch, popover, sonner, table, input, textarea, label, separator, scroll-area, command.
- [x] Mark `node_modules` and `.next` as ignored by Dropbox (`xattr -w com.dropbox.ignored 1 <dir>`).
- [x] Add scripts `typecheck`, `lint`, `test`, `build` and `check`. Add the ESLint rule against `new Date()` and `Date.now()` and write `tests/guards.test.ts`.
- [x] Write the contracts from section 5: `lib/types.ts`, `lib/state/actions.ts`, and stubs with final signatures for `lib/rules` and `lib/state` that throw "not implemented".
- [x] Write `lib/rules/config.ts` and `lib/data/inventory.ts`, `streets.ts`, `calendar.ts`, `fees.ts` from the PRD's tables, including Oak Avenue and segment lengths that make the S5 loop 3.1 miles.
- [x] Write and test `lib/format.ts` and `lib/routes.ts`.
- [x] Write `styles/tokens.css` with every Rime & Ink token plus `fg-label` and the party and tier tints.
- [x] Fill in `CLAUDE.md` (overview, key features, "Build rules for agents") and `docs/readme.md` (architecture and the decisions in section 3).
- [x] Gate passes. Commit.

**Done 2026-10-12.** Gate: type-check, lint, 24 tests and build pass. Installed: Next.js 16.4.0, React 19.3, Tailwind 4.3, Vitest 5. For the hand-off: `lib/types.ts`, `lib/state/actions.ts` and `lib/rules/config.ts` shape everything after them.

### Phase 1: Engine and design system (5 builders: 1A to 1D, plus 2C from Phase 2)

| | Owns | Reads first |
|---|---|---|
| **1A Rules engine** | `lib/rules/**` except `config.ts` | PRD "Rules and reference data", "Applicant wizard", "Card catalogue"; flows "Decision tree"; sections 3.3, 5.2, 6.1 |
| **1B State machine and store** | `lib/state/**` except `actions.ts` and `seed/` | PRD "Core model", "States and transitions"; sections 5.3, 5.4 |
| **1C Scenario scripts** | `lib/state/seed/scenarios/**`, `lib/state/seed/background/**`, `lib/data/people.ts`, `lib/data/templates.ts` | PRD "Seed data"; `docs/spec/scenarios.json`; sections 3.3, 6.2 |
| **1D Design system** | `app/globals.css`, `styles/**`, `components/ui/**`, `components/domain/**`, `app/dev/kit/**`, `lib/contrast.ts` | `docs/rime-and-ink-design-system.md`; sections 3.2, 5.5 |

**1A tasks** (test first, one test file per function)
- [x] `classify` with the block-party exception; every row and boundary in section 6.1.
- [x] `whatIf`, `routing` and the permit components list.
- [x] `requirements`: all 29 catalogue cards with `why`, reviewer, phase, `unlocksOn` and due date; one health-permit card per vendor; the block-party substitution.
- [x] `estimateFees`, including series per session and the late fee.
- [x] `availability` and `occurrences`: time-window overlap, blackout, impacted, next open dates.
- [x] `dateGate`, `cancellationRefund`, `planTimeline`.

**1B tasks** (test first)
- [x] `transition` for every action in section 5.4: one passing test per row of the PRD's transitions table and one failing-precondition test with its reason. Mock `@/lib/rules` in these tests.
- [x] Task unlocking by `UnlockEvent`; review clock pause, resume and "Day 9 of 21 · paused 2 days".
- [x] `waitingOn`, `nextMove`, `boardColumn`, and `availableActions` with a reason for every disabled action.
- [x] `advanceClock`: hold expiry, Event day, Closeout, Instant straight to Closed, series occurrences.
- [x] The store with `persist`, `skipHydration`, `useHydrated`, guarded storage and `reset`.

**1C tasks**
- [x] Personas and organizations; condition and request templates.
- [x] One script per PRD case (13): wizard answers plus a dated list of actions that reaches the seeded state.
- [x] 25 background specs that satisfy the counts, stress rows and reserved slots in section 6.2.
- [x] A test that every script is well formed and no reserved slot is used.

**1D tasks**
- [x] Tailwind v4 theme from `styles/tokens.css`; page chrome layers on `body`; the app's quieter variant behind a class.
- [x] Every primitive in section 5.5 with hover, active, focus-visible and disabled states at the Rime & Ink timings.
- [x] Every domain component in section 5.5.
- [x] `lib/contrast.ts` and a test that each allowed text and surface pair reaches 4.5:1.
- [x] `/dev/kit`: one page showing every primitive and domain component in every state.

**Gate:** all rules and state tests pass. **Checkpoint:** you open `/dev/kit` and judge the glass, the party tints and the tier badges.

**Done 2026-10-12.** Gate: type-check, lint, 320 tests in 31 files and build pass on the merged tree. Workstream 2C (map and calendar, listed under Phase 2) was built here as a fifth builder, since it needs only Phase 0. The integrator also ran all 38 seed scripts through the two real engines as a one-off check: every script now reaches its expected tier, state and ending with no refused step, so workstream 2A starts from scripts that replay. What the merge changed is in the Changes section.

### Phase 2: Skeleton (3 builders: 2A, 2B and 2D; 2C is done)

| | Owns | Reads first |
|---|---|---|
| **2A Seed and demo paths** | `lib/state/seed/**`, `tests/seed.test.ts`, `tests/demo-paths.test.ts`; may fix bugs in `lib/rules/**` and `lib/state/**` | PRD "Seed data", "Demo script"; sections 6.2, 6.3 |
| **2B App shell** | `app/layout.tsx`, `app/city/layout.tsx`, `app/not-found.tsx`, `components/shell/**`, `lib/view/shell.ts`, `lib/data/demoScript.ts`, `tests/render/harness.tsx`, a placeholder page for every route not yet built | PRD "App shell, routes and demo controls" |
| **2C Map and calendar** (built in Phase 1) | `components/map/**`, `components/calendar/**`, `lib/data/mapGeometry.ts`, `lib/view/map.ts`, `app/dev/map/**` | PRD wizard step 2, "Map and inventory", "Active permits" |
| **2D Shared building blocks** (added in Phase 2) | `components/ui/**`, `components/domain/**`, `components/kit/**`, and the Phase 1 review's polish in `components/map/**` and `components/calendar/**` | The Phase 1 review findings; `docs/rime-and-ink-design-system.md`; PRD "Applicant to-do board", "Case detail"; section 5.5 |

**2A tasks**
- [x] `replay`: build each case by running its script through `classify`, `requirements` and `transition` at each step's date.
- [x] `buildSeed` for all 38 cases; `tests/seed.test.ts` asserts section 6.2 and the PRD's seed table.
- [x] `tests/demo-paths.test.ts` for paths 1 to 6 and the reset snapshot. Path 7 (P1) is covered at the store level too.
- [x] The eight engine findings left open by the Phase 1 review, each with a test: who may raise each action, routing lists, the date gate's fixes, money to the cent, the hold's expiry, the order of Who's up, routing reasons from the config, and the missing section 6.1 assertions.

**2B tasks**
- [x] Top bar: wordmark, four-segment role switcher, persona picker, date chip, Demo menu.
- [x] Demo menu: reset in a Dialog, set demo date (which runs `advanceClock`), scenario jump list S1 to S6, hints toggle.
- [x] City sidebar: My queue with a count, Cases, Active permits, then the role's tools.
- [x] Remember the last role and the last page per role. Render a skeleton until `useHydrated()` is true.
- [x] Not-found and storage-blocked states.
- [x] The render harness (`tests/render/harness.tsx`) and a placeholder page for all 19 routes not yet built.

**2D tasks** (added in Phase 2)
- [x] Phase 1 review polish: the party hue only on the chip's avatar tile; a tier never shown by a dot alone; a label on the compact stepper; the focus ring on every raw button; pointer capture for the area drag.
- [x] Page and list primitives: `PageHeader`, `Section`, `KeyValueList`, `ConfirmDialog`, `WizardStepper`, `FilterBar`, `CountBadge`, `Toolbar`, `Progress`, `InlineAlert`, `StickyAside`, `Truncate`, `CopyButton`.
- [x] Case components: `CaseHeader`, `WhoIsUp`, `TaskCard`, `StackedTaskCard`, `FeeTable`, `ConditionList`, `ActivityTimeline`, `EndingBanner`, `EventTitle`, `LeadTimeRisk`, `DeptStatusDots`, `AvailabilityBadge`, `TaskKindLabel`, `PersonaAvatar`.
- [x] Every one of them on `/dev/kit` in its interesting states, with the stress rows.

**2C tasks** (done in Phase 1)
- [x] The Permitopolis SVG: Riverside Park with four shelters and four fields, Great Lawn, City Hall Plaza, Main Street, River Road, Maple, Elm and Oak.
- [x] `LocationPicker`: bookable spaces, draw an area (drag a rectangle; square feet and capacity at 10 sq ft a person), street segments (residential marked), draw a route (connected segments in order, miles, undo). A list beside the map does the same by keyboard.
- [x] `PermitopolisMap` display mode, `MapThumbnail`, `MonthGrid`, `WeekGrid`, `DayStrip`.
- [x] Geometry tests in `lib/view/map.ts`. `/dev/map` shows all four modes.

**Gate:** seed and demo-path tests pass, so the engine is proven on all six paths before any screen exists. **Checkpoint:** you try the shell, the Demo menu and the four map modes.

**Done 2026-10-12.** Gate: type-check, lint, 760 tests in 49 files and build pass on the merged tree. The three branches merged with no conflicts and the gate passed before any integration change. What the integration added once the seed, the shell and the building blocks were in one tree is in the Changes section; what a screen builder needs is in `docs/readme.md`, "Building a screen (Phase 2)".

### Phase 3: P0 surfaces (7 builders)

Every builder also writes `lib/view/<surface>.ts` with tests, handles loading, empty and not-found states, and writes `tests/render/<surface>.test.tsx`, which mounts each of its pages against the seed for every role that can reach it and asserts that it renders without throwing and shows its key content.

| | Owns | Builds |
|---|---|---|
| **3A Landing** | `app/page.tsx`, `app/demo/**`, `components/landing/**` | Section 7, and the demo guide: the seven paths, each with a jump link |
| **3B Wizard** | `app/apply/**`, `components/wizard/**` | Steps 1 to 5; the live result panel (a bottom sheet on mobile); what-if chips; availability and the lead-time gate with its three fixes; autosave; stepper with edit links; tier-change highlight and `aria-live` |
| **3C Board** | `app/events/page.tsx`, `app/events/[id]/page.tsx`, `components/board/**` | My events; status strip; four columns, tabs on mobile; phase swimlane toggle; card anatomy; detail sheets for document, form, action, payment and city request; stacked per-vendor cards; the Submit card; Withdraw and Cancel |
| **3D Quote and permit** | `app/events/[id]/quote/**`, `permit/**`, `app/verify/**`, `components/checkout/**`, `components/permit/**` | Quote with conditions, fee table, typed signature and card form; booking mode for Instant; the permit page with QR code, cancellation schedule and print stylesheet; `/verify/[id]` |
| **3E City lists** | `app/city/queue/**`, `app/city/cases/page.tsx`, `app/city/intake/**`, `components/city/lists/**` | My queue grouped Overdue, Due this week, Later, with "Waiting on others" collapsed; pipeline board by state and table; filters in the URL (tier, state, waiting on, date range, involves me); search; lead-time risk; closed and off-path cases behind a filter; the intake queue by tier with completeness and competing applications |
| **3F Case detail** | `app/city/cases/[id]/**`, `components/case/**` | Header with stepper, hold and review clock; Who's up with four rows and the next-move sentence; the five tabs; a sticky action panel driven by `availableActions`, with a generic panel for every action and empty registries for 4A to 4D; `?task=` opens that task's panel |
| **3G Active permits** | `app/city/active/**`, `components/active/**` | List, calendar and map views; the Today strip and next 7 days; the toggle for Quote sent holds; role overlays (work orders, closures and walkthroughs for Public Works & Safety; inspections and vendor permits for Health & Legal; day-of contact duty for the Clerk); the Closeout tab |

**Gate:** paths 1 to 4 have a control for every step. **Checkpoint:** your first full walkthrough, and the main design review of the list and detail views.

- [x] **3A Landing and demo guide** (`e15d852`): `/` and `/demo`.
- [x] **3B Wizard** (`59d8fbe`): `/apply`, steps 1 to 5 with the live result panel.
- [x] **3C Board** (`c90e48d`): `/events` and `/events/[id]`.
- [x] **3D Quote and permit** (`de06974`): `/events/[id]/quote`, `/events/[id]/permit`, `/verify/[id]`.
- [x] **3E City lists** (`afa694e`, `6682c88`): `/city/queue`, `/city/cases`, `/city/intake`.
- [x] **3F Case detail** (`4f280e5`): `/city/cases/[id]`, a generic panel for every action, empty registries for 4A to 4D.
- [x] **3G Active permits** (`0adb264`): `/city/active`.
- [x] **Integration**: the seven branches merged with no conflicts; 11 hand-offs between surfaces fixed, each covered in `tests/render/handoffs.test.tsx`; the consistency pass; the builders' contract change requests decided (`docs/plans/2026-10-12-phase-3-integration.md`).
- [x] **Gate**: paths 1 to 4 have a control for every step. Paths 3 and 4 are clicked from first step to last across the board, My queue, Intake, the case, checkout and Active permits in `tests/render/handoffs.test.tsx`; path 1 in its group (a) with `tests/render/active.test.tsx`; path 2 in `tests/render/wizard.test.tsx`.
- [ ] **Review**: the read-only review of Phase 3 against the PRD (section 9) has not run yet.

**Done 2026-10-13**, the review aside. Gate: type-check, lint, 1,255 tests in 69 files and build pass. What a Phase 4 builder needs is in `docs/readme.md`, "The screens (Phase 3)"; what to open in a browser is in section 12.

### Phase 4: Role tools and money (6 builders)

| | Owns | Builds |
|---|---|---|
| **4A Clerk hand-offs** | `components/case/actions/clerk.tsx`, `components/case/clerk/**` | Request info with item picker; routing with reasons and due dates; consolidation side by side with conflict flags and merged conditions; quote builder; deny and send to commission |
| **4B Clerk money and closeout** | `components/case/clerk-money/**` | Record payment; Issue permit with what is missing; reconciliation of estimate against actual; final invoice or refund; close |
| **4C Reviewer panel** | `components/case/actions/pws.tsx`, `components/case/review/**` | The shared review panel for both departments: sections, four decisions, condition templates, fee lines; Public Works & Safety closeout (cleanup inspection, actual hours) |
| **4D Verification** | `components/case/actions/hl.tsx`, `components/case/verify/**` | Mock document preview and the three checklists (insurance, health permit, accessibility); Verify, or Reject with a reason |
| **4E After the event** | `components/board/after/**`, `components/board/series/**` | Final bill or refund with estimate and actual side by side; feedback; Book again next year; the series payment schedule |
| **4F Edge states and coverage** | `components/city/lists/**`, `components/case/**` except `actions/` and the folders above; `tests/action-coverage.test.ts` | The states matrix below; the "Stalled" chip in development builds; the action-coverage test |

**States matrix for the list and detail views (4F):**

| Kind | Cases |
|---|---|
| Empty | A role with nothing in its queue; filters with no result and a "Clear filters" action; a case with no documents, conditions or fees yet |
| Error | An unknown case ID; localStorage blocked or holding a corrupt value; an action whose precondition fails, shown with its reason |
| Edge | 90-character names and long organization names; missing fields shown as "Not provided"; overdue for each party; hold expiring tomorrow; each off-path ending with its reason banner; a 20-session series; competing applications; sent to commission |

**Gate:** paths 5 and 6 have a control for every step; the action-coverage test passes. **Checkpoint:** all six paths end to end. P0 is complete.

### Phase 5: P1 depth (5 builders, then 1)

| | Owns | Builds |
|---|---|---|
| **5A Amendment** | `app/events/[id]/amend/**`, `components/wizard/amend/**`; `amend` in `lib/state` | The wizard reopened on the same record; the tier-rise banner; the date gate; cards tagged Amendment; the old permit stays valid. Demo path 7 |
| **5B Clerk P1** | `app/city/payments/**`, `components/case/clerk-p1/**` | Payments due, received and refunds; license review section; pre-application meeting scheduling |
| **5C Public Works P1** | `app/city/map/**`, `app/city/work-orders/**` | Closures and routes for a date range with overlaps and a calendar strip; work orders and walkthrough scheduling |
| **5D Health & Legal P1** | `app/city/verifications/**`, `components/case/vendors/**` | The cross-case verification queue; vendor permits per event |
| **5E Demo hints** | `components/shell/hints/**`, `app/demo/**` | Callouts that say what to click next on each path; a command palette (`⌘K`) for cases, roles and scenarios |
| **5F Accessibility and responsive pass** (runs alone, after the merge) | everything | Keyboard order, focus, `aria-live`, contrast; applicant screens at 375 px; city screens at 1280 px |

### Phase 6: P2 and ship (3 builders)

- [ ] **6A Settings:** inventory and rates, tier thresholds, blackout calendar, templates. Changing a threshold re-classifies open drafts.
- [ ] **6B Day-of tools:** the Clerk's compliance log, the closure checklist and police roster, food booth inspections.
- [ ] **6C Submission notes:** `docs/readme.md` gets who it is for, the key decisions and section 11, ready for the Loom.
- Not doing: the Playwright run and the Vercel deploy (see 3.1).

---

## 9. How each phase runs

One workflow per phase, authored when the previous phase's checkpoint is approved.

```js
phase('Build')       // barrier: the integrator needs every result
const built = await parallel(WORKSTREAMS.map(w => () =>
  agent(brief(w), { label: w.id, phase: 'Build', model: 'sonnet',
                    isolation: 'worktree', schema: BUILD_RESULT })))
phase('Integrate')   // session model
const merged = await agent(integrate(built.filter(Boolean)), { phase: 'Integrate', schema: GATE_RESULT })
phase('Review')      // session model, read-only
const review = await agent(reviewAgainstSpec(merged), { phase: 'Review', schema: FINDINGS })
return { merged, review }
```

- **Brief.** Each builder gets its row and tasks from section 8, the paths it owns, the spec sections to read, and four rules: stay inside your paths; add no dependency; start no dev server and no browser; return your log entry instead of editing `docs/log.md`. It runs `pnpm install --frozen-lockfile --prefer-offline` first, because a fresh worktree has no `node_modules`.
- **Build result.** `{ branch, commits, filesChanged, checks: { typecheck, lint, test }, logEntry, contractChangeRequests, blocked }`. A builder commits on its own branch and reports the name.
- **Integrate.** One agent merges the branches into `build` in the order listed in section 8, runs the gate, fixes what the merge broke, writes the log entries and ticks the boxes in this plan.
- **Review.** One read-only agent checks the phase's tasks and the cited PRD sections against the code and returns findings with file and line. The orchestrator fixes small findings inline and reports the rest to you.
- **No stops between phases.** When a gate passes, the orchestrator records the result in this plan and starts the next phase. The list of screens to look at is collected across phases and handed over once, after Phase 6.
- **Size.** The largest workflow is Phase 3: 7 builders, 1 integrator and 1 reviewer.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| The repo is inside Dropbox. Each worktree installs its own `node_modules`, and syncing them can lock files and slow everything. | pnpm's shared store keeps installs fast. Phase 0 marks `node_modules` and `.next` as Dropbox-ignored; after the first workflow, do the same for wherever the harness places worktrees. Fallback: run builders in the shared tree without isolation, which the ownership map in section 4 makes safe. |
| Parallel builders drift from each other. | Contracts are frozen after Phase 0, surfaces integrate only through routes and the store, and the gate type-checks the merged tree. |
| The seed depends on both the rules and the state machine. | Scripts are data in Phase 1; replay runs in Phase 2 once both exist, and 2A owns the engine for bug fixes. |
| The SVG map is the largest single piece of UI. | The keyboard list gives every map function without the drawing. 2C builds the list first, then the map modes in the order spaces, streets, route, area. |
| A persisted store causes hydration mismatches in Next.js. | `skipHydration` and a `useHydrated()` gate in the shell. |
| The plan is broader than the brief's three hours and "depth over breadth". | Every phase is a stopping point; Phase 4 is the full P0 demo; depth goes to 3E, 3F and 4F. |
| "Latest stable" Next.js may differ from what the builders know. | Phase 0 records versions; builders consult the installed version's docs before using an unfamiliar API. |

---

## 11. Deliberately not built

For the Loom's "what I chose not to build":

- A backend, accounts, email, real payments and real file storage.
- Real maps and geocoding.
- Appeals, and a commission workflow beyond a flag.
- Notifications outside the app, and languages other than English.
- A PDF library: "Download PDF" prints the page.

---

## 12. What to look at

The screens to open once the build is done, collected from each builder as its phase lands. Nothing
here has been looked at in a browser: every screen is checked by render tests in jsdom, which see
structure and behavior and not layout, spacing or color. Run `pnpm dev` and open each URL.

How to use the list: start from a fresh seed (Demo menu, Reset demo data), on Mon, May 3, 2027. Each
row names the role to be in and, for the Applicant, the persona. If a link opens as the wrong role
it shows "This screen is built for ...", and the switch offered there opens the page. The Demo
menu's scenario jumps (S1 to S6) set role, persona and page in one step.

### Phase 1 and 2 checkpoints (not linked from the app)

| URL | Look for |
|---|---|
| `/dev/kit` | Every primitive and domain component in every state, on the Rime & Ink tokens: buttons at each size and state; form controls; tier badges, party chips and state chips (color always with an icon and a label); the stepper; `TaskCard` locked, pinned, overdue, sent back and done; `WhoIsUp`; `FeeTable` with Actual and Difference; the stress rows (a 101-character event name, a 60-character organization, "Not provided", an ended case). Since Phase 3: `BillingBadge`, `TierLegend` and the back link, in "Domain: BillingBadge, TierLegend, and the back link". The three places section 3.2 bends the design system are worth a look here: identity tints on avatars and dots only, `fg-label` for labels, blur on chrome only |
| `/dev/map` | The Permitopolis map in its four picking modes (bookable spaces, draw an area, street segments, draw a route), each with its keyboard list beside it; residential blocks marked; the display map with overlapping bookings and its tier legend; `MapThumbnail`; the month grid, week grid and day strip |

### Landing page and demo guide (3A)

| URL | As | Look for |
|---|---|---|
| `/` | Anybody | The full Rime & Ink marketing treatment: floating glass nav, grid, grain and atmosphere, the scroll thread through "How it works". The hero's preview panel: change the event type, place and add-ons and watch the tier and the fee move (alcohol on: Reviewed; a street: Special event) |
| `/` | Anybody | Three tier cards with a real example each, the comparison table, the to-do board block built from Jazz in the Plaza's own cards, the fee and cancellation panels, the dark "For city staff" section with its live activity log, the FAQ, the closing section and footer |
| `/` | Anybody, at 375 px | The nav collapses; the hero stacks; nothing scrolls sideways |
| `/` | Anybody | The two doors: "Plan an event" opens the wizard as the Applicant; "City staff" and "Open the staff workspace" open My queue as the City Clerk |
| `/demo` | Anybody | The four roles, the three date jumps, the seven demo paths as cards (each step with its role chip), "Start this path" on each, the six-scenario table with "Jump", "What is faked", Reset behind a confirmation, and "Back to Permitopolis" |

### Wizard (3B)

| URL | As | Look for |
|---|---|---|
| `/apply` | Applicant, New applicant | Step 1: the six event-type cards (icon and a one-line blurb), the name and description fields, and the result panel on the right starting from a blank draft |
| `/apply?case=PMT-27-0142&step=when` | Applicant, Sunrise Yoga Club (S2) | Reopened at step 3: Repeat on, 13 Sundays listed with an availability badge each, Jul 11 marked Impacted, and the panel's fee estimate showing $20 per session, 13 sessions, $260 total |
| `/apply` | Applicant, New applicant | Pick Picnic or party, Shelter 2, 40 people, then turn Alcohol on at step 4: the tier badge's highlight as it moves from Instant to Reviewed, and the what-if button "Remove alcohol: Instant, book today" in the panel |
| `/apply` (any draft at step 5) | Applicant | The tier card with its reasons, "One Permitopolis event permit. It covers:", the reviewers, the timeline, the plan's cards grouped by phase (the same phase names as the board's swimlanes), the fee table, the visual "Create your account" button, and the primary action, disabled with a reason when the date gate fails or an answer is missing |
| Any wizard step, under 1024 px | Applicant | The right-hand panel is replaced by a one-line summary bar at the bottom that opens a bottom sheet with the same content |

### My events and the board (3C)

| URL | As | Look for |
|---|---|---|
| `/events` | Applicant, Maya Chen | Her picnic's row with a "View permit" link to `/events/PMT-27-0109/permit` |
| `/events` | Applicant, New applicant | The empty state: "No events yet", "Plan an event" |
| `/events/PMT-27-0118` | Applicant, Downtown Arts Collective (S3) | The status strip reads "Waiting on: You"; the reviewers row gives each department's status in plain words; Do now has exactly one pinned card (Health permit: Rolling Dumpling Co., due Wed, May 5). Open it, "Use sample file", "Reply and attach": it moves to With the city and the strip switches to waiting on Health & Legal |
| `/events/PMT-27-0126` | Applicant, Maple Street block captain (S4) | The neighbor sign-off card shows "9 of 12 neighbors"; the strip shows "No date hold yet" and "3 neighbor sign-offs to go". Open the card and click "Simulate a sign-off" three times |
| `/events/PMT-27-0097` | Applicant, Riverfront Running Club (S5) | Do now has "Accept conditions and sign" and "Pay fees and deposit"; both go straight to the quote page, not a sheet |
| `/events/PMT-27-0031` | Applicant, Main Street Business Alliance (S6) | Coming up lists "Final bill or refund" and "Tell us how it went" (the case is in Closeout on load); the 25 vendor health permits are one stacked card in Done |
| `/events/PMT-27-0048` | Applicant | Sunnyvale Block Association's withdrawn board: an ending banner and only a Done column, with no status strip and no grouping toggle |
| `/events/PMT-27-0034` | Applicant, Riverside Tai Chi Circle | A permitted series on its day: "Carry your permit" in Do now; the done "Pay and book" card opens the session schedule, with "Pay this session" on the sessions still owed |
| Any board above, under 768 px | Applicant | The four columns become tabs with counts; try the "By status" and "By phase" toggle |

### Checkout, permit and the public check (3D)

| URL | As | Look for |
|---|---|---|
| `/events/PMT-27-0142/quote` | Applicant, Sunrise Yoga Club | Booking mode: 13 sessions, $20 a session, $20 due now; "Back to your plan" returns to the wizard; paying lands on `/events/PMT-27-0142/permit` (demo path 1) |
| `/events/PMT-27-0097/quote` | Applicant, Riverfront Running Club | Quote mode: conditions grouped by department with accept checkboxes, the Fri, May 14 hold warning, sign, then pay $6,530, then "Paid. Waiting on Health & Legal to verify your insurance." (demo path 5) |
| `/events/PMT-27-0118/quote` | Applicant, Downtown Arts Collective | The not-ready state: "Your quote isn't ready yet", with a link back to the board |
| `/events/PMT-27-0109/permit` | Applicant, Maya Chen (S1) | The permit card at 375 px: QR code, "Open the verification page", the Shelter 3 map thumbnail, Sat, May 22, 11 am to 4 pm, the $62.50 cancellation refund; "Download PDF" opens the print layout with the card alone |
| `/verify/PMT-27-0109` | Anybody | A large "Valid", with the event, place, date and hours, attendance and conditions |
| `/verify/PMT-27-0097` | Anybody | "Not valid": "This permit hasn't been issued yet." |

### City lists: My queue, Cases, Intake (3E)

| URL | As | Look for |
|---|---|---|
| `/city/queue` | City Clerk | The briefing line as the page's heading, the Overdue, Due this week and Later groups, and Downtown Art Walk with a due date and days waiting. A row opens its case with that task's panel open, and the case goes "Back to My queue" |
| `/city/queue` | Public Works & Safety, then Health & Legal | The triggers and review clock on each row, and the "Waiting on others" disclosure at the bottom |
| `/city/cases` | Any city role, Board view | The seven columns, the density of a card, the "Waiting on" chips; after turning on "Closed and ended", an ended case's ending chip on its card |
| `/city/cases?view=table` | Any city role | The sortable headers (Event date, State, Waiting on, Due), the sticky header, mono ids and dates, and the department status dots' tooltip on hover and on focus |
| `/city/cases` | Any city role | An impossible filter (tier Instant and search "5K"): the empty state names the filters and "Clear filters" restores the list; try the removable filter chips. A case opened from a filtered list comes back to the same filters |
| `/city/intake` | City Clerk | The Reviewed tab's Maple Street block party (Accept disabled, "9 of 12 items", "Waiting on 3 neighbor sign-offs") next to Plaza wedding photos ("Competing with Jazz in the Plaza — complete first"); the Special tab's Downtown Art Walk (Accept enabled); the Instant exceptions tab lists the Brightline Logistics company picnic, whose link opens Reconcile and close |

### Case detail (3F)

| URL | As | Look for |
|---|---|---|
| `/city/cases/PMT-27-0097` | City Clerk (scenario S5) | Who's up shows two "Up now" rows (the applicant, Health & Legal); "Issue permit" is disabled in the sticky panel with the combined reason; the next-move sentence names both parties |
| `/city/cases/PMT-27-0097?task=issue_permit` | City Clerk | The link opens the Issue permit panel directly |
| `/city/cases/PMT-27-0118` | Health & Legal (the case behind S3) | Documents tab: the pinned vendor health permit card and its request thread. Reviews tab: Health & Legal's own section with "Decide your review" and "Request information" |
| `/city/cases/PMT-27-0126` | City Clerk (switch role on the case; the S4 jump opens as the applicant) | The sticky panel's "Accept as complete" (the hold appears in the header once accepted) and "Confirm routing" (reviewers, sections and due dates prefilled) |
| `/city/cases/PMT-27-0031` | Public Works & Safety (scenario S6) | The Log closeout panel's actual quantity per fee line and the extra Cleanup crew hours field; then, as the City Clerk, "Reconcile and close" and the Conditions and fees tab's Actual and Difference columns |
| `/city/cases/PMT-27-9999` | Any city role | "Case not found" |
| `/city/cases/PMT-27-0118?tab=activity` | Any city role | The activity log, newest first, with the actor filter |
| Any case above | Each city role in turn | The page keeps its URL and tab through the role switcher; the header's review clock and "Your actions" change with the role |

### Active permits (3G)

| URL | As | Look for |
|---|---|---|
| `/city/active` | City Clerk | The List tab: Maya Chen's picnic and Little League Opening Day as rows, the Day-of contact and Compliance log columns, and the Today strip's headline naming the Monday tai chi session |
| `/city/active?holds=1&sessions=1` | City Clerk | "Show every session" and "Include held dates" both on: the Riverside Tai Chi series is one row per Monday, and the Riverfront Summer 5K appears as held ("Date held until ..."), not as permitted |
| `/city/active?view=calendar&date=2027-06-07` | City Clerk | After booking the Sunrise Yoga Club's draft (demo path 1): its Sundays on Field 4. The month and week toggle, the tier legend, and the role overlay panel on the right |
| `/city/active?view=map&date=2027-07-11&holds=1` | Public Works & Safety | The Riverfront 5K's route on the map; a booking in the list under the map opens its case and comes back to this day. An empty day (2027-05-20) shows the empty state |
| `/city/active?view=closeout` | Any city role | The Main Street Food Truck Festival, held by Public Works & Safety, with its remaining steps |
| `/city/active` | Public Works & Safety, then Health & Legal | The list's own-role column and the Calendar and Map side panel change from work orders to vendor permits |

### Across the surfaces (Phase 3 integration)

| Start at | As | Look for |
|---|---|---|
| `/demo`, "Start this path" on each of the seven | Anybody | Each lands on a real screen in the right role; paths 1 to 4 can then be clicked through to the end with a control for every step |
| `/apply?case=PMT-27-0142&step=plan` | Applicant, Sunrise Yoga Club | "Book and pay $20", pay, and the permit page shows the permit with its 13 sessions; then `/city/active?view=calendar&date=2027-06-07` as the City Clerk shows the Sundays |
| `/apply` | Applicant, New applicant | A Reviewed plan (a picnic with alcohol): "Create my to-do board" opens the board with its cards; My events then opens the board, and the board's menu offers "Edit your plan" |
| `/events/PMT-27-0118` | Applicant, then each city role, then the Applicant again | The role switcher follows the case to `/city/cases/PMT-27-0118` and back to the board, as Downtown Arts Collective |
| `/city/cases/PMT-27-0097` | Applicant | "This screen is built for a city role."; "Switch to Health & Legal" opens the case, not the queue |
| `/city/intake` | City Clerk, then Public Works & Safety | The switch leaves the Clerk's Intake for the queue; a case opened from Intake as the Clerk says "Back to Intake" |

---

## Changes

- 2026-10-13: Phase 3 done (the read-only review has still to run). Built: the public landing page and the demo guide (3A); the five-step wizard with its live result panel (3B); My events and the to-do board (3C); checkout in four modes, the permit with its QR code and the public check (3D); My queue, the Cases pipeline and Intake (3E); the city's case detail with a panel for every action and a registry Phase 4 overrides by role (3F); Active permits as list, calendar, map and closeout (3G). The seven branches merged with no conflicts and the gate passed on the merged tree (1,155 tests in 68 files) before any integration change. **The integration was interrupted by a usage limit on 2026-10-12**, after the merges and with its first changes uncommitted, **and was resumed and finished on 2026-10-13**; it now commits at each checkpoint. What it changed, and why: (1) **11 hand-offs between surfaces were broken or missing** (a queue row opened an empty sheet; a case always went "Back to cases"; a booked session fell through to "Nothing to pay here"; the permit's QR code held a path; a page opened under the wrong role lost its link on the switch; the full table is in `docs/plans/2026-10-12-phase-3-integration.md`), each fixed and each covered by `tests/render/handoffs.test.tsx`, which mounts the real layouts and pages by URL and follows a link from one surface into the next (69 tests, with demo paths 3 and 4 clicked through from first step to last); (2) **consistency**: one set of phase names for the wizard and the board, `BillingBadge` and `TierLegend` moved into `components/domain`, one `applicantNameOf()`, one `BackLink`, the board's reviewers row through `ReviewStatusDot`, success toasts on the board as on checkout and the city's panels; (3) **contracts, all additive**: `routes.city.case()` takes `from`; `lib/types.ts` gains `TASK_PHASE_LABEL` and `TASK_PHASES`; the `lib/state` barrel exports the quote figures and the `check*` functions (3D's request, applied); 3E's request to type the pipeline's `sort`, `dir` and `closed` into `CasesFilters` was declined; (4) the role-switch rule gained one case: a page opened under the wrong role stays put when the switch is to a role it is built for. Gate on the final tree: type-check, lint, 1,255 tests in 69 files and build pass. Section 12, "What to look at", is new and collects every builder's list of screens. Nine new questions for the owner are at the end of `docs/readme.md`. For Phase 4: `clerk.tsx` is shared by 4A and 4B, and `hl.tsx` by 4C (the review panel) and 4D (verification), so each adds only its own keys.
- 2026-10-12: Phase 2 review fixes (21 findings: 3 high, 14 medium, 4 low; all fixed). Plan and what changed from it: `docs/plans/2026-10-12-phase-2-review-fixes.md`. What they change for Phase 3 and later: (1) **the render harness follows the URL**: the `next/navigation` mock is a live router, so a screen that keeps a step, tab or filter in the URL can be clicked through, and `renderScreen()` takes a `stored` demo for reload tests; (2) **the store hydrates on every route** through a `StoreHydrator` in the root layout, `useHydrated()` is one flag per page load, and nothing is written before the stored demo is read, so a shell-less page (3A's landing page and demo guide, 3C's verify page) must wait for `useHydrated()` before it shows or changes the store; (3) **city tool pages belong to one role** (section 4's route map): a switch between two city roles keeps the URL only on My queue, Cases, a case and Active permits, and `CityShell` guards the rest, so 4A to 4D build their tool screens for their own role only; (4) **contract, additive**: `PartyStatus.nextTask` (section 5.3), the locked task a waiting party gets next; (5) engine behaviour screens will meet: `complete_task` refuses cards with an action of their own; an ended case offers only `add_note` and its board keeps only Done cards; `pay` has rows for a series' next session and a closed case's final bill; a scheduled meeting is due on its day; the review clock's allowance is the Clerk's due date; the Clerk's `consolidate` task exists, locked, from routing; a closed case releases its hold; a series' session is marked `due` on its day and "Carry your permit" reopens for each session; (6) **seed** (section 6.2): each role's opening queue is asserted row by row, with one planned overdue row each; B16's past sessions are paid; city staff act on working days; (7) `DEMO_PATHS`: every applicant step names its persona, and path 5 ends as the new applicant; (8) `TaskCard`, `WhoIsUp` and `DeptStatusDots` show what the wireframes show (scheduled dates, changes requested, amendment, done dates; a heading, the applicant's name, the waiting party's next task; a glyph per review status). Gate: type-check, lint, 885 tests in 52 files and build pass. Seven questions for the owner are at the end of `docs/readme.md`; the series quote (`dueAtQuote`) is still one of them.
- 2026-10-12: Phase 2 done, with a third workstream added to it: **2D, shared building blocks and Phase 1 review polish**, built beside 2A and 2B because seven screen builders come next and would otherwise each invent their own page headers, cards, fee tables and filter bars. Built: the seed by replay with `tests/seed.test.ts` and `tests/demo-paths.test.ts`, plus the eight engine findings the Phase 1 review left open (2A); the app shell, the Demo menu, the render harness and a placeholder page for all 19 routes not yet built (2B); 13 page and list primitives, 14 case components and the Phase 1 review's polish (2D). Gate on the merged tree: type-check, lint, 760 tests in 49 files and build all pass. What the integration changed, and why: (1) the shell now meets the real seed: `tests/seed.test.ts` checks every Demo menu jump, persona and date jump against `buildSeed()`, and the shell's render tests run on the 38 seeded cases; (2) role and persona switching: picking a persona navigates (the wizard for S2 and for a new applicant, My events otherwise), landing on the Applicant sets the persona of the case the page is about, a Draft is not followed to a city role, two city roles keep the URL with its query string, and a role's remembered page includes its query string; (3) both shells now put the screen inside the page container, so a screen never adds `page-container` (the placeholder overflowed the city layout by the sidebar's width); (4) Reset goes to the Applicant's home, since it puts the role switcher back on the Applicant; (5) the shell uses 2D's `ConfirmDialog`, `PageHeader`, `PersonaAvatar` and `CountBadge`; (6) `WhoIsUp` lists every open action with its own due date (the PRD's "each open action with its due date"; S5's applicant has two), and `CaseHeader` takes a Draft with no date; (7) contracts, all additive or comments: `StateApi` gained `boardColumns`, `whoIsUp`, `involvement`, `actorsFor`, `hasActivePermit`, `holdsDateAtQuote`, `activePermits` and `permitSessions` (section 5.3); `RulesApi.routing` takes an optional config (5.2); `simulate_signoff` may be raised by the applicant (5.4); the Security and medical plan card follows the tier instead of a hardcoded 1,000; comments in `lib/rules/types.ts`, `lib/state/types.ts` and `lib/state/actions.ts` say what the engine does. Declined: `DateGate.daysUntil` as `number | null` (a breaking change for a state the wizard never shows; it is documented as 0 when no date is chosen). Left open for later workstreams: a case routed without a department that reviews one of its cards (4A), submitting a pending amendment (5A), and the hold status of closed cases.
- 2026-10-12: Phase 1 review fixes (18 findings, all high and medium). What they change for later phases: (1) contract, additive: `updateDraft`'s patch takes `lateFee?: boolean`, which sets `flags.lateFee`; this is what the wizard's third gate fix dispatches (3B). `book_and_pay` and `submit` now enforce the tier's lead time and add the "Late fee" line. (2) The store keeps a Draft's sessions, tier and triggers in step with its answers on every edit (`syncDraft()`), so the wizard stores only the date, times and recurrence; 2A's replay should create each Draft with `syncDraft(newCase(...), ctx)`. (3) A block party submitted before its sign-offs are in leaves the Clerk's intake check locked, so S4 shows the applicant up and the Clerk waiting, as the PRD's seed table says. (4) A Reviewed or Special series pays its one-off lines and first session at the quote (`dueAtQuote()`), the rest on schedule (4E), following the PRD's quote section; **this one is open for your confirmation** and is a one-line switch back. (5) Seed scripts: B03, B04, B16 and B19 moved outside their lead times; B05 moved to Thu, May 13 so that the overdue In review case is also at lead-time risk (section 6.2); every case starts with a "Started a draft." activity entry, which gives B01 its one entry. (6) `tests/engines.test.ts` now replays all 38 scripts through both engines (`tests/replay.ts`, test-only until 2A's replay). One part of one finding was not applied: the review clock stays a count of days elapsed, so the due date reads "Day 14 of 14"; counting the routing day as Day 1 would show every review as over its allowance on the day it is due.
- 2026-10-12: Phase 1 done, with workstream 2C (map and calendar) moved into it from Phase 2. Built: the rules engine (1A), the state machine and store (1B), 38 seed scripts with personas and templates (1C), the Rime & Ink design system with `/dev/kit` (1D), and the SVG map, location picker and calendar views with `/dev/map` (2C). Gate on the merged tree: type-check, lint, 320 tests in 31 files and build all pass. What the merge changed, and why: (1) an ended case no longer books its slot, and a series skips a blackout session everywhere (not billed, not held, not an event day); (2) `create_board` lists the sessions through `occurrences()`, and `book_and_pay` and `accept_complete` check every held session from setup to teardown; (3) a request for information parks the asking department's own review until the applicant answers, which is what makes "Who's up" show only the applicant for S3; (4) the Clerk's Issue permit and Reconcile tasks unlock and finish when they should, "Carry your permit" is done after the event, and `caseTotals()` settles the deposit at reconciliation; (5) a Draft keeps the tier its answers classify to (`classifyDraft()`), so lists and `availableActions()` can trust `case.tier` before the plan is confirmed; (6) contract: `nextMove` takes an optional applicant name (section 5.3), and `Closeout.balance` is documented as the amount over the estimate; a `pickable` flag on `Persona` was declined because `scenario` already identifies the picker's personas; (7) nine seed scripts were corrected against the real engines (payment totals, missing Special-event plans, two slot collisions with PRD cases, an expired hold) and S6's history was completed to match the PRD's board. Not done here, by design: the seed replay, `buildSeed()` and the demo-path tests stay with workstream 2A.
- 2026-10-12: Phase 0 done. What changed from the plan as written: (1) Next.js 16.4 ships with Cache Components on, so every page is a thin server component rendering one client screen in `<Suspense>` (rule and example in `CLAUDE.md`); (2) the contracts also cover `lib/dates.ts`, `lib/rules/types.ts` and `lib/state/types.ts`, which define `RulesApi` and `StateApi` interfaces that the barrels must satisfy; (3) `transition()` takes a `now` on its context for activity timestamps and may return `spawned` cases (for "Book again"); (4) actions gained `complete_city_task`, and `accept_and_sign` no longer lists condition ids (it accepts all); (5) computed due dates that land on a weekend move to the Friday before, which reproduces the PRD's Fri, May 7 closeout date; (6) the guard test also enforces the no-imports-between-surfaces rule; (7) `components/shell` counts as shared.
- 2026-10-12: Approved. Build runs through Phase 6 without visual checkpoints; no deploy; Playwright replaced by jsdom render tests (`tests/render/`), so `@testing-library/react` and `jsdom` join the Phase 0 dependencies. The "Checkpoint" lines in section 8 are now notes for the final hand-off, not stops.
- 2026-10-12: Plan created. Phase boundaries differ from the PRD's five milestones so that work can run in parallel: the PRD's milestone 1 is phases 0 to 2, milestones 2 and 3 are Phase 3, milestone 4 is Phase 4, and milestone 5 is phases 5 and 6.

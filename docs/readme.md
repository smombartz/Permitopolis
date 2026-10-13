# Permitopolis prototype: reference

Architecture, integrations and decisions worth remembering. The full plan, with the reasoning, is in
`docs/plans/2026-10-12-permitopolis-prototype.md`.

## Stack (versions installed on 2026-10-12)

| Package | Version | Notes |
|---|---|---|
| Next.js | 16.4.0 | App Router, Turbopack, Cache Components and Partial Prefetching on (scaffold defaults) |
| React | 19.3.0 | |
| TypeScript | 5.9 | |
| Tailwind CSS | 4.3 | Loaded through `@tailwindcss/turbopack`; tokens in `styles/tokens.css` |
| shadcn/ui | CLI 4.21, style `radix-nova` | Components in `components/ui`, on the unified `radix-ui` package |
| Zustand | 5 | One persisted store, key `permitopolis-demo-v1` |
| date-fns | 4 | Only through `lib/dates.ts` and `lib/format.ts` |
| Vitest | 5 | Two projects: `unit` (node) and `render` (jsdom) |
| pnpm | 10.30 | |

## Architecture

- **One record.** An `EventCase` (`lib/types.ts`) carries an event from the first wizard answer to
  closeout. Tier, state, the applicant's board and the city's queues are views of it.
- **Rules derive, transitions apply.** `lib/rules` is pure: classify, routing, requirements (the
  card catalogue), fees, availability, the date gate. `lib/state` applies every change through one
  `transition(case, action, actor, ctx)`, which never derives a rule except availability for "the
  first complete application wins".
- **Tasks drive "waiting on".** The applicant's cards and the city's outstanding actions are the
  same `Task` objects filtered by owner. `waitingOn(case)` is computed, never set by hand.
- **Seed by replay.** Each seeded case is a script (answers plus dated actions) replayed through the
  real engine, so no seeded case can disagree with the rules. `buildSeed()` returns the 38 cases.
- **Screens are thin.** A page is a server component that renders one client screen in `<Suspense>`.
  Screens read the store and call pure view-models in `lib/view`. The shell (`components/shell`)
  frames every applicant and city screen.
- **Surfaces do not import each other.** They hand off through `lib/routes.ts` and store actions.
  `tests/guards.test.ts` enforces this, along with "no raw color values outside the tokens".

## Decisions

- **Rime & Ink replaces the PRD's look and feel.** Indigo is the only action color. Parties and
  tiers get identity tints on small avatars, dots and outline badges, always with icon and label.
- **Tertiary text is decoration only.** It measures 2.6:1 on the page. `fg-label` (ink 650, 7.3:1)
  was added for labels, table headers and metadata.
- **Quiet glass in the app.** Full atmosphere on the landing page; in the app, blur is for chrome.
- **Fixed demo date.** Nothing reads the real clock; lint rejects `new Date()` and `Date.now()`.
- **Next.js 16 with Cache Components.** A client component that reads the URL must sit under
  `<Suspense>` or the build fails, hence the page pattern in `CLAUDE.md`.
- **Dropbox.** `node_modules` and `.next` carry the `com.dropbox.ignored` attribute so they do not
  sync. Set it again if either folder is deleted and recreated:
  `xattr -w com.dropbox.ignored 1 node_modules .next`.
- **No deploy, no browser tests.** Runtime checks are jsdom render tests in `tests/render/`.

## Building a screen (Phase 2)

Everything a screen needs is in place: the seed, the shell, a render harness and a shared set of
components. Start here, then read "How the engine behaves" for the engine's finer points.

### The page and the shell

- **Every route already has a `page.tsx`** that renders `PlaceholderScreen`. To build a screen,
  swap the placeholder for your `'use client'` screen and keep the `<Suspense>`:

  ```tsx
  // app/city/queue/page.tsx
  import { Suspense } from "react";
  import { QueueScreen } from "@/components/city/lists/QueueScreen";

  export default function Page() {
    return (
      <Suspense fallback={null}>
        <QueueScreen />
      </Suspense>
    );
  }
  ```

- **The layouts mount the shell.** `/apply` and `/events/**` sit in `AppShell`; `/city/**` sits in
  `CityShell`. `/`, `/demo`, `/verify/[id]` and `/dev/*` have no shell, so those screens bring
  their own `<main className="page-container ...">` (their placeholders pass `standalone`).
- **What a shell gives a screen**: the top bar, the `<main>` landmark, a skeleton until
  `useHydrated()` is true, the storage-blocked banner, the page container with `py-6`, and in the
  city the sidebar. So a screen inside a shell starts with its `PageHeader`, reads the store
  directly, and never adds `page-container`, a `<main>`, or a hydration gate of its own.
- **Each shell guards its area.** `AppShell` renders the screen only for the Applicant and
  `CityShell` only for a city role; any other role gets a panel offering to switch. A city screen
  still has to work for all three city roles, because two city roles share every city URL.
- **`AppShell` and `CityShell` are siblings, not nested.** Each wraps the same top bar, skeleton
  and banner around the opposite guard.
- **A screen with no shell that reads the store** (`/verify/[id]`, the demo guide if it shows live
  state) gates on `useHydrated()` itself: render `PageSkeleton` until it is true.
- **Unknown case id**: render `<CaseNotFound id backHref backLabel />` from `@/components/shell`.
  The id comes from `useParams()`, so it is only known on the client; `notFound()` is not needed.
- **Below 768 px** the role switcher and persona picker collapse into one menu button. The top
  bar picks one or the other with `useIsNarrow()` (a `matchMedia` check), not with CSS alone.
  Do the same for any control you would otherwise render twice: the render tests run without
  CSS, so a `hidden md:flex` pair leaves both in the DOM and every `getByRole` ambiguous.

### Switching role and persona

- **The rule** is `resolveRoleSwitch()` in `lib/view/shell.ts`, used through `useRoleSwitch()`:
  - Two city roles keep the URL, query string included. Nothing navigates; the screen re-renders
    for the new role.
  - The Applicant and a city role follow the case on screen: `/events/[id]...` to
    `/city/cases/[id]` and back. A Draft does not follow to the city; no city role can see it.
  - Off a case page, the switch goes to the role's last page (`lastPathByRole`, query string
    included, kept by the shells), then to its home (`homeFor(role)`: `/events` or `/city/queue`).
  - Landing on the Applicant sets the persona to the applicant of the case the page is about, so
    a board never shows one organizer's event under another's name. That can be a persona the
    picker does not offer (a filler or background case); the picker then lists it first.
- **Picking a persona navigates** (`usePersonaSwitch()`, rule in `pathForPersona()`): a blank
  wizard for someone with no event yet (New applicant), the wizard where it was left for someone
  whose only event is a draft (S2 opens at step 3), My events for everyone else.
- **Call the hooks, not the setters.** `useRoleSwitch()` and `usePersonaSwitch()` are exported
  from `@/components/shell`. `setRole()` and `setPersona()` change the store and leave the page
  where it is.
- **Reset** restores the seed, the date, the Applicant role and the New applicant persona, then
  goes to `/events`.
- **Still to handle in a screen**: a typed-in URL can show an applicant page under another
  persona; render the case by its id all the same. The wizard must cope with `?case=` naming a
  case that is no longer a Draft (S2's jump after it has been booked): send it to its board.

### Demo script data (`lib/data/demoScript.ts`)

- **`SCENARIO_JUMPS`**: the Demo menu's six jumps. Each has `id`, `label`, `caseId`, `role`,
  `personaId` (always the case's applicant), `path` and `state` (the PRD's "Up on May 3" line).

  | Jump | Case | Opens as | Page |
  |---|---|---|---|
  | S1 | `PMT-27-0109` | Applicant, Maya Chen | `/events/PMT-27-0109/permit` |
  | S2 | `PMT-27-0142` | Applicant, Sunrise Yoga Club | `/apply?case=PMT-27-0142&step=when` |
  | S3 | `PMT-27-0118` | Applicant, Downtown Arts Collective | `/events/PMT-27-0118` |
  | S4 | `PMT-27-0126` | Applicant, Maple Street block captain | `/events/PMT-27-0126` |
  | S5 | `PMT-27-0097` | City Clerk | `/city/cases/PMT-27-0097` |
  | S6 | `PMT-27-0031` | Public Works & Safety | `/city/cases/PMT-27-0031` |

- **`DEMO_DATE_JUMPS`**: the "Set demo date" quick jumps (May 3, Jun 18, Jul 11).
- **`DEMO_PATHS`**: the PRD's seven demo paths as `{ id, title, priority, scenario, summary,
  steps: [{ role, persona?, text }] }`, for the demo guide (3A) and for demo hints. Hints are on
  when `useDemo((s) => s.hints)` is true.
- `tests/seed.test.ts` holds all three to the seed: every jump's case exists, in the state the
  PRD's seed table gives it, with the role, page and persona above; every date jump is its
  scenario's event day.

### Render tests

- Render tests live in `tests/render/<surface>.test.tsx` (jsdom). `tests/render/setup.ts` mocks
  `next/navigation` (`useRouter`, `usePathname`, `useParams`, `useSearchParams`, `notFound`,
  `redirect`) and `next/link` for all of them. Pure view-models are tested next to the file, in
  `lib/view/<surface>.test.ts` (node).
- **Use `renderScreen()` from `tests/render/harness.tsx`**, never `render()` and never your own
  navigation mock. It resets the store to the real seed (all 38 cases on Mon, May 3, 2027),
  applies your options, points the navigation mock at the page and flushes hydration.

  | Option | Effect |
  |---|---|
  | `scenario: "S5"` | The role, persona and page of that Demo menu jump |
  | `path` | The page's href; a query string becomes `useSearchParams()`, so pass a `lib/routes.ts` link |
  | `params` | Route params; `{ id }` is read off an event, case or verify path when left out |
  | `search` | Extra search params |
  | `role`, `personaId`, `demoToday` | Set as given, over what the scenario set |
  | `cases` | Replaces the seed with hand-built cases (`makeCase`, `makeTask` in `lib/state/testSupport.ts`) |

  It returns the testing-library result plus `user` (a user-event session). Also exported:
  `lastPush()`, `lastReplace()`, `switchRole(role)` and `storedCase(id)`.

  ```tsx
  // tests/render/case-detail.test.tsx
  import { screen } from "@testing-library/react";
  import { describe, expect, it } from "vitest";
  import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
  import { renderScreen, storedCase, switchRole } from "./harness";

  describe("case detail", () => {
    it("S5: shows the Clerk both parties that are up", async () => {
      await renderScreen(<CaseDetailScreen />, { scenario: "S5" });

      expect(screen.getByRole("heading", { level: 1, name: "Riverfront Summer 5K" })).toBeInTheDocument();
      expect(screen.getAllByText("Up now")).toHaveLength(2);
    });

    it("S5: Health & Legal verifies the insurance certificate", async () => {
      const { user } = await renderScreen(<CaseDetailScreen />, { scenario: "S5" });
      switchRole("hl");

      await user.click(screen.getByRole("button", { name: "Verify" }));

      const card = storedCase("PMT-27-0097").tasks.find((t) => t.catalogId === "insurance_certificate");
      expect(card?.status).toBe("done");
    });
  });
  ```

- **Assert on the store, not only on the screen**: after a click, check `storedCase(id)`.
  `tests/demo-paths.test.ts` shows the exact dispatches of each demo path and what every role
  sees after each step; read your path's test before building its screens.
- To move the seed forward in time the way the Demo menu does, call
  `useDemo.getState().setDemoToday(date)` inside `act()`. The `demoToday` option only sets the date.
- A test that mocks `lib/state/seed` must also provide `seedFingerprint`.
- `tests/render/blocks-seed.test.tsx` renders the shared case components for all 38 seeded
  cases. If you change one of them, it tells you which seeded case it breaks on.

### Shared components: which one for what

All of these are presentational: props in, no store. Import primitives from
`@/components/ui/<file>` and domain components from `@/components/domain`. `/dev/kit` shows each
one in every state. Reach for these before writing markup of your own.

| Use | For |
|---|---|
| `PageHeader` | The top of every screen: eyebrow, the page's one `<h1>`, description, an actions slot, and a back link (`backHref`, or `onBack` when there is no URL) |
| `CaseHeader` | The top of a screen about one case, in place of `PageHeader`: name, tier, id, applicant, date, days to go, stepper, hold and review clock |
| `Section` | A titled block inside a screen (`<h2>`), with its own actions slot |
| `KeyValueList` | Facts about a record; a missing value reads "Not provided" |
| `Toolbar` | A row of actions above a list or table |
| `FilterBar`, `FilterChip` | The filter row of a list: toggle chips, one select, search, result count, Clear filters. Keep the filter values in the URL |
| `CountBadge` | A number on a nav item or tab |
| `StickyAside` | The right-hand panel that stays in view (a case's action panel). It sticks 5 rem down, clear of the top bar |
| `ConfirmDialog` | Every "are you sure": withdraw, cancel, deny, reset. Never `window.confirm` |
| `InlineAlert` | A short message inside a card or under a value. `Banner` is for page-level messages and `Field`'s `error` for a form field |
| `Progress` | A labeled bar: sign-offs, payment schedules, checklists |
| `WizardStepper` | The wizard's five steps; done steps call `onStepSelect` |
| `Truncate` | A long name on one or two lines, with the full text in its tooltip |
| `CopyButton` | Copy a case id or a permit link |
| `EmptyState`, `PageSkeleton`, `Banner`, `Callout` | From Phase 1: an empty list, loading, a page-level message, an aside |
| `TaskCard`, `StackedTaskCard` | The applicant board's cards. A card with an open request shows as pinned with the reviewer's message. Pass `unlockHint` for a locked card. `StackedTaskCard` is the "Vendor health permits · 25 of 25" stack |
| `WhoIsUp` | The case detail's centerpiece: `items={waitingOn(c, today)}` and `nextMove={nextMove(c, today, applicantName)}`. It lists every open action with its due date; `onSelectTask` makes them buttons |
| `WaitingOnChips`, `DeptStatusDots` | The compact forms for a table row: who is up, and each department's review status |
| `FeeTable` | Fee lines by department with subtotal, deposit and total. `showActual` adds Actual and Difference for closeout |
| `ConditionList` | Conditions by department. `editable` adds the "I accept" checkboxes for the quote |
| `ActivityTimeline` | The activity log; pass the items in the order to show, and `collapsedCount` for "Show all" |
| `EndingBanner` | A case that ended: Withdrawn, Denied, Cancelled or Hold expired, with `case.endingReason` |
| `EventTitle` | A list row's identity cell: event name over applicant name, both truncated |
| `LeadTimeRisk` | The lead-time flag: `risk={leadTimeRisk(c, today, cfg)}`. Renders nothing when "ok" |
| `AvailabilityBadge` | Open, Impacted, Booked or Blackout for a place and date |
| `TaskKindLabel`, `PersonaAvatar`, `PartyAvatar`, `PartyChip`, `TierBadge`, `StateChip`, `StateStepper`, `HoldStatus`, `ReviewClock`, `DueDate`, `Money`, `DateText`, `CaseId` | The small pieces. Use them wherever a tier, state, party, date, amount or id appears, so each reads the same on every screen |

- `CaseHeader` and `ReviewClock` take `{ dayCount, allowedDays, paused, pausedDays }`. Map it
  from the selector: `const rc = reviewClock(c, dept, today)`, then `{ dayCount: rc.day,
  allowedDays: rc.of, paused: rc.paused, pausedDays: rc.pausedDays }`. Pass `null` before routing.
- `CaseHeader` takes `eventDate={eventDate(c, today)}`, which is null for a Draft with no date.
- `PartyChip` is neutral now: the party's hue is on its avatar tile only.
- `StateStepper compact` shows the current state's label under its dots.
- A new raw `<button>` or link gets the system focus ring:
  `outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`.
- `FilterBar`'s select is a native `<select>`. Use the Radix `Select` where options need groups
  or icons.

### Selectors (`@/lib/state`)

Every one is pure. Read cases, the date and the config from the store
(`useDemo((s) => s.cases)`, `s.demoToday`, `s.cfg`) and pass them in. The contract is
`StateApi` in `lib/state/types.ts`.

| Surface | Selectors |
|---|---|
| My events, board | `applicantCases(cases, personaId)`, `boardColumns(c)` (cards by column, Do now in the PRD's order), `boardColumn(task)`, `taskDueDate(task)`, `eventDate(c, today)`, `daysUntilEvent(c, today)`, `caseTotals(c)` |
| My queue | `queueFor(cases, role, today)`: `{ case, task, group, daysWaiting }`, oldest due first; `waitingOnOthers(cases, role, today)` |
| Cases pipeline | `isVisibleToCity(c)`, `isOpen(c)`, `involves(c, role)`, `involvement(c, party)`, `whoIsUp(c, today)`, `leadTimeRisk(c, today, cfg)`, `reviewClock(c, dept, today)` |
| Case detail | `waitingOn(c, today)`, `nextMove(c, today, applicantName)`, `availableActions(c, role, { today, cases, cfg })`, `actorsFor(type)` |
| Active permits | `activePermits(cases, today, { includeHolds })`, `permitSessions(cases, { from, to, includeHolds })` (one entry per held session, for the calendar and map), `hasActivePermit(c)`, `holdsDateAtQuote(c)`, `sessionDates(c)`, `isSessionDate(c, date)`, `lastSessionDate(c)` |
| Store | `useDemo`, `useHydrated()`, `demoToday()`, `buildSeed()` |

- A screen changes a case only with `useDemo.getState().dispatch(caseId, action)`. It acts as
  the current role and returns `{ ok, reason }`; show the reason when it is refused.
- The applicant's name for a case is `PERSONA_BY_ID[c.applicantId].name` (`lib/data/people.ts`).

## How the engine behaves

Things a screen builder needs to know that the type signatures do not say.

**Rules (`lib/rules`)**

- **Routing is not the same as `classification.reviewers`.** `classify()` lists the Clerk as a
  reviewer on every Special event (coordination). `routing(answers, cls, cfg?)`, which prefills
  the Clerk's `confirm_routing`, adds the Clerk only for alcohol. Prefill from `routing()`, and
  pass the store's config: the crowd reason quotes the configured threshold.
- **The date gate** (`dateGate()`): `fixes` is empty when the gate passes. A date that is only
  too close offers a new date, dropping an add-on (when `droppable` has one) and the late fee. A
  date that is booked or blacked out offers a new date and nothing else. With no date chosen
  yet nothing fails, and `daysUntil` is 0.
- **Cards follow the tier, not a number.** The Security and medical plan card is created for a
  Special event; a crowd at the configured threshold is Special already.
- **Fee lines have fixed labels**: "Application fee", "Shelter reservation", "Field reservation",
  "City Hall Plaza reservation", "Great Lawn reservation", "Street closure", "Route closure",
  "Amplified sound", "Temporary alcohol license", "Food or vendor permit", "Structure fire
  inspection", "Police", "Barricades", "Refundable cleanup deposit", "Late fee". Code that needs
  one line finds it by label; `cancellationRefund()` does so for the application fee.
- **A series is billed per session.** `estimateFees()` returns `perSession`, `sessions` and
  `dueNow` (the first session, plus the one-off lines for a Reviewed or Special series, plus a
  late fee); the fee line itself carries the whole series.
- **Every space booked is billed.** Fields 1 and 2 for six hours is one "Field reservation" line
  of 12 hours, $240. The kind of space comes from `lib/data/inventory.ts`, not from its id.
- **What takes a slot**: a date hold, or a live permit (Permitted, Event day, Closeout). A case
  with an ending never does, so cancelling a permit frees its date.
- **A series skips a blackout session.** `occurrences()` marks it `skipped`: it is not billed,
  not held and not an event day.

**State (`lib/state`)**

- **A Draft keeps its tier and its sessions.** `syncDraft()` runs on `createDraft` and on every
  `updateDraft`: it lists the schedule's sessions through `occurrences()` (so `schedule.occurrences`
  is always the series as it stands, each session with its availability, blackout sessions
  `skipped`) and then sets tier and triggers. The wizard stores the date, the times and the
  recurrence, and can leave `occurrences: []`; `estimateFees(draft, ...)` then counts 13 sessions
  for S2 without the wizard listing them. `create_board` still has to run (again, after an edit)
  to build the cards and the fee lines; it keeps the progress on cards that still apply, takes the
  payment card from the new plan, and re-locks Submit application when the edit added a card.
  `book_and_pay` never trusts an existing board: it rebuilds it from the answers every time.
- **The lead time is enforced, not only shown.** `book_and_pay` and `submit` refuse a date inside
  the tier's lead time ("Needs 30 days of notice; pick a later date or add the late fee."). The
  gate's third fix is `updateDraft(id, { lateFee: true })`, which sets `flags.lateFee`: the date
  then goes through and the fee lines carry a "Late fee" line (added by `create_board`,
  `book_and_pay` and `submit`). The fee is charged only while the date really is inside the lead
  time, so a flag left on after the applicant picks a later date costs nothing. Clear it with
  `{ lateFee: false }` all the same.
- **`availableActions()` is the role's action panel**, not every action. Actions on one card
  (`complete_task`, `respond_to_request`, `verify_document`, `reject_document`, `schedule_meeting`,
  `complete_city_task`) belong on that card's own control and are dispatched directly. It also
  offers `request_info` (the Clerk at intake; a reviewer while its review is open) and
  `review_decide` for the Clerk's own license review, ahead of the quote.
- **Who may act.** `transition()` refuses an action from a party that may not raise it ("Only
  the City Clerk can issue the permit."); `actorsFor(type)` lists the parties. `dispatch()` acts
  as the current role unless given an actor.
  - `add_note` and `remind` are for city roles. `simulate_signoff` is accepted from the applicant
    as well as a neighbor, because the demo button sits on the block captain's own card.
  - `verify_document` and `reject_document`: the card's reviewer, or the department whose
    request the card answers.
  - `schedule_meeting`: the meeting's department or the Clerk. It accepts the Clerk's
    `schedule_pre_application_meeting` task id and puts the date on the applicant's card. A
    meeting can be moved until it is held.
  - `complete_city_task` closes a work order (its owner), a meeting that was held (its
    department or the Clerk), or a `verify:*` task (which also accepts the card). Every other
    city task is finished by its own action; the refusal names it.
  - `confirm_routing` needs at least one reviewer, and each department once.
- **Who's up.** `waitingOn().openTasks` and `queueFor()` are oldest due first; a task with no
  date goes last. A department named on cards before routing is `waiting`, "Starts when the City
  Clerk routes the case"; once the case is routed without it, it is `not_involved`. A waiting
  party's note says what its next task waits for ("Unlocks when the quote is ready"). `nextMove()`
  names the waiting party whose task unlocks soonest: after closeout hours, the Clerk reconciles
  before the applicant's final bill.
- **Money is to the cent** everywhere: fee lines, totals, refunds and the paid-in-full check.
  Paying a quote in full clears `dateHold.expiresOn`; show "Pay by" only while it is set.
- **`amend`** takes only the answer fields of its payload, lists the new schedule's sessions and
  runs the date gate again. It refuses inside the new tier's lead time without `lateFee: true`,
  but only when the tier rises or the date moves. It replaces the plan's fee lines, keeps lines a
  reviewer added and tags new cards `amendment`. State, permit and hold stay as they are.
- **City task ids**: `review:<dept>`, `verify:<card suffix>` (for example
  `verify:vendor_health_permit:1`), `work_order:<barricades|police|closure|trash|power>`, and the
  plain ids in `CITY_TASKS`. Meeting cards belong to the applicant and are closed by the city with
  `complete_city_task`.
- **A request parks the asker.** While a department waits on the applicant, its own review (or
  the Clerk's intake check) is `locked` with `payload.awaitingAnswer`, so it leaves the queue and
  "Who's up" shows the applicant alone. The answer gives it back. A card with an open request is
  due on the request's date: use `taskDueDate(task)`. Only the Clerk at intake, or a department
  whose review is still open, can ask; a request for a card that does not exist is refused.
- **A block party waits on its neighbors, not the Clerk.** Submitted with sign-offs still out,
  the Clerk's intake check is created `locked` with `payload.awaitingSignoffs` and no due date
  (S4: the Clerk reads "Waiting on 3 neighbor sign-offs" and has nothing in its queue). The last
  sign-off opens it and starts its three days.
- **A card "With the city" always has someone tasked.** While a department's own `review:<dept>`
  task is open, that review covers every card sent to it. Once it is decided, each card uploaded
  to that department gets its own `verify:<card suffix>` task, from routing through Event day (a
  vendor's health permit usually arrives after the permit). A second upload reopens the same
  verify task. Answers to the Clerk's own intake requests are accepted by `accept_complete`.
- **A reviewer's denial goes to the Clerk.** `review_decide` with `deny` finishes that
  department's review task and gives the Clerk a `consolidate` task titled "Decide: a reviewer
  denied" (`payload.denied`). `send_quote` then says which department denied; Deny is the move.
- **The review clock** counts days elapsed since routing, less days paused, so the due date
  (routing plus the allowance) reads "Day 14 of 14" and the next day is over. It stops on the day
  the department decides. A second request while it is paused keeps the first pause's start.
- **`nextMove(case, today, applicantName)`** takes the persona's name for the "Next:" sentence.
- **Issue permit** is a Clerk task created locked by `send_quote`. It unlocks when the case is
  signed, the quote is paid and the insurance card is done, whichever comes last. Re-uploading
  verified insurance locks it again until Health & Legal has checked the new certificate.
- **What a quote asks for** is `dueAtQuote(case, cfg)` in `lib/state/core.ts`: everything for a
  single event; for a series, the one-off lines and the first session, with the later sessions
  billed on schedule (the PRD's "first session now and the rest on schedule"). It is the amount on
  the `pay_fees` card, and what Issue permit and the hold's expiry test. Paying it marks the first
  session `paid`. This follows the PRD's wording and is awaiting the owner's confirmation; to
  charge a whole series up front instead, make `dueAtQuote` return `caseTotal(c)`.
- **Payments.** `pay` takes `quote`, `session` and `final_invoice` only, each in the state it
  belongs to, and never an amount of $0 or less. A part payment of a quote leaves `pay_fees` open
  with the balance as its amount. `withdraw` after a payment refunds what was paid.
- **Money after the event.** `closeout.balance` is what the event ran over the estimate and
  `closeout.refund` what goes back from the deposit (null when a final bill is owed; the amount is
  on the `final_bill_or_refund` card). After reconciliation `caseTotals()` no longer counts the
  deposit, so `due` is what is really owed. An ended case owes nothing. An Instant event has no
  final-bill card until its closeout exception carries a charge; `reconcile_close` then adds one.
- **A new case has one activity entry**, "Started a draft.", written by `newCase()`.
- **`useHydrated()` is false on the server and on the first client render**, then true once the
  stored demo has been read (or at once after mount when storage is blocked). Render the skeleton
  until it is true, and read `storageOk` only after that.
- **Not done yet**: a series' later sessions are never marked `due` by the clock (workstream 4E
  owns the payment schedule).

**Seed and demo paths (`lib/state/seed`)**

- **`buildSeed()`** (from `@/lib/state`) returns all 38 cases as they stand on Mon, May 3, 2027,
  in case-id order. It replays `SEED_SCRIPTS` once (about 12 ms) with `replayScripts()` in
  `lib/state/seed/replay.ts` and returns a deep copy per call, so `reset()` is exact. To change
  a seeded case, edit its script, never the case.
- **Replay order.** Scripts are replayed together in time order, with the clock advanced for
  every case between steps. A step the engine refuses throws `SeedReplayError` (script key, step
  number, reason), so a broken script fails at load.
- **A stored demo belongs to its seed.** The persist `version` is `seedFingerprint()`. A demo
  saved by an earlier build is dropped on load and replaced by the fresh seed. The key is still
  `permitopolis-demo-v1`.
- **`tests/seed.test.ts`** holds the seed to the PRD's seed table, plan 6.2 and the Demo menu's
  jumps. **`tests/demo-paths.test.ts`** runs the PRD's seven demo paths through the store and
  checks `reset()` against a fresh seed after each.
- **Where the seed differs from the PRD's wording**: S4's routing reasons read "Block party" and
  "City services" (the PRD says "closure, barricades"); F7 is named "Brightline Logistics
  company picnic"; "missing insurance" (F5, B03) is a JPEG uploaded as the certificate, because
  Submit needs every pre-submit card in; Shelter 2 is not open on May 31 (blackout) and is
  impacted on Jul 11 (the 5K), and no case books it.

**Open items for later workstreams**

- **A case routed without a card's reviewer** leaves that card with nobody tasked (B22, a denied
  case, routes only Public Works & Safety while its insurance card names Health & Legal). The
  routing panel (4A) should not let the Clerk drop Health & Legal while an insurance card
  exists, or `confirm_routing` should refuse.
- **A pending amendment's `submit_application` card cannot be submitted**, because `submit`
  needs a Draft. Workstream 5A owns that flow.
- **A closed case keeps `dateHold.status: "held"`**, so `HoldStatus` reads "Date held" on it.
- **`classify()`'s summary phrases** ("about 3 weeks", "about 2 months") are fixed copy from the
  PRD, not derived from the config.
- **A role switch that navigates** sets the role before the new page arrives, so the old page's
  "built for" panel may show for a moment. Not checked in a browser yet.

**Design system (`components/ui`, `components/domain`)**

- `Button` variants are `primary` (the default), `secondary`, `dark`, `ghost`, `destructive` and
  `link`; sizes are `sm` (36 px), `default` (44 px), `lg` (56 px) and three icon sizes. There is no
  `outline` or `default` variant.
- Toasts come from `components/ui/sonner.tsx`. `Sheet` becomes a bottom sheet under 640 px.
  `TableCell` takes `numeric` for mono, tabular figures. `FileDrop` produces `FileRef` values only
  and needs a `sample` file for its "Use sample file" button.
- Domain components are presentational and never read the store. `ReviewClock` takes
  `{ dayCount, allowedDays, paused, pausedDays }` (map it from `reviewClock()`), and
  `WaitingOnChips` takes `{ items: { party, days }[] }` (map it from `waitingOn()`).
- The components added in Phase 2, and which to use for what, are listed under "Building a
  screen (Phase 2)".
- A tier is never shown by a dot alone: calendar items carry the tier icon, and the map has a
  legend and spells the tier out in its list.
- `/dev/kit` and `/dev/map` show every primitive, domain component, map mode and calendar view.
  Neither is linked from the app.

**Map and calendar (`components/map`, `components/calendar`)**

- One SVG unit is one foot, so a drawn rectangle's area is its square footage.
- `LocationPicker` takes `availabilityOf?: (location) => Availability | undefined`; the wizard
  passes `rules.availability` through it.
- The area drag uses pointer capture and ends on `pointerup` and `pointercancel`. Its rectangle
  carries `data-testid="area-active-rect"` for render tests.
- `LocationPicker` is controlled: what is pressed or drawn is read from `value`, so pass back what
  `onChange` gives you. Switching tabs calls `onChange` with that tab's own selection (null when
  it has none; the Draw an area tab always has its rectangle). A picker that opens on Draw an
  area with no value shows a dashed starting rectangle and "No area chosen yet"; it becomes the
  value when the applicant drags or sizes it. The picker never calls `onChange` on mount, so a
  Draft that loads a moment later is not overwritten.
- The SVGs are `aria-hidden`. Every map function is also in the list or the number inputs beside
  it, which is the keyboard and screen-reader path.

**Tooling**

- ESLint ignores `.claude/`, where agent worktrees (full copies of the repo, each with its own
  `.next`) are created.
- `tests/engines.test.ts` runs the rules engine and the state machine together with nothing
  mocked. Their own unit tests mock each other. It also replays all 38 seed scripts with
  `replayScripts()` and checks that every case reaches its expected tier, state and ending.
- After `pnpm install`, check that `node_modules` still carries the Dropbox attribute (see
  Decisions): `xattr -p com.dropbox.ignored node_modules`. An install that rebuilds the folder
  drops it; it was missing on the main tree after the Phase 2 merge and was set again.
- `tests/guards.test.ts` also fails on `text-fg-tertiary` used for anything but a placeholder. A
  purely decorative use carries a `guard-allow-tertiary` comment on its line.

## Reference data

Fictional and kept in `lib/data/`: eight bookable spaces in Riverside Park, the Great Lawn, City
Hall Plaza; Main Street (five blocks), River Road (four stretches; with Main Street it makes the
3.1-mile 5K loop), and residential Maple, Elm and Oak. Fees, the cancellation schedule and the
calendar's blackout and impacted dates are placeholders from the PRD.

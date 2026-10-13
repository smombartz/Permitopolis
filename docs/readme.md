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
- **Dropbox.** `node_modules`, `.next` and `.claude/worktrees` (where a phase's builders work, each
  with its own `node_modules`) carry the `com.dropbox.ignored` attribute so they do not sync. Set it
  again if a folder is deleted and recreated:
  `xattr -w com.dropbox.ignored 1 node_modules .next .claude/worktrees`.
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
  directly, and never adds `page-container`, a `<main>`, or a hydration gate of its own. Until
  the stored demo has been read the top bar shows the wordmark and placeholders only: the role,
  the persona and the date all come from the store.
- **Each shell guards its area.** `AppShell` renders the screen only for the Applicant and
  `CityShell` only for a city role; any other role gets a panel offering to switch.
- **Which city pages are whose** (the PRD's route map). My queue, Cases, a case and Active
  permits (`/city/queue`, `/city/cases`, `/city/cases/[id]`, `/city/active`) are shared: a screen
  there has to work for all three city roles, because a switch between them keeps the URL. The
  tool pages belong to one role each: Intake, Payments and Settings to the City Clerk; Closures
  and routes and Work orders to Public Works & Safety; Verifications and Inspections to Health &
  Legal. A tool screen is built for its own role only. `CityShell` shows "This screen is built
  for ..." when another city role types its URL in, and never remembers it as that role's last
  page. `cityToolOwner(href)` and `cityPageIsFor(role, href)` in `lib/view/shell.ts` are the rule.
- **`AppShell` and `CityShell` are siblings, not nested.** Each wraps the same top bar, skeleton
  and banner around the opposite guard.
- **The stored demo is read on every route**, once per page load: the root layout mounts
  `<StoreHydrator />`, and `useHydrated()` is one flag for the whole page load. A shell that
  mounts later (the applicant's and the city's layouts are separate, so a role switch or a hop
  from the wizard to a board remounts it) starts hydrated: no second skeleton, no second read.
- **A screen with no shell that reads the store** (`/`, `/demo`, `/verify/[id]`) gates on
  `useHydrated()` itself: render `PageSkeleton` until it is true, as `PlaceholderScreen
  standalone` does. **It must not change the store before then either.** Nothing is written to
  localStorage until the stored demo has been read, so a `setRole()` or `setPersona()` made
  earlier is made to the in-memory seed and replaced a moment later by the stored demo. Enable a
  door or a jump only once `useHydrated()` is true.
- **Unknown case id**: render `<CaseNotFound id backHref backLabel />` from `@/components/shell`.
  The id comes from `useParams()`, so it is only known on the client; `notFound()` is not needed.
- **Below 768 px** the role switcher and persona picker collapse into one menu button. The top
  bar picks one or the other with `useIsNarrow()` (a `matchMedia` check), not with CSS alone.
  Do the same for any control you would otherwise render twice: the render tests run without
  CSS, so a `hidden md:flex` pair leaves both in the DOM and every `getByRole` ambiguous.

### Switching role and persona

- **The rule** is `resolveRoleSwitch()` in `lib/view/shell.ts`, used through `useRoleSwitch()`:
  - Two city roles keep the URL, query string included, on a page they share. Nothing
    navigates; the screen re-renders for the new role. From one role's tool page (the Clerk's
    Intake, say) the other role goes to its own last page, then to its queue.
  - The Applicant and a city role follow the case on screen: `/events/[id]...` to
    `/city/cases/[id]` and back. A Draft does not follow to the city; no city role can see it.
  - Off a case page, the switch goes to the role's last page (`lastPathByRole`, query string
    included, kept by the shells), then to its home (`homeFor(role)`: `/events` or `/city/queue`).
  - Landing on the Applicant sets the persona to the applicant of the case the page is about, so
    a board never shows one organizer's event under another's name. That can be a persona the
    picker does not offer (a filler or background case); the picker then lists it first.
  - A page opened under the wrong role (a typed or shared link) shows the shell's "built for"
    panel. Switching from there to a role the page is built for stays on the page:
    `pageIsFor(role, href)` is the test. So `/city/cases/PMT-27-0097` opened as the Applicant
    becomes that case for whichever city role is picked, not that role's queue.
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
  steps: [{ role, persona?, text }] }`, for the demo guide (3A) and for demo hints. Every
  applicant step names its `persona` (the scenario's organizer, or `"new"` for somebody starting
  a fresh event, as in path 2 and the last step of path 5); a city step has none. So a guide can
  call `setRole(step.role)` and, when there is one, `setPersona(step.persona)`. Hints are on when
  `useDemo((s) => s.hints)` is true.
- `tests/seed.test.ts` holds all three to the seed: every jump's case exists, in the state the
  PRD's seed table gives it, with the role, page and persona above; every date jump is its
  scenario's event day.

### Render tests

- Render tests live in `tests/render/<surface>.test.tsx` (jsdom). `tests/render/setup.ts` mocks
  `next/navigation` (`useRouter`, `usePathname`, `useParams`, `useSearchParams`, `notFound`,
  `redirect`) and `next/link` for all of them. Pure view-models are tested next to the file, in
  `lib/view/<surface>.test.ts` (node).
- **Use `renderScreen()` from `tests/render/harness.tsx`**, never `render()` and never your own
  navigation mock. It starts a fresh page load on the real seed (all 38 cases on Mon, May 3,
  2027, nothing in localStorage), applies your options, points the navigation mock at the page
  and reads the stored demo, as the root layout does on every route.
- **The navigation mock is a live router.** `router.push()`, `router.replace()` and a click on
  a `<Link>` move the mocked location, and `usePathname()`, `useSearchParams()` and `useParams()`
  re-render with it. A screen that keeps a step, a tab or a filter in the URL can be clicked
  through in a test: push `?view=table` and the screen that reads `view` shows the table.
  `useRouter()` returns the same object on every render, as in the app.

  | Option | Effect |
  |---|---|
  | `scenario: "S5"` | The role, persona and page of that Demo menu jump |
  | `path` | The page's href; a query string becomes `useSearchParams()`, so pass a `lib/routes.ts` link |
  | `params` | Route params; `{ id }` is read off an event, case or verify path when left out |
  | `search` | Extra search params |
  | `role`, `personaId`, `demoToday` | Set as given, over what the scenario set |
  | `cases` | Replaces the seed with hand-built cases (`makeCase`, `makeTask` in `lib/state/testSupport.ts`) |
  | `stored` | A demo left in localStorage by an earlier visit (`{ role, demoToday, cases, ... }`). Hydration brings it in and it wins over the options above: this is a reload |

  It returns the testing-library result plus `user` (a user-event session). Also exported:
  `lastPush()`, `lastReplace()`, `navigate(href)` (moves the location from the test, as the
  browser's Back would), `switchRole(role)`, `storedCase(id)`, and `prepareScreen(options)` with
  `flushHydration()` for a test that needs the page before the stored demo is read
  (`tests/render/hydration.test.tsx` renders the prerendered HTML that way).
- **The mocked router is synchronous; the real one is not.** In the app `router.push()` and
  `router.replace()` are transitions: the call returns at once and `useSearchParams()` catches up
  later (after an RSC round trip under `next dev`). A screen that draws an input from the URL, or
  decides "is there a draft" from it, or re-reads the case right after a payment, misbehaves in
  that gap, and the mock hides it. `holdNavigation()` keeps the location where it is while pushes
  and replaces are still recorded (`lastPush()`, `lastReplace()`); `releaseNavigation()`, inside
  `act()`, lands on the last one. Use them for any state that is written to the URL as the user
  types or clicks (the wizard's first keystrokes, the pipeline's search box, checkout after Pay).

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
- `tests/render/handoffs.test.tsx` renders the whole app by URL (the real layouts and pages
  behind a small router) and follows each link from one surface into the next. A link between
  two surfaces gets its test there; see "The screens (Phase 3)".
- While a sheet or dialog is open, the page behind it is `aria-hidden`: `getByRole` sees only
  the panel. Use `within(screen.getByRole("dialog"))` for the panel and `{ hidden: true }` for
  the page.

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
| `TaskCard`, `StackedTaskCard` | The applicant board's cards. A card with an open request shows as pinned with the reviewer's message. Pass `unlockHint` for a locked card (the catalogue's `CARD_BY_ID[catalogId].unlockHint`); a locked card with a date shows it under the hint. Read off the task itself: "Scheduled for Mon, Jun 21" on a scheduled meeting, "Changes requested" with who sent it back and why (`payload.rejectedReason`), an "Amendment" chip (`tags`), and "Done Apr 21" from its history. `StackedTaskCard` is the "Vendor health permits · 25 of 25" stack |
| `WhoIsUp` | The case detail's centerpiece, with its own "Who's up" heading (an `<h2>`; do not wrap it in a titled `Section`): `items={waitingOn(c, today)}`, `nextMove={nextMove(c, today, applicantName)}` and `applicantName`, shown under "Applicant". The parties that are up come first. It lists every open action with its due date (`onSelectTask` makes them buttons); a waiting party shows the task it waits to do over what it waits for ("Issue permit", "Unlocks when paid and verified") |
| `WaitingOnChips`, `DeptStatusDots` | The compact forms for a table row: who is up, and each department's review status. `DeptStatusDots` pairs the department's icon with a glyph for the status and is one tab stop per row: focus or hover shows every department's status in words |
| `FeeTable` | Fee lines by department with subtotal, deposit and total. `showActual` adds Actual and Difference for closeout. `compact` is two columns (the line over "qty unit × price", and the amount) for a box narrower than about 430px: the wizard's result panel, and any screen below 640px (`useIsNarrow("(max-width: 639px)")`) |
| `FormAnswers` | A card's form read back in words (`formRows()` in `lib/view/cardForms.ts`): the labels the applicant saw, Yes or No, 12-hour times, a list entry per line. Never print `task.payload.form` yourself |
| `ConditionList` | Conditions by department. `editable` adds a checkbox per condition with a visible "I accept" label; its accessible name is "I accept: <the condition>" |
| `ActivityTimeline` | The activity log; pass the items in the order to show, and `collapsedCount` for "Show all" |
| `EndingBanner` | A case that ended: Withdrawn, Denied, Cancelled or Hold expired, with `case.endingReason` |
| `EventTitle` | A list row's identity cell: event name over applicant name, both truncated |
| `BackLink` (from `@/components/ui/page-header`) | The back link above a screen that opens with `CaseHeader`; `PageHeader` renders the same one from `backHref` |
| `ReviewStatusDot` | A department with its review status: icon, colored dot, plain words. `label` replaces the words (the board's "Asked you for something") |
| `BillingBadge` | Where one session of a series stands: Paid, Due, Upcoming or Skipped. The wizard, the board's schedule and the permit all use it |
| `StalledBadge`, `CommissionBadge` | Two markers for a list row or a case header: "Stalled" (red, development builds only; render it when `isStalled(c, today)`) and "Sent to commission" (when `c.flags.sentToCommission`). Each is one tab stop with its meaning in a tooltip |
| `TierLegend` | The key for a view that colors by tier (the map, the calendar): dot, icon and name |
| `Stat` | A labeled figure: counts, and a case's Total, Paid, Due and Deposit |
| `LeadTimeRisk` | The lead-time flag: `risk={leadTimeRisk(c, today, cfg)}`. Renders nothing when "ok" |
| `AvailabilityBadge` | Open, Impacted, Booked or Blackout for a place and date |
| `TaskKindLabel`, `PersonaAvatar`, `PartyAvatar`, `PartyChip`, `TierBadge`, `StateChip`, `StateStepper`, `HoldStatus`, `ReviewClock`, `DueDate`, `Money`, `DateText`, `CaseId` | The small pieces. Use them wherever a tier, state, party, date, amount or id appears, so each reads the same on every screen |

- `CaseHeader` and `ReviewClock` take `{ dayCount, allowedDays, paused, pausedDays }`. Map it
  from the selector: `const rc = reviewClock(c, dept, today)`, then `{ dayCount: rc.day,
  allowedDays: rc.of, paused: rc.paused, pausedDays: rc.pausedDays }`. Pass `null` before routing.
- `CaseHeader` takes `eventDate={eventDate(c, today)}`, which is null for a Draft with no date.
  Pass `compactStepper={useIsNarrow()}`: below 768px the stepper is markers and the one current
  label, since eight labels in a row need about 385px and cannot wrap.
- A `Sheet` is a bottom sheet below 640px whatever its `side`. In `components/ui/sheet.tsx` the
  left, right and top placement rules are `sm:`-scoped for that reason: a rule with a data
  attribute outranks a plain `max-sm:` rule, so never add an unscoped `data-[side=...]:` one.
- `MonthGrid`, `WeekGrid` and `DayStrip` take `selected` (a date): that day gets the indigo ring
  and `aria-pressed`.
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
| My events, board | `applicantCases(cases, personaId)`, `boardColumns(c)` (cards by column, Do now in the PRD's order), `boardColumn(task)`, `taskDueDate(task)`, `taskSubmittedOn(task)` (the day a card last went to the city), `eventDate(c, today)`, `daysUntilEvent(c, today)`, `caseTotals(c)` |
| My queue | `queueFor(cases, role, today)`: `{ case, task, group, daysWaiting }`, oldest due first; `daysWaiting` counts from the start of the stretch the task has been open for now (a review parked on a request counts from the answer). `waitingOnOthers(cases, role, today)`: the cases where somebody else is up, never one nobody is up on (unless it is stalled). A task with no due date is `later` while fresh and `this_week` once it has been open more than seven days |
| Money | `caseTotals(c)`; `dueAtQuote`, `quoteBalance`, `quotePaid` (the quote); `refundIfCancelled(c, today, cfg)`: `{ refund, deposit, rule, canCancel }`, what `cancel` pays back today; `closeoutSettlement(c)`: `{ over, deposit, fromDeposit, refund, bill }`, what `reconcile_close` does. Show these, never a sum of your own: each is the figure its transition uses |
| Cases pipeline | `isVisibleToCity(c)`, `isOpen(c)`, `involves(c, role)`, `involvement(c, party)`, `whoIsUp(c, today)`, `leadTimeRisk(c, today, cfg)`, `reviewClock(c, dept, today)` |
| Case detail | `waitingOn(c, today)`, `nextMove(c, today, applicantName)`, `availableActions(c, role, { today, cases, cfg })`, `actorsFor(type)` |
| Active permits | `activePermits(cases, today, { includeHolds })`, `permitSessions(cases, { from, to, includeHolds })` (one entry per held session, for the calendar and map), `hasActivePermit(c)`, `holdsDateAtQuote(c)`, `sessionDates(c)`, `isSessionDate(c, date)`, `lastSessionDate(c)` |
| Store | `useDemo`, `useHydrated()`, `hydrateDemoStore()`, `demoToday()`, `buildSeed()` |

- A screen changes a case only with `useDemo.getState().dispatch(caseId, action)`. It acts as
  the current role and returns `{ ok, reason }`; show the reason when it is refused.
- The applicant's name for a case is `applicantNameOf(c)` (`lib/data/people.ts`), which also
  covers an applicant the personas do not list.
- A card's phase reads `TASK_PHASE_LABEL[task.phase]`, in the order of `TASK_PHASES`
  (`lib/types.ts`): the wizard's plan and the board's swimlanes use the same names.

## The screens (Phase 3)

Seven surfaces, each built on its own and then joined. Every one is a client screen under
`components/<surface>/`, rendered by a thin `page.tsx`, reading the store and a pure view-model in
`lib/view/<surface>.ts`. They meet only through `lib/routes.ts` and the store.

### How the surfaces hand off

- **A link is a route from `lib/routes.ts`; a change is a `dispatch`.** No surface imports
  another's components (`tests/guards.test.ts`). When one surface needs another's rule, it reads
  the other's view-model: the board's session schedule asks `canPaySession()` in
  `lib/view/checkout.ts` before it offers "Pay this session", so its link never lands on "Nothing
  to pay here".
- **The page that opens decides what it shows.** The wizard does not book an Instant event; it
  goes to `routes.quote(id)` and checkout books it. A card does not pay; it goes to the quote.
  So a link never needs to know the state of the case, and a stale link shows a reason instead
  of failing.
- **`tests/render/handoffs.test.tsx` walks every hand-off.** It mounts the real layouts and
  pages from `app/` behind a small router (`<App />`, chosen by the mocked location), acts on one
  surface, and looks at the surface that renders at the URL the router received. Each surface's
  own test stops at "the router was pushed to X"; this one renders X. **Add a test there when you
  add a link between surfaces**, and call `expectRealScreen()`: not a placeholder, not a "built
  for another role" panel, not "Case not found", and exactly one `<h1>`.
- **A sheet or dialog is modal.** While one is open, the page behind it is hidden from assistive
  technology and the top bar cannot be clicked. In a test, a query by role sees only the panel
  (pass `{ hidden: true }` to read the page behind, or read `[data-slot="back-link"]`). In the
  app, the role switcher is reached only after the panel is shut, and shutting it takes its param
  (`?card=`, `?task=`) out of the URL.
- **A page opened under the wrong role stays put.** A link opened as the wrong role shows the
  shell's "This screen is built for ..." panel. Switching from there to a role the page is built
  for keeps the page (`pageIsFor()` in `lib/view/shell.ts`), so a link from the list in the plan's
  section 12 opens what it names. Landing on the Applicant that way also sets the event's own
  persona.
- **What a surface says after an action.** A success toast, a short sentence with a period
  ("Paid.", "Quote sent.", "Sent."). A refusal shows the engine's own reason: inline in a panel
  or a form that has room for it, as an error toast on the board's cards.

| From | To | How |
|---|---|---|
| Landing "Plan an event" | Wizard | Sets the Applicant role, then `planAnEventPath()`: the persona's one draft, or a blank wizard |
| Landing "City staff", "Open the staff workspace" | My queue | Sets a city role (the Clerk, or the city role already current), then `/city/queue` |
| Landing footer, Demo menu | Demo guide | `routes.demo()`; the guide's back link returns to `/` |
| Demo guide "Start this path", "Jump" | The path's or scenario's first screen | Sets role and persona, then `demoPathJump()` or the `SCENARIO_JUMPS` page |
| Wizard step 5, Instant | Checkout, booking mode | `routes.quote(id)`; nothing is dispatched |
| Wizard step 5, Reviewed or Special | Board | Dispatches `create_board`, then `routes.event(id)` |
| Wizard "Save and finish later" | My events | `routes.events()`; every edit is already saved |
| My events row | Wizard or board | The wizard while the Draft has no cards (`isUnplannedDraft()`), its board after |
| My events, board "View permit" | Permit | `permitHrefFor()`: only while the permit is live |
| Board card: Accept conditions and sign, Pay fees and deposit | Checkout, quote mode | `directLinkHref()`: no sheet, straight to `routes.quote(id)` |
| Board card: a series' payment card, once paid | Session schedule sheet, then checkout, session mode | `?card=series`; each owed session links to `routes.quote(id, { pay: "session", date })` |
| Board card: Final bill or refund | Checkout, final mode | `routes.quote(id, { pay: "final" })` |
| Board card: Carry your permit | Permit | `routes.permit(id)`, once it is unlocked |
| Board card: Book again next year | Wizard on the new draft | Dispatches `book_again`; the result's `spawnedIds[0]` is the new case |
| Board menu | Wizard ("Edit your plan", a Draft) or `/events/[id]/amend` ("Amend", 5A's placeholder) | Links |
| Checkout, booking | Permit | Dispatches `book_and_pay`, then `routes.permit(id)`. Back goes to the wizard's plan step |
| Checkout, session or final | Board | Dispatches `pay`, a toast, then `routes.event(id)` |
| Permit | `/verify/[id]` | The QR code holds the full URL; "Open the verification page" is the same link |
| My queue row | Case, with the task's panel open | `routes.city.case(id, { task: task.id, from })` |
| Pipeline card or row, Active permits row, calendar item, map booking, day strip, Closeout row | Case | `routes.city.case(id, { from })` |
| Intake row | Case; "Request information" opens that panel; an Instant exception opens Reconcile and close | `{ from }`, `{ task: "request_info", from }`, `{ task: task.id, from }` |
| Case back link | The list it came from | `caseBackLink(from, role)`: My queue, Cases, Active permits or Intake, with that list's own query string |
| Role switcher | The same case for the other side, or the role's last page | `resolveRoleSwitch()` |

### Landing page and demo guide (3A)

- **Routes**: `/` and `/demo`, both without a shell.
- **Files**: `components/landing/` (`LandingScreen`, `Nav`, `Hero`, `HeroPreviewPanel`,
  `HowItWorks`, `EventTiers`, `ComparisonTable`, `TodoBoard`, `FeesPanels`, `StaffInterlude`,
  `Faq`, `ClosingFooter`, `DemoGuideScreen`, `hooks.ts`).
- **View-model**: `lib/view/landing.ts`. The hero's small form maps to real `EventAnswers` and
  runs `classify()`, `estimateFees()` and `whatIf()`; tier cards, the comparison table, fees and
  the cancellation schedule are read off `DEFAULT_CONFIG` and `buildSeed()`, never typed in. The
  hero never writes to the store.
- **Hands off** through `useDoors()` (`hooks.ts`): each door is a plain link that also sets the
  role once `useHydrated()` is true. The landing page renders in full before the stored demo is
  read; the demo guide waits for it, because Reset, the date jumps and every jump write to the store.
- **For later phases**: 5E adds demo hints and the command palette under `app/demo/**` and
  `components/shell/hints/**`. The "Live activity" log in the staff section is the landing page's
  own markup on night tokens; `ActivityTimeline` is the app's.

### Wizard (3B)

- **Route**: `/apply?case=<id>&step=what|where|when|size|plan`, inside `AppShell`.
- **Files**: `components/wizard/` (`WizardScreen`, `StepWhat`, `StepWhere`, `StepWhen`,
  `StepSize`, `StepPlan`, `ResultPanel`, `DatePickerPopover`, `constants.ts`).
- **View-model**: `lib/view/wizard.ts`. `buildResultPanel()` runs `classify`, `whatIf`,
  `estimateFees` and `dateGate` together; `missingFields()`, `primaryButtonReady()` and
  `dateGateSatisfied()` decide the last button; `groupTasksByPhase()` lists the plan's cards under
  the board's phase names (`TASK_PHASE_LABEL`).
- **State**: with no `case` the answers are local until the first edit, which calls
  `createDraft()` and replaces the URL with the new id. Every later edit is `updateDraft()`. A case
  that is no longer a Draft is sent to its board; an unknown id gets `CaseNotFound`.
- **Below 1024 px** the result panel is a one-line bar that opens a bottom sheet.
- **For later phases**: 5A reopens the wizard on a submitted record for an amendment
  (`components/wizard/amend/**`); the steps take `answers` and `onChange`, so they can be reused.
  `DatePickerPopover` is the only date popover; move it to `components/ui` when a second surface
  wants one (the city's panels use native date inputs).

### My events and the board (3C)

- **Routes**: `/events`; `/events/[id]?group=phase&tab=<column>&card=<id>`, inside `AppShell`.
- **Files**: `components/board/` (`MyEventsScreen`, `EventRow`, `BoardScreen`, `BoardColumns`,
  `BoardMenu`, `CardSheet`, `CardForms`, `SeriesScheduleSheet`, `VendorStackSheet`).
- **View-model**: `lib/view/board.ts`: `myEvents()`, `nextActionFor()`, `boardColumnsGrouped()`
  and `phaseGroups()` (per-vendor health permits stack unless one is pinned by an open request),
  `reviewerRows()` (each department's status in the applicant's words), `waitingOnChipItems()`,
  `dateHoldFootnote()`, `directLinkHref()`, `opensSessionSchedule()`, `seriesSessions()`.
- **`?card=`** is a task id, or one of two values that are not a task: `stack:<catalogId>` (the
  vendor-permit stack) and `series` (a series' session schedule).
- **The status strip** is `CaseHeader` plus the board's own `StatusStrip`: "Waiting on" chips in
  the applicant's words and the reviewers row (`ReviewStatusDot` with its `label`).
- **Below 768 px** the four columns are tabs with counts (`useIsNarrow()`, not CSS).
- **For Phase 4 (4E, after the event)**: the feedback and book-again bodies are in `CardSheet.tsx`
  and the series schedule in `SeriesScheduleSheet.tsx`; both are small on purpose. A refund
  finishes the final-bill card at reconciliation, so only a bill that is owed links to checkout;
  a finished card opens its sheet. `CardForms.tsx` holds the small structured forms per catalogue
  id, shaped as the seed scripts write them.

### Checkout, permit and the public check (3D)

- **Routes**: `/events/[id]/quote` (also `?pay=session&date=<date>` and `?pay=final`),
  `/events/[id]/permit`, both inside `AppShell`; `/verify/[id]` with no shell and no role.
- **Files**: `components/checkout/` (`CheckoutScreen`, `BookingPanel`, `QuotePanel`,
  `SessionPanel`, `FinalPanel`, `CardPaymentForm`, `SignatureForm`, `PlanSummaryCard`);
  `components/permit/` (`PermitScreen`, `PermitCard`, `SessionList`, `VerifyScreen`,
  `PermitPrintStyles`).
- **View-models**: `lib/view/checkout.ts` (`checkoutDecision()` picks the mode: booking for an
  Instant Draft, quote for Quote sent, session, final, or `not_ready` with a reason and a link
  elsewhere; `canPaySession()`; the amounts) and `lib/view/permit.ts` (`permitPageInfo()`,
  `sessionRows()`, `verifyStatus()`).
- **It is the one place an applicant pays.** The booking's gate and reason come from
  `availableActions()`'s `book_and_pay` row, so the screen cannot disagree with `dispatch`. The
  card form waits 650 ms and then always succeeds unless the engine refuses.
- **The quote's "I accept" boxes are local.** They gate the Sign button; `accept_and_sign`
  accepts every condition, since the action carries no condition ids.
- **For Phase 4**: 4B's Record payment and 4E's final bill use the figures the barrel exports
  (`dueAtQuote`, `quoteBalance`, `quotePaid`, `caseTotals`, `nextUnpaidSession`). "Download PDF" is
  `window.print()`, scoped to the permit card by `PermitPrintStyles`.

### City lists: My queue, Cases, Intake (3E)

- **Routes**: `/city/queue`; `/city/cases?view=board|table&tier=&state=&waiting=&from=&to=&involves=&q=`
  plus the screen's own `sort`, `dir` and `closed`; `/city/intake?tab=special|reviewed|instant`
  (the Clerk's). All inside `CityShell`.
- **Files**: `components/city/lists/` (`QueueScreen`, `CasesScreen`, `PipelineBoard`,
  `PipelineTable`, `IntakeScreen`, `KeyboardFooter`, `useRovingListNav`).
- **View-model**: `lib/view/cityLists.ts`: the queue's groups and briefing line; the pipeline's
  filters to and from the URL (`parseCasesFilters()`, `casesQueryString()`), `filteredCases()`,
  board columns and table rows with sorting; Intake's completeness, the competing application
  (`rules.availability()`, as `accept_complete` checks it) and the Instant exceptions.
- **Every list passes its own URL as `from`** when it opens a case, and My queue passes the
  task's id as `task`. Intake's "Accept as complete" dispatches from the row, wired to
  `availableActions()`'s row so a disabled button carries the engine's reason.
- **Keys**: `j`, `k` and the arrows move through rows, Enter opens, `/` focuses search.
- **For Phase 4 (4F, edge states)**: empty states are in place for an empty queue, filters with no
  result (it names them and offers "Clear filters") and an empty Intake tab. `state=closed` and
  `state=off_path` show those cases without the "Closed and ended" toggle. A new list that opens
  a case (5B's payments, 5C's work orders, 5D's verifications) passes `from` too, and needs a line
  in `BACK_LABEL` in `lib/view/caseDetail.ts` or the case goes back to "cases".

### Case detail (3F)

- **Route**: `/city/cases/[id]?tab=overview|reviews|documents|conditions|activity&task=<key>&from=<list>`,
  inside `CityShell`, shared by the three city roles.
- **Files**: `components/case/` (`CaseDetailScreen`, `ActionsPanel`, `ActionSheet`, `tabs/*`,
  `actions/registry.ts`, `actions/types.ts`, `actions/panelKit.tsx`, `actions/generic/*`,
  `actions/clerk.tsx`, `actions/pws.tsx`, `actions/hl.tsx`; since Phase 4 also `clerk/*`,
  `review/*`, `verify/*`, `FeeLineFields.tsx`, `CleanupResult.tsx`).
- **View-model**: `lib/view/caseDetail.ts`: `caseBackLink()`, `headerReviewClock()`,
  `buildOverview()`, `documentGroups()`, `reviewSummaries()`, `filterActivity()`, and the open-key
  helpers below.
- **The page**: `CaseHeader`; an `EndingBanner` or the commission banner; five tabs (Overview with
  `WhoIsUp`; Reviews, one section per department, the viewer's own first and actionable;
  Documents, by reviewer, with Verify; Conditions and fees, with Actual and Difference from
  closeout on and the payments made; Activity, newest first, by day and by party); and the sticky
  "Your actions" panel: first the role's own open tasks that no row covers (`ownTaskRows()`: a
  document to verify, a work order, a meeting to schedule; each button opens the task's own
  panel), then one button per row of `availableActions(c, role, ctx)`. A disabled row shows the
  engine's reason under it. A Draft is explained as not visible to the city; an ended
  case offers only "Add a note".

**The action registry.** Every action a city role can take has one panel, opened in a sheet.

- `panelFor(action, role)` in `actions/registry.ts` returns the role's own panel when it has
  one, otherwise the shared one: `ROLE_OVERRIDES[role]?.[action] ?? GENERIC_PANELS[action]`.
  `panelWidthFor(action)` says whether the sheet opens wide for it.
- **The shared panels are the role tools.** Phase 4 built the Clerk's, the reviewers' and the
  verification tools in `actions/generic/` itself, because each is used by more than one role
  (see "Role tools and edge states (Phase 4)" for the list). `clerk.tsx`, `pws.tsx` and `hl.tsx`
  are empty.
- **To give one role a panel of its own**, write a component that takes `ActionPanelProps`
  (`{ caseId, arg?, role, onClose }`, in `actions/types.ts`) and add it to that role's map, keyed
  by action type. Nothing else changes: the screen, the URL and the shared panel stay as they are.

  ```tsx
  // components/case/actions/clerk.tsx
  import { ClerkOnlyPanel } from "@/components/case/clerk/ClerkOnlyPanel";

  export const CLERK_OVERRIDES: Partial<Record<ActionType, ActionPanelComponent>> = {
    send_to_commission: ClerkOnlyPanel,
  };
  ```

- **`panelKit.tsx`** is what every panel is made of: `useCaseContext(caseId)` (the live case,
  today, config, all cases), `useCaseDispatch(caseId)` (returns `(action, successMessage) =>
  { ok, reason }`, with the success toast built in), and `PanelHeader`, `PanelBody`,
  `PanelActions` (the footer shows the refusal reason above Cancel and the primary button).
- **Show the reason before the click.** `@/lib/state` exports the checks `transition()` runs
  (`checkAcceptComplete`, `checkConfirmRouting`, `checkRequestInfo`, `checkReviewDecide`,
  `checkSendQuote`, `checkIssuePermit`, `checkVerifyOrReject`, `checkScheduleMeeting`,
  `checkCompleteCityTask`, `checkLogCloseout`, `checkReconcileClose`). A panel calls its check to
  disable the button with the engine's own words. A check that depends on what is in the form
  takes it: `checkConfirmRouting(c, reviewers, today)` for the list as it stands,
  `checkScheduleMeeting(c, id, actor, { date, today })` for the day in the field. Do not write
  the rule again in the panel.
- **What `?task=` holds.** Either a task's id, which is what a link from outside carries (a My
  queue row, an Intake row, a Who's up task), or an open key, which is what this screen's own
  buttons write: an action type (`issue_permit`) or `type:arg` (`verify_document:<card id>`,
  `request_info:<card id>`, `remind:applicant`). `resolveOpenKey(c, param, role)` turns either
  into one panel, or into none, and then the sheet stays shut.
  - A task id resolves through `openKeyForTask()`: the viewer's own city task opens the action
    that moves it on (`cityTaskAction()` maps the catalogue id: `intake_check` to
    `accept_complete`, `review:*` to `review_decide`, `verify:*` to `verify_document` for the
    card under verification, `consolidate` to `send_quote`, `work_order:*` to
    `complete_city_task`, `instant_exception` and `reconcile` to `reconcile_close`). Anybody
    else's task opens a reminder to whoever holds it.
  - **A new kind of city task needs a line in `cityTaskAction()`**, or selecting it does nothing.
  - `arg` is a task id for `verify_document`, `reject_document`, `schedule_meeting`,
    `complete_city_task` and `request_info` (the card it is about), and a party for `remind`.
- **What each panel does now** is in "Role tools and edge states (Phase 4)". Two things a
  panel's author has to know about the action it sends: `send_quote` reads an empty list as "the
  case's own conditions (or fee lines) as they stand" unless it carries `merged: true`; and
  `log_closeout` keeps the estimate for any line left out of `actuals`.
- **A panel must work for whoever is looking.** The page is shared: a link with `?task=<task id>`
  opened by another role resolves again for that role, usually to a reminder.

### Active permits (3G)

- **Route**: `/city/active?view=list|calendar|map|closeout&date=<date>` plus the screen's own
  `holds=1` (Include held dates), `sessions=1` (Show every session) and `cal=week`. Inside
  `CityShell`, shared by the three city roles.
- **Files**: `components/active/` (`ActiveScreen`, `TodayStrip`, `ActiveListView`,
  `ActiveCalendarView`, `ActiveMapView`, `ActiveCloseoutView`, `RoleOverlay`).
- **View-model**: `lib/view/active.ts`: `activeListRows()` (a series collapsed to its next session
  with "+N more", or one row per session), `activeCalendarItems()`, `activeMapHighlights()` for
  one day, `todayLine()`, `closeoutRows()`, and each role's overlay per case and in total.
- **One `date`** moves the day strip, the calendar and the map together. A held date is shown
  with `HoldStatus` or "(held)", not with a color of its own.
- **Role overlays**: work orders, closures and walkthroughs for Public Works & Safety; vendor
  permits verified for Health & Legal; the day-of contact and a compliance-log count for the
  Clerk (always "No log entries yet" until 6B builds the log).
- **For later phases**: 5C's `/city/map` shows closures for a date range; this map shows one day.

### What the Phase 3 review changed

All 38 findings and what was done about each: `docs/plans/2026-10-13-phase-3-review-fixes.md`.
What a later builder will run into:

- **Wizard.** The step is the URL's, with or without a draft; a draft is created by the first
  answer, never by Next. `WizardScreen` keeps the id of the draft it created until the URL has
  it, and owns the tier-change announcement (`role="status"`) and highlight, since `ResultPanel`
  is not mounted on a phone while its sheet is shut. `DateGateBanner` (the gate, its three fixes,
  and "Remove the late fee" once the fee is chosen) is on steps 3 and 5. A date change goes
  through `scheduleOnDate()`, which moves a series' weekday with it.
- **Board card sheet.** A card the applicant no longer holds is read-only: a form is read back
  with `FormAnswers`, an accepted document shows its file and "Replace this file" (armed only by
  a new file, offered only while `checkCompleteTask` passes), and a payment, sign-off or permit
  card shows `cardRecord()`: what was paid or signed, when, and a link.
- **Checkout.** After a payment the screen shows "Booked and paid", "Session paid" or "Final
  bill paid" until the next page arrives (`onPaid` from the panels to `CheckoutScreen`).
- **Cases pipeline.** The search box keeps its text in local state and writes the URL 200 ms
  after the last key; the list filters at once. Under a State filter the board is that one
  column (`pipelineBoardColumns(cases, today, state)`). Table rows are rows again: the event's
  name is the link, and the sorted column has `aria-sort`. A `from` or `to` in the URL that is
  not a date is ignored.
- **Active permits.** A day in the Today strip opens that day's map; the Map has a date field;
  the role overlay's side panel totals `activePermits(cases, today, { includeHolds })`.
- **Intake.** Accept as complete goes on to the case with Confirm routing open.

## Role tools and edge states (Phase 4)

Five workstreams deepened what Phase 3 built: the City Clerk's tools (4A, with 4B's money and
closeout, built as one), the reviewer tools (4C), document verification (4D), an applicant depth
pass (4E) and the city's edge states with the action-coverage test (4F). Nothing here is a new
route. What changed, the builders' requests and what the integration fixed between them:
`docs/plans/2026-10-13-phase-4-integration.md`.

### Where each role's tools live

Everything a city role does on a case is still one panel per action, opened in the case detail's
sheet (see "Case detail (3F)" for `?task=` and the registry). **Phase 4 built the tools in the
shared panels themselves**, `components/case/actions/generic/`, not in the per-role override
maps: the review panel serves both departments and the Clerk's license review, and a card is
verified by whichever department reviews it. `clerk.tsx`, `pws.tsx` and `hl.tsx` are empty and
stay as the place for a panel only one role uses. Each panel's logic is a pure view-model with
its own tests against the real seed.

| Action | Panel (in `actions/generic/`) | For | What it does |
|---|---|---|---|
| `request_info` | `RequestInfo.tsx` | The Clerk at intake; a department while its review is open | The applicant's cards as checkboxes, grouped by where each stands; "Something new" opens a card; a message with templates; a due date from `sla.requestResponseDays`; a preview of the card as the applicant will see it, drawn with the board's own `TaskCard`. One `request_info` per chosen card |
| `confirm_routing` | `ConfirmRouting.tsx` | City Clerk | A row per department: the suggested ones checked, with their reasons and sections, the others unchecked ("Not suggested by this plan."). The due date defaults to today plus the tier's review days, never a weekend. "N days of lead time left after the latest due date". The engine's refusal for the list as it stands, before the click |
| `send_quote` | `SendQuote.tsx`, `clerk/*` | City Clerk | "Send quote", the consolidation and quote builder: each routed department's decision side by side (`DepartmentConsolidation`); conflicts flagged (the same condition twice, or the same phrase with different numbers or times from two departments); one merged conditions list to edit, reorder, remove and add to (`ConditionsEditor`); the fee lines by department, each editable (`QuoteLinesEditor`), the deposit as a fixed line, a prompt when the late fee applies and is not on the quote; totals and "Due now" |
| `pay` | `Pay.tsx` | City Clerk | A payment at the counter. When more than one session of a series sits due, the Clerk picks which |
| `issue_permit` | `IssuePermit.tsx` | City Clerk | The checklist (signed, paid, insurance verified): who owes each and since when. The conditions and components the permit will carry, and what issuing sets off |
| `reconcile_close` | `ReconcileClose.tsx` | City Clerk | The cleanup result, estimate against actual line by line (`FeeTable showActual`), and the settlement (`CloseoutSettlementStats`) |
| `review_decide` | `ReviewDecide.tsx`, `review/*` | Both departments, and the Clerk's license review | The triggers that routed the case here and the review clock; what the applicant submitted for each routed section (`SubmittedMaterial`: form answers in words, files); a four-way decision; conditions from templates and free text (`ConditionBuilder`); fee lines from the department's rates, prefilled from the applicant's own request, with what the estimate already carries (`FeeLineBuilder`) |
| `log_closeout` | `LogCloseout.tsx` | Public Works & Safety | The cleanup inspection; each of its fee lines' actual quantity beside the estimate, with the difference and a running total; cleanup crew hours as an extra line. For an Instant event: pass, or an issue with its repair charge. Read-only once logged |
| `complete_city_task` | `CompleteCityTask.tsx` | A work order's owner; a meeting's host | A work order with its detail (what, how many, for which event, due). A meeting is "Mark held" |
| `schedule_meeting` | `ScheduleMeeting.tsx` | The meeting's department, or the Clerk | Who attends, and a date the engine checks before the click |
| `verify_document`, `reject_document` | `VerifyDocument.tsx`, `verify/*` | The card's reviewer | One panel: the drawn preview beside its checklist; Verify while every item passes, Send back with its reason prefilled once one does not. `reject_document` opens the same panel |
| `accept_complete`, `deny`, `send_to_commission`, `add_note`, `remind` | as in Phase 3 | | Unchanged |

- **View-models**: `lib/view/clerkTools.ts` (4A), `lib/view/reviewTools.ts` (4C),
  `lib/view/verify.ts` (4D). Shared by more than one panel, inside `components/case/`:
  `FeeLineFields.tsx` (one fee line as an editable row, in the review panel and the quote
  builder), `CleanupResult.tsx`, `CloseoutSettlementStats.tsx`, `clerk/DeptSelect.tsx`.
- **The tabs.** Reviews: the viewer's own department first and the only one with buttons; a
  department named on cards but not routed says so; the Clerk sees every open review's clock; a
  Meetings block per department (Schedule, Reschedule, Mark held). Documents: by reviewing
  department, the viewer's own first; Verify is the only button (Send back is inside it); a
  "Needs my check" filter; another department's cards are read-only; vendor health permits
  collapse into one row with its progress. Conditions and fees: a payments and refunds table
  (`paymentRows()`). Activity: entries under a day heading, and a "Since you last acted" divider.
- **A plain approval carries no conditions.** The condition builder shows under "Approve with
  conditions" alone, and that decision needs at least one. Fee lines go with either approval.
- **"Request information" in the review panel decides nothing.** It rewrites `?task=` to
  `request_info`, so the same sheet shows the request panel and the tab is kept.
- **The quote builder sends `merged: true`** (see "How the engine behaves"). It keeps the
  deposit out of its editable rows and puts it back on submit: `send_quote` takes the list as
  given, so a builder that left it out would send a quote with no deposit. A quote with no fee
  line cannot be sent.
- **Use a native `<select>` for a flat list in a row that repeats** (`DeptSelect`). A Radix
  `Select` per row made one sheet slow enough under jsdom to push a five-step render test past
  Vitest's 5 seconds.

### The sheet and its width

`ActionSheet` opens most panels at the sheet's usual 28rem. The panels that hold two columns or
a table open at 48rem: `panelWidthFor(action)` in `actions/registry.ts` lists them (`send_quote`,
`review_decide`, `verify_document`, `reject_document`, `log_closeout`, `reconcile_close`). Add a
new panel there if it needs the room. The width has to be set on the Sheet's own
`sm:data-[side=right]:max-w-*` rule; a plain `sm:max-w-*` class loses to it. Inside, the verify
panel is two columns from 1024px and the consolidation is one column per routed department.
Below 640px a sheet is a full-width bottom sheet whatever its width. **None of this has been
looked at in a browser.**

### Verification previews, and the seeded documents that are wrong on purpose

- **A preview is drawn, never loaded.** `buildVerificationPreview(c, card)` in
  `lib/view/verify.ts` works out a document's facts and its checklist from the case, the card and
  its file's name and type. It is deterministic: no randomness, no clock, so the same card
  previews the same way on every load and in every test.
- **The checklists.** Insurance certificate: the named insured matches the applicant, the City
  of Permitopolis is an additional insured, at least $1,000,000 per occurrence, coverage runs
  through teardown (every session, for a series). Vendor health permit: the vendor is on the
  vendor list (`payload.vendorName`), a permit number, valid past the event. Accessibility plan:
  an accessible route, accessible restrooms, a viewing area (named, or reached by the route: the
  applicant's form calls the named area optional). The other plan documents and forms have a
  short list each. A posted-notice photo is the one card where an image is the right file.
- **Each item is pre-checked and can be overridden** with its checkbox ("Looks right: ..."). A
  failing item makes Send back the primary action, with the reason built from the failing items'
  fixes; it can be edited.
- **Wrong on purpose**, so the checklist has something to catch:

  | Case | Card | What is wrong | Open to check on May 3? |
  |---|---|---|---|
  | `PMT-27-0115` Plaza wedding photos (F5) | Certificate of insurance | `wedding-photographer-contract.jpg`: a photo where a certificate belongs. "This does not look like a certificate of insurance." | Yes, as Health & Legal |
  | `PMT-27-0006` Maple Grove Preschool spring fair (B03) | Certificate of insurance | `spring-fair-flyer.jpg`: the same | Yes, as Health & Legal |
  | `PMT-27-0008` North Side Chess Club open tournament | Certificate of insurance | Coverage ends the day before the event; the other three items pass | Yes, as Health & Legal |
  | `PMT-27-0030`, `PMT-27-0046`, `PMT-27-0080` | Certificate of insurance | The same short coverage | No: already decided, or the case has ended. `lib/view/verify.test.ts` holds them |

  The two JPEGs are in the seed scripts (Phase 1: "missing insurance" is a JPEG, because Submit
  needs every pre-submit card in). The short coverage is a rule on the file's name
  (`insuranceCoverageIsShort()`: the sum of its character codes, mod 13, is 12), checked against
  every seeded certificate so that S1 to S6 and the certificates the demo paths verify all pass.
  Every other seeded document passes its checklist.

### The applicant's side (4E)

- **After the event.** In Closeout the board says who has the case
  (`closeoutStatusLine()`: "Public Works & Safety is checking cleanup; the City Clerk then
  reconciles costs."). The final-bill card shows estimate against actual and one sentence on how
  it settled (`finalSettlement()`, from `closeoutSettlement()`), with a Pay button while a bill is
  owed. "Book again next year" names its date before the click (`bookAgainDraftDate()`).
- **A series.** The schedule sheet totals paid and outstanding (`seriesTotals()`) and leads with
  "Pay the session due ...". Booking says what is charged now and what later.
- **"With the city" says who has the card.** Under each card: how long, who holds it and the
  date it is expected back; a summary line heads the column (`withCityInfo()`,
  `withCityColumnSummary()` in `lib/view/board.ts`). The holder and the date are read off the
  city's own task: the card's `verify:*` task, its department's open review, or, before routing,
  the Clerk's intake check ("at intake with the City Clerk, then Health & Legal"). The days are
  how long that holder has had the card: since the application went in for a card at intake
  (the Intake row's "20 days"), since routing for a card under a review (the queue row's "0 days
  waiting"), or since it was sent when that was later. A card uploaded to a Draft does not count
  the days before anybody at the city had it.
- **The card form validates.** `CardPaymentForm` checks the number, name, expiry and security
  code on submit. The prefilled test card passes; an emptied field no longer "pays".
- **The wizard's late fee** is decided by `lateFeeCarriesDate()` alone, so a date in the past or
  a booked date can no longer ride on a late-fee flag left on a draft.

### The states matrix, and where its tests are

Every empty, error and edge state the plan's section 8 lists has one render test that mounts
the real screen in that state.

| File | Covers |
|---|---|
| `tests/render/states-matrix.test.tsx` | The city side: an empty queue, filters, pipeline column, Intake tab, case tabs and day; an unknown case, a Draft opened by a city role, localStorage blocked, holding an older build's demo, or corrupt; a refused action; a `?task=` for a task that is gone or another role's; a 90-character name and a 60-character organization; "Not provided"; an overdue row for each role; a hold expiring tomorrow; the four endings; a series of 20 or more sessions; competing applications; sent to commission; lead-time risk |
| `tests/render/applicant-states.test.tsx` | The applicant side: My events empty; a Draft with only a name; the wizard on somebody else's draft, a case that is no longer a draft, an unknown id; a booked, blacked-out and impacted date; attendance over capacity; the lead-time gate from steps 3, 4 and 5; a refused booking; the four endings; a card sent back, overdue, locked; checkout with nothing to pay; no permit, a cancelled one, an amendment pending; empty and invalid payment and signature input; the long names |

Where the seed has no case in a state (a hold expiring tomorrow, a stalled case), the test builds
one with `makeCase()` and `makeTask()` from `lib/state/testSupport.ts`. A new screen adds its
rows to one of the two files.

What 4F added to the lists while covering them: a queue row's one-line "why now"
(`queueReasonLine()`: "Certificate of insurance re-uploaded Apr 30", "Routed Apr 20" from the
review clock's start, "Answer received May 3" for a review back from a request); the Cases
board's "Group by" State or Event date (`?group=event_date`: this week, next two weeks, this
month, later, past, with the state as a chip on each card); the table's column chips and density
(`?cols=`, `?density=compact`; ID and Depts are off by default); a "Sent to commission" marker
on cards and rows; "Expires tomorrow" on a held row in Active permits and on the case.

### The Stalled chip

A case before Permitted with nobody up is a bug in the data or the engine (PRD, "Core model").
`<StalledBadge />` (`components/domain`) flags it in red, with the reason in its tooltip: render
it where `isStalled(c, today)` is true. My queue's "Waiting on others", pipeline cards and rows
and the case header do. **It renders nothing in a production build**
(`process.env.NODE_ENV === "production"`), and the seed has no stalled case (`tests/seed.test.ts`
holds that). `<CommissionBadge />`, the gavel beside it, is not dev-only.

### The action-coverage test

`tests/action-coverage.test.ts` is the gate that no action is left without a control:

1. Every `ACTION_TYPES` entry but `tick` is dispatched somewhere in `app/` or `components/`
   (it scans the source for `dispatch({ type: "..." })`), or has a panel in the registry.
   `amend` is the one known gap, listed in `KNOWN_GAPS`; the test fails as soon as a listed gap
   gets a control, so the list cannot go stale. **5A removes `amend` from it.**
2. On the real seed, for every case and city role, every row of `availableActions()` has a
   panel, and every enabled row's panel renders.
3. On the real seed, every open task in Who's up resolves, for each city role, to a panel that
   renders (`resolveOpenKey()`): the path a My queue row takes.

It runs in node. A panel is rendered inside `<Sheet open>` and not inside `<SheetContent>`,
because the content is a portal and a portal renders nothing on the server: a test written the
other way passes whatever the panel does.

### Tests that hold the pieces to each other

| File | Holds |
|---|---|
| `tests/both-sides.test.ts` | For every "With the city" card on the seed: the applicant is told the holder, the expected-by date and "overdue" that the city's own task and queue show, and the days the holder has had it: the Intake row's days before routing, the queue row's after (never more than the Documents tab's days since the upload) |
| `tests/render/role-tools.test.tsx` | The registry opens the shared panels for every role, at the right width; the review panel hands off to the request panel; S3 and S6 walked through Reviews, Documents and Conditions and fees after each role acts; Issue permit's checklist against `checkIssuePermit()` |
| `tests/render/handoffs.test.tsx` | Demo paths 3, 4, 5 and 6, clicked from first step to last across the board, the queues, the case, checkout, Active permits and the wizard, with the role switcher |

### What a Phase 5 builder needs to know

- **Amendment (5A).** `amend` is the only action with no control; build it and take it out of
  `KNOWN_GAPS`. The board's menu already links to `/events/[id]/amend`, and the permit page
  already shows "amendment pending". The date gate for an amendment is the wizard's:
  `dateGateSatisfied()` and `lateFeeCarriesDate()` in `lib/view/wizard.ts`. A rebuilt board
  keeps what is on a card and takes a per-vendor card's vendor from the new answers. A pending
  amendment's `submit_application` card still cannot be submitted (`submit` needs a Draft): that
  is yours to change in `lib/state`. New cards land in "With the city" with the note and the
  expected-by date like any other; `tests/both-sides.test.ts` will check them.
- **The Clerk's payments page (5B).** `paymentRows(c)` and `overdueSessionDates(c)` in
  `lib/view/clerkTools.ts` are the per-case rows the Conditions and fees tab and the payment panel
  use. Every figure comes from `@/lib/state` (`caseTotals`, `quoteBalance`, `dueAtQuote`,
  `closeoutSettlement`, `refundIfCancelled`); `tests/both-sides.test.ts` is the model for a test
  that the page and the case agree. A row opens its case with
  `routes.city.case(id, { task: "pay", from })`. The license review is `review_decide` as the
  Clerk: the same panel, with the alcohol license as its fee preset. The pre-application meeting
  is the Reviews tab's Meetings block and `ScheduleMeeting.tsx`.
- **Closures map and work orders (5C).** `workOrderDetail(c, task)` in `lib/view/reviewTools.ts`
  is a work order's what, how many, event and due date; `CompleteCityTask.tsx` is its panel
  (`routes.city.case(id, { task: task.id, from })` opens it). Work orders are created by
  `issue_permit`, due two days before the last session. `permitSessions(cases, { from, to })`
  lists the closures of a date range and `citywideBlackoutOn(date)` names a blackout day. A
  walkthrough is scheduled with `schedule_meeting`, and the engine refuses a date that is past,
  on or after the event, or a blackout: show `checkScheduleMeeting(c, id, role, { date, today })`'s
  reason.
- **The verifications page (5D).** Everything is in `lib/view/verify.ts`: `canActOn(task,
  role)`, `buildVerificationPreview()`, `daysWaiting()`, `decidedOn()`,
  `groupDocumentsForDisplay()`. The queue is every card `canActOn()` is true for, across cases; a
  row opens `routes.city.case(id, { tab: "documents", task: "verify_document:<card id>", from })`,
  which is the merged panel. `components/case/verify/` holds `DocumentPreview` and
  `ChecklistPanel` if the page shows a preview of its own (a component under `components/case/`
  may import them; one under `components/city/` may not).
- **Any new list that opens a case** passes `from` and needs its line in `BACK_LABEL`
  (`lib/view/caseDetail.ts`), or the case goes "Back to cases".
- **Demo hints and the command palette (5E).** `DEMO_PATHS` has every step with its role and
  persona, and `useDemo((s) => s.hints)` is the toggle. `tests/render/handoffs.test.tsx` has the
  exact clicks of paths 3 to 6, and `tests/render/wizard.test.tsx` and `active.test.tsx` those of
  1 and 2: a callout's "click this next" should name the same control. A sheet is modal, so a
  hint for a step inside a panel has to live in the panel or wait until it shuts. `cmdk` is
  installed (`components/ui/command.tsx`); cases, roles and scenario jumps are all in the store
  and `lib/data/demoScript.ts`.
- **The accessibility and responsive pass (5F).** Not yet looked at in a browser: the 48rem
  sheet and what is laid out in it; the review panel and the quote builder at 1280px; the
  applicant's "With the city" notes at 375px. Worth a keyboard walk: the quote builder's rows
  (each has a department select, a text field and three buttons); the fee-line rows, whose fields
  are named for their line; the verify checklist's checkboxes; the Documents tab's vendor group
  (an accordion); the Stalled and commission markers, which are focusable so their tooltips can
  be read, and add a tab stop per row. 4E's 375px pass covered the files it owned.

### What the Phase 4 review changed

The acceptance review's 18 findings (1 high, 8 medium, 9 low) were all confirmed and fixed; the
plan is `docs/plans/2026-10-13-phase-4-review-fixes.md`. What a builder will meet:

- **"With the city" days are the holder's** (`withCityInfo()`), see "The applicant's side (4E)".
- **Cases table.** Next action and Due are one task's: the open task due soonest among the
  parties that are up (`pipelineTableRow()`).
- **Routing sections** are what a reviewer checks, with "Vendor health permits" for the
  per-vendor card; the wizard's reviewers sentence is lower-cased item by item.
- **Request templates.** `{vendor}` is filled when the template is picked
  (`fillRequestTemplate()`): the ticked card's vendor, or "each vendor".
- **A review back from a request**: "Answer received May 3" in My queue, days waiting from the
  answer, and a due date moved by the days paused.
- **Your actions** lists the role's own open tasks first (`ownTaskRows()`).
- **Mark held** on the Reviews tab is off, with the engine's reason, while the card is locked or
  the meeting's day is still ahead.
- **Wizard stepper.** `WizardStepper` takes `reached`: every step up to it but the one in view
  is a button with the done mark. `WizardScreen` passes the furthest step seen on this visit or
  answered on the draft (`furthestAnsweredStep()`), so going back to Where keeps When and Size
  one click away.
- **A series' cancellation refund** applies the band to what was paid.
- **Smaller ones.** The board's status strip reads off `involvement()` ("Starts after intake",
  "Nothing to review"); a reviewer's queue row shows `routingReasons()`; one name per step for a
  task, its button and its panel; `ConditionList` shows "Merged" only with `showMerged` (city
  screens); a fee preset starts at 1 and a zero-quantity line stops the decision; `FeeTable`'s
  closeout row is "Actual fees", without the deposit, and units read as counts (`fmtQty()`:
  "40 officer-hours"); "Waiting on others" leaves out a case nobody is up on; map shapes are
  keyed by position, and a route that laps a segment no longer overlaps itself; "(automatic for
  Instant)" only on Instant plans; "Not routed" once routing is behind the case; Intake's
  "9 of 12 sign-offs".

### What is still a placeholder

- **Routes.** `/events/[id]/amend` (5A; the board's menu already links to it), `/city/payments`
  (5B), `/city/map` and `/city/work-orders` (5C), `/city/verifications` (5D), `/city/inspections`
  (6B) and `/city/settings` (6A) render `PlaceholderScreen`. The sidebar links to the city ones.
- **`amend` has no control** anywhere (the action-coverage test's one known gap).
- **A document preview is a drawing.** No file is stored or opened; "Use sample file" produces a
  name, a size and a type.
- **The closeout's photo is not kept.** The log's "Add a photo" shows the file as attached;
  `log_closeout` carries no file, so nothing is stored with the case.
- **"Sent to commission" is a flag**, with a banner and a marker; there is no commission
  workflow (plan section 11).
- **The Clerk's compliance log** on Active permits always reads "No log entries yet" (6B).
- **The three role override maps are empty on purpose**, not unfinished (see above).

## How the engine behaves

Things a screen builder needs to know that the type signatures do not say.

**Rules (`lib/rules`)**

- **Routing is not the same as `classification.reviewers`.** `classify()` lists the Clerk as a
  reviewer on every Special event (coordination). `routing(answers, cls, cfg?)`, which prefills
  the Clerk's `confirm_routing`, adds the Clerk only for alcohol. Prefill from `routing()`, and
  pass the store's config: the crowd reason quotes the configured threshold.
- **A reviewer's `sections` are what it checks**: the plan's documents and forms that name it,
  and anything else sent to it for a check (the community notice). Not the cards it only
  receives (Submit application, the signature, the payment), a meeting or a download. Every
  vendor's health permit is one section, "Vendor health permits" (the catalogue's title is
  "Health permit: {vendor}"); `reviewMaterial()` reads that name as all of them. `checks` is the
  wizard's sentence, each item lower-cased.
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
- **A blackout for something with no place.** `availability()` knows which spaces a blackout
  closes and from what time. `citywideBlackoutOn(date)` returns the blackout's label for a day,
  whatever the place: a meeting's date and Active permits' map use it.

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
  `review_decide` for the Clerk's own license review, ahead of the quote. Every row is built
  from the check `transition()` runs, so an enabled row always goes through and a disabled one
  carries the engine's reason (`tests/seed.test.ts` holds this for every role on all 38 cases).
  A review's two rows (`review_decide`, `request_info`) are listed only while it is pending or
  waiting on an answer: once decided, the Reviews tab shows the decision and the panel shows the
  department's real action. A case asked for information at intake (Needs info, not accepted,
  no reviews) keeps the Clerk's intake set, with Accept as complete waiting on the answer; the
  Clerk may ask again meanwhile. In Needs info on a routed case, Send quote reads "Waiting on the
  applicant's response to Health & Legal's request." A refusal for the wrong state reads "Not
  available while the case is in Needs info." (`STATE_LABEL`), never the raw state.
- **Actions taken once.** `log_closeout`: after the hours are in it is refused ("Hours were logged
  on Mon, May 3, 2027; the City Clerk is reconciling."), because a second log would put the
  estimates back over the actuals; an extra line with a label already logged replaces it. A
  field left empty in the panel is left out of `actuals`, and the engine keeps that line's
  estimate. `send_to_commission`: "Already sent to commission." `pay` toward a quote that is paid
  in full: "The quote is paid in full." (a part payment still leaves a balance to pay).
- **An ended case offers a note and nothing else.** A city role gets `add_note`; the applicant
  gets no actions. Its board (`boardColumns()`) has nothing in Do now, With the city or Coming
  up: only what was done. Show the `EndingBanner` and the Done column.
- **`pay` has a row wherever the engine takes a payment**: the quote ("Pay fees and deposit");
  the next unpaid session of a permitted series ("Pay the next session", with
  `{ kind: "session", occurrenceDate }`: the earliest session whose `billing` is `due` or
  `upcoming`); and the final bill of a closed case that still owes one ("Pay the final bill",
  `{ kind: "final_invoice" }`, while `caseTotals(c).due > 0`). The Clerk has "Record an
  in-person payment" in the same three places. `submit_feedback` is disabled once feedback is in.
- **`complete_task` is for cards the applicant fills in or uploads.** A card finished some other
  way is refused, with what finishes it: `pay_fees` and `final_bill_or_refund` (`pay`, or
  `book_and_pay` on an Instant draft), `accept_and_sign`, `neighbor_signoff`
  (`simulate_signoff`), `submit_application` (`submit`), `feedback` (`submit_feedback`),
  `book_again`, a card with an open request (`respond_to_request`), a meeting (the city closes
  it), and `carry_permit` (the clock finishes it after the day). A city task is refused too.
- **Who may act.** `transition()` refuses an action from a party that may not raise it ("Only
  the City Clerk can issue the permit."); `actorsFor(type)` lists the parties. `dispatch()` acts
  as the current role unless given an actor.
  - `add_note` and `remind` are for city roles. `simulate_signoff` is accepted from the applicant
    as well as a neighbor, because the demo button sits on the block captain's own card.
  - `verify_document` and `reject_document`: the card's reviewer, or the department whose
    request the card answers.
  - `schedule_meeting`: the meeting's department or the Clerk. It accepts the Clerk's
    `schedule_pre_application_meeting` task id and puts the date on the applicant's card, as
    `payload.scheduledFor` and as the card's `dueDate`: a scheduled meeting is due on its day,
    not on the plan's default date. A meeting can be moved until it is held. The date has to be
    today or later, before the event (the next session still ahead) and not a blackout day
    (`citywideBlackoutOn()` in `lib/rules`): "Choose a date before Sun, Jul 11, 2027."
    `checkScheduleMeeting(c, id, actor, { date, today })` gives a panel the same reason before
    the click; without the last argument it answers only who may schedule.
  - `complete_city_task` closes a work order (its owner), a meeting that was held (its
    department or the Clerk), or a `verify:*` task (which also accepts the card). Every other
    city task is finished by its own action; the refusal names it. A locked card says what
    unlocks it ("Unlocks when the permit is issued"), and a meeting is held on or after its
    day: before it, "Scheduled for Fri, Jul 2; mark it held on or after that day."
    `checkCompleteCityTask(c, id, actor, today)` gives a button the same reason before the
    click (the Reviews tab's "Mark held" asks it); without `today` it leaves the day out.
  - `confirm_routing` needs at least one reviewer, each department once, and a due date for each
    that is today or later (the date is the review's allowance; none gave "Day 0 of NaN"). It
    also needs every department that checks one of the applicant's documents or forms: a list
    that leaves one out is refused (`Route Health & Legal too: it checks "Certificate of
    insurance".`). The Clerk's own cards and meetings never force a reviewer. `routing()`
    suggests every such department on all 38 seed scripts, so the prefill always goes through.
  - A meeting card (`kind: "meeting"`) is the applicant's, but only the city can move it:
    `openKeyForTask()` opens `schedule_meeting` for the Clerk and the department that holds it
    while it has no date, and `complete_city_task` once it has one.
- **Who's up.** `waitingOn().openTasks` and `queueFor()` are oldest due first; a task with no
  date goes last. A department named on cards before routing is `waiting`, "Starts when the City
  Clerk routes the case"; once the case is routed without it, it is `not_involved`. A waiting
  party's note says what its next task waits for ("Unlocks when the quote is ready"), and
  `nextTask` is that task. `nextMove()` names the waiting party whose task unlocks soonest:
  after closeout hours, the Clerk reconciles before the applicant's final bill.
- **The Clerk waits on the reviews.** `confirm_routing` creates the Clerk's `consolidate` task
  locked, so from routing until the last decision the Clerk is `waiting`, "Unlocks when every
  review is in" (S3 on load). The last approval opens that task; a denial opens it as "Decide: a
  reviewer denied".
- **`daysHolding`** counts from the day the party's longest-open task last became its to do: a
  card sent back counts from when it came back, a card a reviewer asked about from the request.
  A plan card nobody has touched counts from the day the application went in (S4: 20 days), and
  a Draft from the day it was started.
- **`scope`** is the sections routed to a department. The Clerk's is always "Intake, routing,
  quote, permit and closeout", also when the alcohol license is routed to it (S6, B06).
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
- **A city task is named for the button that finishes it.** Its title starts with the words on
  that action's row and panel: "Accept as complete: check the application", "Confirm routing:
  reviewers and due dates", "Send quote: consolidate the reviews", "Issue permit", "Log
  closeout: cleanup inspection", "Log closeout: actual hours", "Reconcile and close" and
  "Reconcile and close: resolve the exception". Take a title from `CITY_TASKS`, never a literal
  (`lib/view/caseDetail.test.ts` holds each to its button).
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
- **`send_quote` and an empty list.** `{ conditions: [], feeLines: [] }` means "the case's own
  conditions and fee lines as they stand", which is what the seed scripts send. With
  `merged: true` both lists are the Clerk's final ones and are taken as given, an empty one
  included: the quote builder sends that, so a condition the Clerk removed stays removed.
- **A per-vendor card names its vendor**: `payload.vendorName`, set by `requirements()`. A board
  rebuilt after an edit keeps what is on a card and takes the vendor from the new answers.
- **A reviewer's denial goes to the Clerk.** `review_decide` with `deny` finishes that
  department's review task and gives the Clerk a `consolidate` task titled "Decide: a reviewer
  denied" (`payload.denied`). `send_quote` then says which department denied; Deny is the move.
- **The review clock** counts days elapsed since routing, less days paused. Its allowance is
  what the Clerk gave: the days from routing to the review's due date (`confirm_routing` sets
  `clock.allowedDays` from the `dueDate` in its payload; the config's `sla.reviewDays` only
  prefills that date in the routing panel). So the due date reads "Day 14 of 14", or "Day 35 of
  35" for S5's five weeks, and the next day is over. It stops on the day the department decides.
  A second request while it is paused keeps the first pause's start. When the applicant answers
  the last open request, the days paused are given back: `respond_to_request` moves the review's
  `dueDate`, and its task's, forward by them, so "Day 11 of 14 · paused 3 days" is due in three
  days and never "Due today".
- **`nextMove(case, today, applicantName)`** takes the persona's name for the "Next:" sentence.
- **Issue permit** is a Clerk task created locked by `send_quote`. It unlocks when the case is
  signed, the quote is paid and the insurance card is done, whichever comes last. Re-uploading
  verified insurance locks it again until Health & Legal has checked the new certificate.
- **What a quote asks for** is `dueAtQuote(case, cfg)` (in `lib/state/core.ts`, exported from
  `@/lib/state` with `quoteBalance()` and `quotePaid()`): everything for a
  single event; for a series, the one-off lines and the first session, with the later sessions
  billed on schedule (the PRD's "first session now and the rest on schedule"). It is the amount on
  the `pay_fees` card, and what Issue permit and the hold's expiry test. Paying it marks the first
  session `paid`. This follows the PRD's wording and is awaiting the owner's confirmation; to
  charge a whole series up front instead, make `dueAtQuote` return `caseTotal(c)`.
- **Payments.** `pay` takes `quote`, `session` and `final_invoice` only, each in the state it
  belongs to, and never an amount of $0 or less. A part payment of a quote leaves `pay_fees` open
  with the balance as its amount. `withdraw` after a payment refunds what was paid.
- **Money in Closeout.** Between `log_closeout` and `reconcile_close` nothing is "due" the way
  a quote is: `caseTotals(c).due` would read $750 with a $1,000 deposit in hand. Show
  `closeoutSettlement(c)` there (`components/case/CloseoutSettlementStats.tsx`: over estimate,
  from deposit, refund or final bill), as the Conditions and fees tab and the Reconcile and close
  panel do; `reconcile_close` then does exactly that.
- **Cancelling.** `refundIfCancelled(c, today, cfg)` is what `cancel` refunds: the schedule's
  share of the fees plus the deposit, never more than was paid. The permit page and the board's
  Cancel dialog print it. `cancellationRefund()` in `lib/rules` is the schedule alone. For a
  series it applies the band to the fees paid so far, not to every session on the fee line: one
  $20 session of 13 paid, 30 or more days out, is $20 minus the $10 processing fee. The case's
  `endingReason` is a sentence with the amount: "Cancelled by the applicant. Refunded $62.50
  (10 to 29 days before: ...)."
- **Money after the event.** `closeout.balance` is what the event ran over the estimate and
  `closeout.refund` what goes back from the deposit (null when a final bill is owed; the amount is
  on the `final_bill_or_refund` card). After reconciliation `caseTotals()` no longer counts the
  deposit, so `due` is what is really owed. An ended case owes nothing. An Instant event has no
  final-bill card until its closeout exception carries a charge; `reconcile_close` then adds one.
- **A series, session by session.** On a session's day the clock marks it `due` unless it is
  already `paid` (a single event's one session is never marked: the booking or the quote paid for
  it). "Carry your permit" opens for the day, dated that day; the morning after, with more
  sessions to come, it locks again dated for the next one. An unpaid session stays `due`; nothing
  stops the session from being held (see Open questions).
- **A closed case holds no date.** `reconcile_close` and an Instant event closing itself set
  `dateHold.status` to `released`, like the four endings.
- **A new case has one activity entry**, "Started a draft.", written by `newCase()`.
- **`useHydrated()` is false on the server and on the first client render of a page load**, then
  true once the stored demo has been read (or at once after mount when storage is blocked), and
  stays true for every component that mounts afterwards. Render the skeleton until it is true,
  read `storageOk` only after that, and change the store only after that: a write made before
  the read is not saved.

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
- **How each role's queue opens** is asserted row by row in `tests/seed.test.ts`. Each has one
  overdue row, the planned one (B03 for the Clerk, B05 for Public Works & Safety, B07 for Health
  & Legal; B08 is the overdue applicant), then the PRD's hero and filler tasks, due in the coming
  week. City staff act on working days in every history, and the due dates they set are working
  days. The one exception is F7's damage report, logged on the Saturday of the picnic (see Open
  questions).
- **B22 is routed to both departments.** It routed only Public Works & Safety until Phase 4;
  `confirm_routing` now refuses a list that leaves out the department that checks its insurance.
- **Where the seed differs from the PRD's wording**: S4's routing reasons read "Block party" and
  "City services" (the PRD says "closure, barricades"); F7 is named "Brightline Logistics
  company picnic"; "missing insurance" (F5, B03) is a JPEG uploaded as the certificate, because
  Submit needs every pre-submit card in; Shelter 2 is not open on May 31 (blackout) and is
  impacted on Jul 11 (the 5K), and no case books it.

**Open items for later workstreams**

- **A pending amendment's `submit_application` card cannot be submitted**, because `submit`
  needs a Draft. Workstream 5A owns that flow.
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
- `SegmentedControl` (the role switcher, view toggles) is a radio group to the keyboard too: one
  tab stop, and Left/Right, Home and End move to an option and select it. Tests find its options
  with `getByRole("radio", { name })`.
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

## Open questions for the owner

Decisions the PRD does not settle. Each is built one way, the way named here, and is a small
change if you would rather have the other.

- **Reporting damage after an Instant event.** An Instant event closes itself the morning after
  its day unless Public Works & Safety logged a cleanup issue on the day. So the Company picnic's
  damage report (F7; the PRD puts the picnic on Sat, Apr 17) is logged on that Saturday, the one
  city action in the seed that falls on a weekend. Should Public Works & Safety be able to report
  damage on the next working day, reopening a closed Instant case as a Clerk exception? That is a
  transition the PRD's state list does not have.
- **A series session that is not paid for.** On its day the session is marked due and the
  applicant and the Clerk each get a control to pay it. Nothing stops the session from being
  held, and nothing happens to the permit when it stays unpaid. Should an unpaid session block
  anything, or only show as owed on the Clerk's Payments page (4E)?
- **What a quote for a series asks for.** As before: the one-off lines and the first session now,
  the rest on schedule (`dueAtQuote()`), following the PRD's "first session now and the rest on
  schedule". Still awaiting your confirmation.
- **The board of a case that ended.** A withdrawn, denied, cancelled or expired case shows only
  its Done cards: nothing in Do now, With the city or Coming up. The review asked for the first
  two; Coming up is emptied as well, since no quote, permit or event day is coming. Say if you
  would rather keep the locked cards visible there.
- **"Carry your permit" cannot be ticked off.** It is a reminder for the day: it opens on Event
  day and the clock finishes it the morning after. If applicants should be able to mark it done
  themselves, it is one line in `checkCompleteTask`.
- **The review allowance is the Clerk's due date.** The clock reads "Day 30 of 35" for a review
  the Clerk gave five weeks, where it used to read "of 21" from the tier's default. The other
  reading (the tier's default is the allowance, and a longer due date is the Clerk running late
  by design) would make S5 and S6 read as overdue reviews that were decided on time.
- **The role switcher's arrow keys switch role at once.** That is how a radio group behaves, and
  a switch between the Applicant and a city role navigates. If moving focus should not switch,
  the control becomes a group of toggle buttons, each its own tab stop.

Raised while the Phase 3 screens were built and joined:

- **The Today strip's caption.** The PRD's line is "Mon, May 3: 1 event today". The shared
  `DayStrip` says "no events today" for an empty day but only "1 event" for a day with one.
  Active permits writes the PRD's line itself, above the strip (`todayLine()`). Should the
  strip's own caption say "today" too? It is one line in `DayStrip`'s `summary()`.
- **The Active permits map shows one day.** The day strip, the calendar and the map share one
  date. A date range with overlaps is what Public Works & Safety's own Closures and routes page
  (5C) is for. Say if the shared map should take a week instead.
- **A held date has no color of its own.** With "Include held dates" on, a Quote sent case shows
  as "Date held until ..." in the list and "(held)" on the calendar and map, in its tier's color.
  The design system has no "held" status color; adding one is a token.
- **The repeat weekday cannot be edited.** The PRD lists the weekday as a Repeat field. The
  wizard shows it read-only, taken from the date picked, since a series that starts on a Sunday
  and repeats on Tuesdays has no coherent first session. Say if it should be a field that moves
  the start date.
- **Accepting conditions one by one is the quote's own.** The checkboxes gate the Sign button,
  but `accept_and_sign` accepts every condition: the action carries no condition ids. If an
  applicant should be able to sign for some and dispute others, that is a new action.
- **"Plan an event" from the landing page reopens a lone draft.** Somebody whose only event is
  an unfinished draft (Sunrise Yoga Club) lands back in it; everybody else gets a blank wizard,
  as "Plan an event" inside the app always gives. Say if the landing page's door should always
  start a new event.
- **A link opened under the wrong role stays where it is.** The Applicant on a city case link
  sees "This screen is built for a city role", and the switch it offers opens that case. Before,
  the switch went to the role's queue or last page. The role switcher itself still follows its
  rule between pages; say if a typed link should rather be left for the role's own home.
- **The board confirms with a toast.** Sending a document, submitting, giving feedback,
  withdrawing and cancelling each show a short toast ("Sent."), as paying and the city's actions
  already did. If the card moving to its new column is confirmation enough, the toasts are one
  map in `CardSheet.tsx`.
- **Amend is on the board's menu before it exists.** "Amend" opens "This screen is being built"
  until 5A. Say if the item should be hidden until then.

Raised by the Phase 3 review fixes:

- **A step with no due date moves up after a week.** The Clerk's own steps (confirm the
  reviewers, send the quote, issue the permit, reconcile, resolve an exception) are created
  without a due date, so they sat in "Later" however long they had waited: on the seed, a
  consolidation 49 days old. An undated task that has been open more than seven days is now
  grouped "Due this week", and the Clerk's opening line reads "8 things need you: 1 overdue, 7
  due this week." The other way is to give these steps a due date of their own when they open (a
  new `sla.clerkStepDays`), which would also let them go overdue. Say which you want.
- **A quote paid in full takes no more money.** `pay` toward a covered quote is refused ("The
  quote is paid in full."), for the applicant and at the counter. Before, the Clerk could record
  any amount on top. If a deliberate overpayment should be possible (a deposit top-up), it needs
  its own kind of payment.
- **Closeout hours are logged once.** After Public Works & Safety logs the closeout the action is
  closed to them and the case is the Clerk's to reconcile. A wrong figure can then only be
  settled by the Clerk; there is no "correct the hours" step. Should Public Works & Safety be
  able to reopen its log until the Clerk reconciles (4C)?
- **Accepting at Intake leaves Intake.** Accept as complete now opens the case with Confirm
  routing, because routing is the same person's next step and the demo script goes there. The
  other option was to stay on the Intake list and put a "Confirm routing" link in the toast, for
  a Clerk working down the list. Say if batch intake matters more.
- **A day in the Today strip opens the Map.** On the List and Closeout tabs choosing a day
  changed nothing on screen. It now switches to that day's map. If the week view of the calendar
  is the better landing, it is one word in `ActiveScreen`.
- **Next on an empty wizard starts nothing.** Stepping through the wizard without answering
  anything creates no draft; the first answer does. So a visitor who only looks leaves nothing in
  My events.

Raised while the Phase 4 role tools were built and joined:

- **Routing cannot leave out a department that checks a card.** `confirm_routing` refuses a list
  without the department named on one of the applicant's documents or forms, so the Clerk cannot
  take Health & Legal off an event that carries an insurance card. The PRD lets the Clerk "add
  or remove reviewers"; this keeps every card with somebody to check it. If the Clerk should be
  able to drop a department and take its cards over, the card's reviewer has to change with it.
- **A meeting cannot be set on a blackout day.** The PRD's blackout dates close spaces to
  bookings. The build also refuses a meeting or a walkthrough on one (Memorial Day, Jul 4 and
  Jul 5), as well as a date that has passed or falls on or after the event. A weekend is not
  refused. Say if blackouts should not apply to meetings, or if weekends should.
- **A card can be verified before the case is routed.** On a Submitted case the Documents tab
  offers Verify to the card's reviewer: the engine asks only who is looking and whether the card
  is submitted. So Health & Legal can send back the photo uploaded as insurance on the Plaza
  wedding photos before the Clerk accepts the application. Say if a check should wait for
  routing.
- **Every checklist item can be overridden.** The verifier may tick "Looks right" on any item,
  including "Looks like the right kind of document" on a photo, and Verify then goes through. If
  an upload of the wrong kind should never be verifiable, that item becomes read-only.
- **Which certificate is short on coverage.** The one certificate with a subtle defect that is
  open to check on May 3 is the North Side Chess Club's (`PMT-27-0008`), chosen by a rule on the
  file's name. If a certificate on one of the six scenarios should carry it instead, it is one
  line in `lib/view/verify.ts`, and the demo path that verifies it then needs a second upload.
- **The accessibility plan's viewing area.** The PRD's checklist has three items: route,
  restrooms, viewing area. The applicant's form calls the named viewing area optional, and none
  of the seeded plans names one. The check passes on a named area or on the route ("to every
  viewing area") being marked. If the named area should be required, the form's label and six
  seed scripts change with the check.
- **A plain approval carries no conditions.** The review panel offers the condition builder under
  "Approve with conditions" only, and that decision needs at least one. Fee lines go with either.
- **A quote needs at least one fee line.** The quote builder will not send an empty quote. A
  quote with no conditions is fine.
- **Before routing, "With the city" names the City Clerk.** The PRD has each card there show its
  reviewer. A card on a Submitted case reads "at intake with the City Clerk, then Health & Legal",
  with the intake check's due date, because that is who holds it: the department has not started.
  Say if the board should name only the reviewer.
- **The closeout's photo is not kept.** Public Works & Safety can attach a photo to a cleanup
  issue; the action that logs the closeout carries no file, so it is not on the case afterwards.
- **The Documents tab's "Needs my check" filter is not in the URL.** It is a toggle on one tab
  and is gone on reload. The list screens keep their filters in the URL; say if this should too.
- **The Cases table hides ID and Depts by default.** Tier, Waiting on, Next action, Due and Risk
  are on; the column chips turn the other two on, and the choice is kept in the URL.
- **A hold expiring tomorrow is flagged on Active permits and on the case**, not on the Cases
  pipeline's cards and rows. It is one line each if the pipeline should carry it too.
- **The card form checks its fields.** A cleared card number or a malformed expiry now stops the
  payment with a message under the field. It is still a simulation: any well-formed card pays.
- **The wide panels open in a 48rem sheet.** The quote builder, the review, verification, the
  closeout log and reconciliation. The PRD's consolidation is "side by side"; at 1280px a sheet
  that wide covers most of the case. If the Clerk's consolidation should be a page of its own, it
  is a route and a move, not a rebuild. Not yet looked at in a browser.
- **The case header shows a long name in full.** A 90-character event name wraps on the case's
  own page and on the board; it is truncated with a tooltip only in lists.

From the Phase 4 review fixes (2026-10-13):

- **"With the city" counts the holder's days, not the days since the upload.** A card uploaded to
  a Draft on Apr 2 and submitted on Apr 13 reads "20 days at intake with the City Clerk" on May 3,
  and "0 days with Health & Legal" on the day it is routed. The review's other option was to keep
  the upload count and reword it: "Sent 31 days ago · now with Health & Legal". The city's
  Documents tab still counts from the upload ("Submitted Fri, Apr 2 · waiting 31 days"). Say if
  either should read the other way.
- **A review's due date moves with its pause.** When the applicant answers a reviewer's request,
  the days the review waited are added to its due date (S3: asked Apr 30, answered May 3, due
  May 6 instead of May 3). The alternative is to hold the Clerk's original date and let the row
  read overdue. The pushed date is not rolled off a weekend.
- **A series cancelled part-way.** The cancellation band now applies to the fees paid so far
  (Sunrise Yoga, one $20 session paid, 30 or more days out: $10 back after the $10 processing
  fee). It does not yet tell a session already held from one still to come: a series cancelled
  mid-run in the 50% band gets half of everything paid, held sessions included. The PRD's
  schedule is written for a single event. Should a held session be left out of the refund?
- **A meeting is marked held on or after its day.** "Mark held" on a meeting scheduled for a later
  date is refused ("Scheduled for Fri, Jul 2; mark it held on or after that day."). To close one
  early, reschedule it to today first. Say if the Clerk should be able to override.
- **Your actions lists the role's open tasks as primary buttons.** Health & Legal's "Verify
  Certificate of insurance", the Clerk's "Schedule the pre-application meeting" and each of Public
  Works & Safety's work orders (three on the 5K) sit above the state's own rows, all filled. Say
  if a case with several should show one primary and the rest quiet.
- **One name per step.** The Clerk's and the closeout's tasks now start with the button's words
  ("Send quote: consolidate the reviews", "Reconcile and close: resolve the exception"), and the
  quote builder's sheet is headed "Send quote". "Review your sections" (button: "Decide your
  review") and "Decide: a reviewer denied" (button: "Deny") were not in the review's list and
  are as they were.
- **What "City Clerk checks" on the wizard's reviewers line.** With actions and meetings out, the
  Clerk's line on a Special plan reads "City Clerk checks your community notification", with the
  alcohol details first when there is alcohol. The community notice is kept because completing
  it sends it to the Clerk for a check. Say if the line should name the Clerk's coordination
  instead.
- **The board's status strip on an Instant event** reads "City Clerk · Nothing to review" (the
  PRD's seed table says "Nobody; permit active"). The other choice was to leave the Clerk out of
  the strip for Instant events. A department named on a card before routing reads "Starts after
  intake".
- **A fee preset starts at 1.** "Police" on an event that asked for no officers adds one
  officer-hour for the reviewer to change, and a named line left at 0 stops the decision with
  "Give Police a quantity, or remove the line."


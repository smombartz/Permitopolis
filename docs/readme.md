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
  real engine, so no seeded case can disagree with the rules.
- **Screens are thin.** A page is a server component that renders one client screen in `<Suspense>`.
  Screens read the store and call pure view-models in `lib/view`.
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

## How the engine behaves (Phase 1)

Things a screen builder needs to know that the type signatures do not say.

**Rules (`lib/rules`)**

- **Routing is not the same as `classification.reviewers`.** `classify()` lists the Clerk as a
  reviewer on every Special event (coordination). `routing(answers, cls)`, which prefills the
  Clerk's `confirm_routing`, adds the Clerk only for alcohol. Prefill from `routing()`.
- **Fee lines have fixed labels**: "Application fee", "Shelter reservation", "Field reservation",
  "City Hall Plaza reservation", "Great Lawn reservation", "Street closure", "Route closure",
  "Amplified sound", "Temporary alcohol license", "Food or vendor permit", "Structure fire
  inspection", "Police", "Barricades", "Refundable cleanup deposit", "Late fee". Code that needs
  one line finds it by label; `cancellationRefund()` does so for the application fee.
- **A series is billed per session.** `estimateFees()` returns `perSession`, `sessions` and
  `dueNow` (the first session); the fee line itself carries the whole series.
- **What takes a slot**: a date hold, or a live permit (Permitted, Event day, Closeout). A case
  with an ending never does, so cancelling a permit frees its date.
- **A series skips a blackout session.** `occurrences()` marks it `skipped`: it is not billed,
  not held and not an event day.

**State (`lib/state`)**

- **A Draft keeps its tier.** `classifyDraft()` runs on `createDraft`, `updateDraft` and the draft
  "Book again" creates, so `case.tier` is right before the plan is confirmed. `create_board` still
  has to run (again, after an edit) to build the cards and the fee lines.
- **`create_board` lists the sessions** through `occurrences()`. The wizard does not have to store
  per-session availability itself, though it can show it live by calling `occurrences()`.
- **`availableActions()` is the role's action panel**, not every action. Actions on one card
  (`complete_task`, `respond_to_request`, `verify_document`, `reject_document`, `schedule_meeting`,
  `complete_city_task`) belong on that card's own control and are dispatched directly.
- **City task ids**: `review:<dept>`, `verify:<card suffix>` (for example
  `verify:vendor_health_permit:1`), `work_order:<barricades|police|closure|trash|power>`, and the
  plain ids in `CITY_TASKS`. Meeting cards belong to the applicant and are closed by the city with
  `complete_city_task`.
- **A request parks the asker.** While a department waits on the applicant, its own review (or
  the Clerk's intake check) is `locked` with `payload.awaitingAnswer`, so it leaves the queue and
  "Who's up" shows the applicant alone. The answer gives it back. A card with an open request is
  due on the request's date: use `taskDueDate(task)`.
- **`nextMove(case, today, applicantName)`** takes the persona's name for the "Next:" sentence.
- **Issue permit** is a Clerk task created locked by `send_quote`. It unlocks when the case is
  signed, paid in full and the insurance card is done, whichever comes last.
- **Money after the event.** `closeout.balance` is what the event ran over the estimate and
  `closeout.refund` what goes back from the deposit (null when a final bill is owed; the amount is
  on the `final_bill_or_refund` card). After reconciliation `caseTotals()` no longer counts the
  deposit, so `due` is what is really owed. An ended case owes nothing.
- **Not done yet**: a series' later sessions are never marked `due` by the clock (workstream 4E
  owns the payment schedule), and `buildSeed()` returns no cases until workstream 2A.

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
- `/dev/kit` and `/dev/map` show every primitive, domain component, map mode and calendar view.
  Neither is linked from the app.

**Map and calendar (`components/map`, `components/calendar`)**

- One SVG unit is one foot, so a drawn rectangle's area is its square footage.
- `LocationPicker` takes `availabilityOf?: (location) => Availability | undefined`; the wizard
  passes `rules.availability` through it.
- The SVGs are `aria-hidden`. Every map function is also in the list or the number inputs beside
  it, which is the keyboard and screen-reader path.

**Tooling**

- ESLint ignores `.claude/`, where agent worktrees (full copies of the repo, each with its own
  `.next`) are created.
- `tests/engines.test.ts` runs the rules engine and the state machine together with nothing
  mocked. Their own unit tests mock each other.

## Reference data

Fictional and kept in `lib/data/`: eight bookable spaces in Riverside Park, the Great Lawn, City
Hall Plaza; Main Street (five blocks), River Road (four stretches; with Main Street it makes the
3.1-mile 5K loop), and residential Maple, Elm and Oak. Fees, the cancellation schedule and the
calendar's blackout and impacted dates are placeholders from the PRD.

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
  `complete_city_task`) belong on that card's own control and are dispatched directly.
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
  mocked. Their own unit tests mock each other. It also replays all 38 seed scripts
  (`tests/replay.ts`, a test-only helper until workstream 2A's `replay.ts` exists) and checks
  that no step is refused and every case reaches its expected tier, state and ending.
- `tests/guards.test.ts` also fails on `text-fg-tertiary` used for anything but a placeholder. A
  purely decorative use carries a `guard-allow-tertiary` comment on its line.

## Reference data

Fictional and kept in `lib/data/`: eight bookable spaces in Riverside Park, the Great Lawn, City
Hall Plaza; Main Street (five blocks), River Road (four stretches; with Main Street it makes the
3.1-mile 5K loop), and residential Maple, Elm and Oak. Fees, the cancellation schedule and the
calendar's blackout and impacted dates are placeholders from the PRD.

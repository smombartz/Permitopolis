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

## Reference data

Fictional and kept in `lib/data/`: eight bookable spaces in Riverside Park, the Great Lawn, City
Hall Plaza; Main Street (five blocks), River Road (four stretches; with Main Street it makes the
3.1-mile 5K loop), and residential Maple, Elm and Oak. Fees, the cancellation schedule and the
calendar's blackout and impacted dates are placeholders from the PRD.

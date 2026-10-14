# One header style: the site header in the app, with a user menu

**Status:** done and merged into `master` (2026-10-13, fast-forward from `user-menu`). `pnpm check` green. Not pushed.

## Context

Two requests, now one piece of work:

1. Take the four-segment role switcher (and the separate applicant picker, and the under-768px
   hamburger that stands in for both) out of the app's top bar. Put one user button on the right,
   just before the settings cog, that switches between the three city officials and the applicants.
2. The landing page's new header (`components/landing/SiteHeader.tsx`: a solid band, the city seal,
   "City of Permitopolis / Office of the City Clerk", navigation on the right) is the default header
   style. The app header follows it, and the new header is shown on `/dev/kit`.

Decided with the user:
- The user button shows who is acting: role icon or applicant initials, plus the name from 768px
  up; icon only below that.
- The app header is the same band at the same height as the landing page's (about 96px; 80px under
  640px), but pinned to the top. The landing page's keeps scrolling away.

## Branch

`git switch -c user-menu` from `master` before any edit. Committed there at the end; not pushed,
not merged. First step on the branch (CLAUDE.md): copy this plan to
`docs/plans/2026-10-13-site-header-user-menu.md`.

## Design

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ (seal) City of Permitopolis        Demo today: Mon, May 3, 2027 [Search ⌘K] [🏛 City Clerk ▾] [⚙] │
│        Office of the City Clerk                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Shared band.** The band and the identity move out of the landing folder (a surface can't import
from another surface) into `components/ui/`, and both headers are built from them:

- `components/ui/city-seal.tsx`: `CitySeal`, moved from `components/landing/CitySeal.tsx`.
- `components/ui/site-header.tsx`:
  - `SiteHeader({ pinned })`: `<header>` with `border-b border-line-subtle bg-surface-solid`, the
    `page-container` row (`py-4 sm:py-5`, `justify-between gap-6`). `pinned` adds
    `sticky top-0 z-40`. No blur, no shadow.
  - `SiteIdentity`: the seal + two-line name as one link to `routes.home()`, exactly the landing
    markup and classes.
  - `SiteHeaderNavLink`: the 44px section link (14px/600, underline on hover).
- `components/landing/SiteHeader.tsx` keeps its nav, "City staff", "Plan an event" and the "Menu"
  fold, now inside `SiteHeader` + `SiteIdentity`. No visible change to `/`.

**App header** (`components/shell/TopBar.tsx`): `<SiteHeader pinned>` with `SiteIdentity` on the
left (replacing "Permitopolis · City Clerk · Events Permitting") and on the right, in order: demo
date, Search, **user button**, cog. Search and the user button take the landing "Menu" button's
look (`variant="secondary" size="sm"`, `shadow-none`). Under 640px the date is screen-reader only
and Search is icon-only, so the name keeps its room. The hydration placeholder keeps its
`data-slot` and gets skeletons for the new row.

**User button and menu** (`components/shell/UserMenu.tsx`, new, driven by props so the kit can
show it without the store):

- Button: `PARTY_ICON[role]` for a city role, `PersonaAvatar size="sm"` for an applicant,
  `UserIcon` for "New applicant"; then the name (`PARTY_LABEL[role]` or the persona's) and a
  chevron. Icon only under 768px (`useIsNarrow()`). `aria-label="Switch user: <name>"`.
- Menu (`align="end"`, `w-64`), two radio groups as `MobileNavMenu` has today:
  - **City officials**: City Clerk, Public Works & Safety, Health & Legal.
  - **Applicants**: the six scenario organizers and "New applicant" (`PICKABLE_PERSONA_IDS`).
  - Applicant only, under a separator: "My events", "Plan an event" (kept from `PersonaPicker`).
- A `sr-only` `aria-live="polite"` line in the header reads "Acting as <name>" on change.

**What a pick does.** With no generic "Applicant" entry, the old Applicant switch lives on in the
persona picks:

- A city official: `useRoleSwitch()`, unchanged.
- An applicant while already the Applicant: unchanged (`pathForPersona`).
- An applicant from a city role: role becomes Applicant, persona is set. If the pick is the
  applicant the old switch would have landed as (the organizer of the case on screen, or of the
  remembered applicant page, or the last applicant used), it lands where that switch did
  (`resolveRoleSwitch`): Clerk on the 5K's case → "Riverfront Running Club" still opens the 5K's
  board. Anyone else starts on their own page (`pathForPersona`).
- That landing applicant is listed first under Applicants when it is not one of the seven (a
  filler case's organizer), as the picker already does for the current persona.

**Pinned at 96px instead of 56px.** Things that clear the bar follow it through one variable in
`app/globals.css` (not the frozen `styles/tokens.css`): `--app-header-h` (81px, 97px from 640px).
- `StickyAside` default `topOffset`: `5rem` → `calc(var(--app-header-h) + 1.5rem)`.
- `SettingsScreen` tabs: `top-20` → the same calc.
- `scroll-padding-block` top: stays 5rem for `/`; `html:has([data-slot="app-header"])` gets the
  calc, so focus and anchors land clear of the taller bar.

## Changes

- **New:** `components/ui/city-seal.tsx`, `components/ui/site-header.tsx`,
  `components/shell/UserMenu.tsx`.
- **`lib/view/shell.ts`** (+ tests), pure:
  `applicantLanding(...)` → `{ personaId, path }` (what a switch to the Applicant from here lands
  as and where; wraps `resolveRoleSwitch`), `userMenuPersonaIds(landingPersonaId)`,
  `resolvePersonaPick({ picked, fromRole, landing, cases })`.
- **`components/shell/useRoleSwitch.ts`**: `usePersonaSwitch()` also sets the role to Applicant
  from a city role and uses `resolvePersonaPick`. The command palette is unaffected.
- **`components/shell/TopBar.tsx`**: rebuilt as above. `CommandCenter` gets the `shadow-none`
  button look.
- **`components/landing/SiteHeader.tsx`, `SiteFooter.tsx`**: use the shared pieces.
- **Delete:** `RoleSwitcher.tsx`, `PersonaPicker.tsx`, `MobileNavMenu.tsx`,
  `components/landing/CitySeal.tsx`. `SegmentedControl` stays (Board/Table toggles).
- **`components/kit/KitScreen.tsx`**: a "Site header" block right under the intro, full width:
  the public header (identity, section links, accent link, primary button) and the app header
  (identity, date, Search, a working `UserMenu` on local state, cog). Not pinned in the kit.
- **Offsets:** `app/globals.css`, `components/ui/sticky-aside.tsx`,
  `components/city/settings/SettingsScreen.tsx`.
- **Copy/comments** that say "role switcher": reset confirmations in `DemoMenu.tsx`,
  `CommandPalette.tsx`, `DemoGuideScreen.tsx` ("…the demo date and the current user…");
  `DemoGuideScreen.tsx` "The four roles" ("The user menu in the top bar moves between all
  four."); comments in `useRoleSwitch.ts`, `useIsNarrow.ts`, `ui/skip-link.tsx`,
  `ui/segmented-control.tsx`, `lib/view/palette.ts`, `lib/data/people.ts`.
- **Docs:** `docs/rime-and-ink-design-system.md` "Site header": it is the default header; add the
  app variant (pinned, controls in place of the nav) and where the code lives. `docs/readme.md`,
  `docs/log.md` entry, the plan copy.

## Tests (`tests/render/` unless noted)

- `harness.tsx`: `switchUser(user, name)` (open "Switch user: …", click the `menuitemradio`).
- `shell.test.tsx`: role clicks go through `switchUser`; the persona-picker block becomes the user
  menu. New: the header is the banner with the city's name linking home; the button names the
  current user and sits before the Demo menu; the menu's two groups; an applicant picked from a
  city case follows the case; another applicant opens their own page; a filler case's organizer is
  offered.
- `handoffs.test.tsx`: `switchTo(user, role)` uses `switchUser`; for `"applicant"` it picks the
  landing applicant, so its ~25 call sites and their `here()` assertions stay. The two
  "Switch applicant" → "New applicant" sequences become one pick.
- `hydration.test.tsx`: assert the button's name instead of checked radios.
- `keyboard.test.tsx`: the "j is left alone in a radio group" check uses the Board/Table toggle.
- `a11y-overlays.test.tsx`: audit the user menu as an applicant and as a city role.
- `landing.test.tsx`: unchanged, and must stay green (same markup from shared parts).
- `lib/view/shell.test.ts`: the three new functions.

## Verification

- `pnpm check` (type-check, lint, tests, build) green on `user-menu`.
- No dev server or screenshots from me (CLAUDE.md). To look at: `git switch user-menu`,
  `pnpm dev`. Worth checking by eye: `/` unchanged; the app header at 1280px (city) and 375px
  (applicant: the city's name may truncate beside three buttons); sticky side panels and the
  Settings tabs sit just under the taller bar; `/dev/kit` "Site header"; Clerk on a case → pick its
  organizer.

## Changes

- **"New applicant" opens a blank wizard from a city role.** As planned, the landing applicant
  always landed where the old switch did, which sent "New applicant" to an empty My events when
  there was no remembered page. A landing that is only the Applicant's home now starts on the
  applicant's own page instead (`resolvePersonaPick`), so only a case on screen or a remembered
  page is followed.
- **The demo date shortens under 1024px, not 640px.** The city's name at 24px beside four
  controls needs the room on a tablet; under 640px the date is for a screen reader only.
- **`data-pinned` on the shared header** stands in for the planned `data-slot="app-header"`:
  the scroll-padding rule reads `[data-slot="site-header"][data-pinned]`.
- **`SiteIdentity` has a `truncate` prop**, used by the app's header and the kit's app specimen,
  so a narrow row cuts the name with an ellipsis instead of wrapping to four lines.
- **`actingAsName()`** was added to `lib/view/shell.ts`: the button's label and the live line.
- The harness also gained `switchUserToRole()`, and `live-regions.test.tsx` treats "Acting as …"
  like the demo date: on the page from the start, speaking only when it changes.

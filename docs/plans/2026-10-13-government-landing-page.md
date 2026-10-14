# Government-style landing page

Status: done on 2026-10-13, on the branch `landing-government-style`. Waiting for the owner's look before merging.

## Context

The landing page at `/` was built as "the full Rime & Ink marketing layout" (build plan 3.1 and
section 7): a floating glass nav, a 72 px headline with a hand-drawn underline, a tilted floating
demo panel, eyebrow pills, frosted cards, a "Most common" badge, a dark product showcase and a
closing call-to-action card. It reads as a startup product page, not a city office.

The owner wants it to read as an official government site, taking layout cues from seattle.gov and
cityofsydney.nsw.gov.au. What those two share: an official-site identity band, a plain header with
the city name and a nav row, a short task-led opening instead of a marketing hero, dense lists and
tables instead of feature cards, and a civic footer with contact details.

Decisions made with the owner on 2026-10-13:

- **Scope: a Clerk's Office service page.** City-site chrome around an "Event permits" page. Every
  link works; no invented city services, news or officials. Product-pitch sections go.
- **Preview: local branch only.** Nothing is pushed or deployed.

## The new page, top to bottom

| Band | Content | Treatment |
|---|---|---|
| Header | City seal, "City of Permitopolis", "Office of the City Clerk"; right: `nav aria-label="Primary"` (How to apply, Permit tiers, Fees, Questions), then "City staff" link and "Plan an event" button | One row, near-white (`bg-surface-solid`), bottom rule, not sticky; below 1024 px one "Menu" dropdown holding the anchors and both doors (switched with CSS; see Changes) |
| Page intro | Trail "City of Permitopolis › Office of the City Clerk › Event permits" (plain text: the parent pages do not exist), `h1` "Event permits", two-sentence lead, "Plan an event" button | `bg-page` band; `h1` at `text-feature`, 36 px below 640 px |
| Tasks and checker | Left: `h2` "I want to…" with bordered link rows (Plan an event, See what it costs, Check how much notice to give, See what decides the tier, Read common questions). Right: `h2` "Check what your event needs", the live checker as a plain form | Two columns from `lg`, stacked below; flat bordered box, no tilt, float or mock window dots |
| How to apply | The five wizard questions as a plain numbered `ol`, then one paragraph on the to-do list an event gets after applying | No scroll thread, no step mocks |
| Permit tiers | Three bordered summary rows: tier badge and name, when it applies, then notice, reviewers and typical fee, and the example | Replaces the three frosted cards; no "Most common" badge or indigo glow |
| What decides the tier | The existing trigger table and block-party note | Flat container; the Reviewed column wash is removed |
| Fees and cancellations | Fee schedule as a labelled table; cancellation list; the deposit note | Flat, two columns from `md` |
| Common questions | The eight-item accordion | Flat bordered list |
| Footer | Four columns: seal and contact (clerk, phone, office hours); "Event permits" links (`nav aria-label="Footer"`); "For city staff" with "Open the staff workspace"; "About this site" with the fictional-city line and the demo guide link | `footer` on `bg-night` with `data-tone="night"` |

Removed: the to-do board showcase, the dark "One workspace, three roles" showcase, the closing
call-to-action card, eyebrow pills, the hand-drawn underline, the page grid, grain and gradients.

Visual rules for the whole page: existing Rime & Ink tokens only (`styles/tokens.css` is frozen and
is not edited). Flat solid surfaces with `border-line-subtle` and `rounded-control`; no backdrop
blur or card shadows; section headings are plain `h2`s at `text-card` over a rule; sections are
48 to 64 px apart instead of 104 px; in-text links are underlined `text-fg-accent`; indigo stays
the only action colour. The word "tier" is kept (not "permit type") because the wizard and the
tier badges use it.

## Behaviour that must not change (pinned by tests)

- One `h1`, one `main`; skip link is the first tab stop; the Primary nav comes before `main` and
  the `footer` after it.
- Every "Plan an event" link points at `routes.apply()` and calls `doors.planAnEvent`; every
  "City staff" link (that exact name) points at `routes.city.queue()` and calls `doors.cityStaff`.
  `useDoors()` in `components/landing/hooks.ts` is not changed.
- Exactly one link named "Open the staff workspace" and exactly one link matching "demo guide",
  the latter inside the footer as "… Open the demo guide".
- The checker stays a `role="group"` with an `aria-live` result, a switch named "Alcohol" and a
  radio named "A street"; the tier badge is the only "Instant" text inside it.
- "$25 per hour" appears once on the page; the FAQ button "Do I need insurance?" still expands.
- `a11yAudit` rules: unique nav labels (Primary, Footer), links with one name share one `href`
  (header, task list and footer anchors come from one shared list), the seal SVG is `aria-hidden`
  and drawn in `currentColor`, tables are labelled, lists hold only `li`.
- Guards: no raw colours, no `text-fg-tertiary` for content, no opacity modifiers on text colours,
  imports only from `lib/`, `components/ui`, `components/domain`, `components/shell`.

## Steps

1. [x] **Branch and plan.** `git switch -c landing-government-style` from `master`. Copy this plan to
   `docs/plans/2026-10-13-government-landing-page.md`.
2. [x] **Tests first** (they fail until step 3).
   - `tests/render/landing.test.tsx`: the checker is found by its new name ("Check what your event
     needs") in the three checker tests. New assertions: the `h1` is "Event permits"; the header
     holds the city's name and the Primary nav before "City staff"; the nav, the "I want to…" list and
     the footer link to sections that exist; the footer holds the contact details and "Open the
     staff workspace"; the three tier rows show their notice, reviewers and fee; no element
     carries `page-atmosphere` or `anim-idle-float`.
   - `tests/render/handoffs.test.tsx`: retitle "the staff section's own door" to the footer's door;
     the assertion is unchanged.
   - `a11y`, `keyboard`, `smoke`, `hydration` and `guards` tests are not edited; they must pass.
3. [x] **Build the page** in `components/landing/`.
   - New: `SiteHeader.tsx` (seal and name, nav, the two doors), `CitySeal.tsx` (inline SVG
     seal), `sections.ts` (the one list of section anchors and labels), `PageIntro.tsx`,
     `QuickTasks.tsx`, `SiteFooter.tsx`.
   - Renamed and rewritten: `HeroPreviewPanel.tsx` → `PermitChecker.tsx`, `HowItWorks.tsx` →
     `HowToApply.tsx`, `EventTiers.tsx` → `PermitTiers.tsx`, `FeesPanels.tsx` → `Fees.tsx`.
   - Restyled in place: `ComparisonTable.tsx`, `Faq.tsx`, `SectionHeading.tsx` (plain `h2`, no
     eyebrow, no night tone), `LandingScreen.tsx` (new composition; `page-atmosphere` dropped).
   - Deleted: `Nav.tsx`, `Hero.tsx`, `TodoBoard.tsx`, `StaffInterlude.tsx`, `ClosingFooter.tsx`;
     `useReducedMotion` leaves `hooks.ts` (the scroll thread was its only user).
   - Reused as they are: `lib/view/landing.ts` (`heroPreviewResult`, `tierCards`,
     `comparisonRows`, `blockPartyNote`, `feeScheduleRows`, `cancellationRows`, `faqItems`),
     `useDoors()`, `Table`, `Accordion`, `Button`,
     `DropdownMenu`, `InlineAlert`, `SkipLink`, `TierBadge`, `Money`, `CITY_STAFF_BY_DEPT.clerk`,
     `fmt*` helpers, `LandmarkIcon`.
   - Not touched: `app/page.tsx`, `app/globals.css` (the kit page still uses `.page-atmosphere`
     and `.anim-idle-float`), `components/shell/TopBar.tsx`, `DemoGuideScreen.tsx`, every frozen
     contract.
4. [x] **Gate.** `pnpm check` (type-check, lint, tests, build): 3,201 tests in 109 files pass and the build is clean.
5. [x] **Docs.** `docs/log.md` entry at the top; `docs/readme.md` "Landing page and demo guide (3A)"
   rewritten for the new files and the two places the page bends the design system (two night
   bands, no eyebrow pills); `docs/plans/2026-10-12-permitopolis-prototype.md` row 3.1, section 7
   and the 3A what-to-look-at rows updated, with a Changes note.
6. [x] **Commit** on `landing-government-style` and leave the working folder on that branch. No push,
   no deploy.

## Verification

- `pnpm check` passes: type-check, lint, the full Vitest suite and `next build`.
- Looked at specifically: `tests/render/landing.test.tsx`, `handoffs.test.tsx` block (g),
  `a11y.test.tsx` (landing at 1280 px and 375 px, all four roles), `keyboard.test.tsx`,
  `tests/guards.test.ts`, `lib/contrast.test.ts`, `lib/view/landing.test.ts`.
- Visual check is the owner's (CLAUDE.md): on the branch, run `pnpm dev` and open `/` at desktop
  width and at 375 px. To go back: `git switch master`. To keep it: merge
  `landing-government-style` into `master`.

## Changes

- 2026-10-13: **The full-width header is back, and is now in the design system.** The owner saw
  the floating glass nav and preferred the earlier header that goes across the whole screen.
  `SiteHeader.tsx` is restored to that version: a solid `bg-surface-solid` band with a bottom
  rule, in flow, the 48/56 px seal and the city's name on the left, the section links, the
  "City staff" accent link and the 44 px "Plan an event" button on the right, one "Menu" button
  below 1024 px. `docs/rime-and-ink-design-system.md` gains a "Site header" pattern (under
  Layout, Links and Implementation Notes) with its measurements and when to use it instead of
  the floating nav. The rest of the Rime & Ink restyle below stands.
- 2026-10-13: **The layout was put back on the Rime & Ink style guide, at the owner's request**
  ("make the landing page with its current new layout follow the established design style
  guide"). The first build of this plan kept the tokens but not the system: it was flat, with no
  eyebrow pills, small headings and tight sections. The "Treatment" column of the table above
  and the "Visual rules" paragraph describe that flat build and no longer hold. What the page
  uses now, section by section, with nothing moved or removed:
  - Ground: `.page-atmosphere` (frost, grid, grain).
  - Header: first restyled as the floating glass nav; the owner preferred the full-width band,
    so it is back as it was (see the entry above).
  - Title: eyebrow pill "Office of the City Clerk" (it replaces the three-step text trail, whose
    last step repeated the headline), `h1` at 72 px (60 px below 640 px) with the hand-drawn
    underline under "permits", 20 px lead.
  - "I want to…": a frosted panel of list rows. "Check what your event needs": the HUD panel,
    with the material-settle entrance.
  - Sections: eyebrow pill, `h2` at 60 px (48 px below 640 px), 20 px lead, 104 px above and
    below. Eyebrows: The application, Three tiers, The rules, Costs, Questions.
  - "How to apply": the scroll thread and lit markers are back (`useReducedMotion` returns to
    `hooks.ts`); "After you apply" is a plain panel.
  - Tiers, trigger table, fees, questions: frosted panels. Tier names carry the tier's icon on a
    tinted tile; labels are the 11 px overline; money and fees are mono.
  - Footer: the one night section, with the teal and indigo glows, overline headings at .14em and
    mint links.
  - Not taken from the guide, on purpose: no tilt, idle float or surface sweep on the checker (it
    is a working form, and the page keeps no ambient loop); no indigo column wash on the trigger
    table (no tier is recommended).
  - Anchors: sections take a negative scroll margin so a nav link lands near the top of the screen.
- 2026-10-13: **The owner removed the official bar and the nav strip after seeing the page.** The
  "An official website of the City of Permitopolis" line is gone. The dark nav strip is gone and
  its four links moved into the header row, just before "City staff". With the links beside the
  city's name the row needs about 1000 px, so the "Menu" fallback now starts below 1024 px, not
  768 px. The footer is the only night band left, which is what the design system allows. The
  table above shows the page as it now stands.
- 2026-10-13: **The header switches layouts with CSS, not `useIsNarrow()`.** Both layouts are in
  the markup (`hidden md:flex` and `md:hidden`). With the hook, the server-rendered page is the
  wide layout and a phone would show it for a moment, overflowing, before the script swapped it.
- 2026-10-13: **The fictional-city line and the demo guide link are a footer column** ("About this
  site"), not a separate bottom bar.
- 2026-10-13: **The permit tier rows are a labelled list, not a table.** A six-column table does
  not fit 375 px; each row is a heading with the tier's icon, a sentence, and a three-item
  description list.
- 2026-10-13: `lib/view/landing.ts` had five comments naming the old layout ("three-card grid",
  "frosted panels"); they were reworded. No code in it changed.
- 2026-10-13: `docs/readme.md` had three notes about the old page that the rebuild settles (the
  tilted panel's overflow at 375 px, the scroll thread under reduced motion, ambient loops with
  no pause); they were updated.

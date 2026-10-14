# Motion pass: anchor links on the landing page, and what changes in the app

## Context

The landing page has 13 in-page anchor links (header nav, the phone "Menu", the "I want to…" rows,
the footer, the skip link). Today a click jumps instantly, nothing marks where you landed, and the
links have no hover motion beyond the task row's 2px nudge. In the app, most state changes swap
instantly: a wizard step, a role switch on the same URL, "Who's up" after an action, count badges.

The aim is a subtle pass in which every animation explains something: where an anchor took you,
or what just changed. Rime & Ink already defines the vocabulary ("material settling under glass",
step markers that light up, a color step and a 2px move for feedback, nothing bounces), and all
the tokens needed exist in `styles/tokens.css`, which stays untouched.

**Motion thesis**
- **Focal moment (landing):** following an anchor. The page glides to the section and the
  section's eyebrow pill lights like a step marker the thread has reached, then settles back.
- **Continuity (app):** what just changed re-settles; nothing else moves.
- **Feedback:** links and arrows answer the pointer with a color step or a 2px move.
- **Budget:** transform, opacity, color and one small box-shadow. No loops, no new dependency.

## Part 1: Landing page anchors

1. **Glide.** `app/globals.css` (`@layer base`, beside the existing `html:has(...)` rule):
   `html:has([data-anchor-glide]) { scroll-behavior: smooth; }` inside
   `@media (prefers-reduced-motion: no-preference)`. `LandingScreen.tsx` puts `data-anchor-glide`
   on its root, so only the landing page scrolls smoothly; app screens keep instant scrolling.
   `app/layout.tsx` adds `data-scroll-behavior="smooth"` to `<html>`: Next 16 no longer switches
   smooth scrolling off during route changes unless this is set
   (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`, "Scroll Behavior
   Override"), and "Plan an event" must not glide to the top of the wizard.

2. **Arrival.** New `components/landing/useAnchorArrival.ts`, used by `LandingScreen`:
   - Returns an `onClick` for the page root (React clicks bubble out of the phone menu's portal).
     A click on `a[href^="#"]` whose target is one of `SECTION_ID`'s sections starts an arrival.
     It also runs once on mount for a deep link (`/#fees`) and on `hashchange` (back/forward).
   - An arrival watches the target's eyebrow with a one-shot `IntersectionObserver`; when it
     enters the screen the section gets `data-arrived`, removed after 1400ms. With no
     `IntersectionObserver` (the test harness) it is set at once. A second click restarts it.
   - `sections.ts`: `SECTION` gains `group/section`. `SectionHeading.tsx` gives its `Eyebrow`
     `transition-[border-color,box-shadow] duration-[var(--dur-settle)] ease-frost
     group-data-arrived/section:border-indigo-650 group-data-arrived/section:shadow-step-lit
     group-data-arrived/section:duration-[var(--dur-gentle)]`: lit in 240ms, released over 820ms.
   - It is a transition on a state, not a keyframe, so under reduced motion the pill still lights
     and clears (it snaps); the meaning survives without movement.

3. **Phone menu fix that smooth scrolling needs.** Radix returns focus to the "Menu" button when
   the menu closes, with a plain `focus()` (`@radix-ui/react-dropdown-menu/dist/index.mjs:115`),
   which scrolls the header back into view and would cancel the glide. In
   `components/landing/SiteHeader.tsx`, an anchor item's `onSelect` sets a ref and the content's
   `onCloseAutoFocus` calls `preventDefault()` when it is set. Focus then follows the anchor, as
   it does for a plain link.

4. **Link feedback.**
   - `components/ui/site-header.tsx` `SiteHeaderNavLink` and `sections.ts` `NIGHT_TEXT_LINK`:
     replace `hover:underline` with `underline decoration-transparent hover:decoration-current
     transition-colors duration-[var(--dur-fast)] ease-frost`. The underline fades in; nothing
     else moves, as the design doc requires for the site header.
   - `sections.ts` `TEXT_LINK` ("City staff"): add the same `transition-colors` for its ink step.
   - `components/landing/QuickTasks.tsx`: the four in-page rows take `ArrowDownIcon` (they jump
     down this page) and it moves 2px down on row hover or focus; "Plan an event" keeps
     `ArrowRightIcon` (it leaves the page) and it moves 2px right. `TaskRow` takes an
     `icon`/`direction` prop; classes are `transition-transform duration-[var(--dur-fast)]
     ease-frost group-hover:translate-y-0.5 group-focus-within:translate-y-0.5` (or `-x-`).
   - Class strings with `outline-none` stay on one line (`tests/guards.test.ts:101`).

## Part 2: The app

5. **One hook: `components/ui/use-settle.ts`** (`"use client"`).
   `useSettle<T>(value, { y = 6, fromOpacity = 0 })` returns a ref. When `value` changes (never on
   mount; it compares with the previous value, so StrictMode does not fire it), it runs
   `el.animate()` from `opacity`/`translateY(y)` to rest. Duration and easing are read from
   `--dur-gentle` and `--ease-settle-curve` with `getComputedStyle`, so no raw timing lives in
   code. Under `prefers-reduced-motion: reduce` it drops the movement and keeps a short fade
   (script animations are not covered by the global CSS rule). No `el.animate` (jsdom): no-op.

6. **Where it is used** (each answers "what just changed?"):
   - `components/wizard/WizardScreen.tsx`: a wrapper around `{stepContent}`, value `step`.
   - `components/shell/AppShell.tsx` and `CityShell.tsx`: the page region, value `role`, opacity
     only (`y: 0`, `fromOpacity: 0.4`). A transform here would re-anchor the wizard's fixed plan
     bar for the length of the animation. This marks a switch between two city roles on the
     same URL, which today re-renders with no visible sign.
   - `components/domain/WhoIsUp.tsx`: the list, value the parties and their statuses joined; the
     up-now row also gets `transition-colors` (tokens) for its wash and bar.
   - `components/ui/count-badge.tsx`: the number, value `count`, `y: 3` (board columns,
     pipeline columns, the sidebar's queue count, the city lists).
   - `components/landing/PermitChecker.tsx`: the tier and fee row, value `tier:total`.

7. **Steppers read as progress.** `components/ui/wizard-stepper.tsx` marker and connector, and
   `components/domain/StateStepper.tsx` marker and connector:
   `transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-gentle)]
   ease-frost` (StateStepper's bare `transition-colors` goes onto the tokens).

8. **User menu.** `components/shell/UserMenu.tsx`: the chevron gets `transition-transform
   duration-[var(--dur-fast)] ease-frost group-data-[state=open]/button:rotate-180`.

9. **Existing motion onto the tokens** (retiming only, so the new motion and the old share one
   curve): `duration-100` to `duration-[var(--dur-tap)]` and `duration-150` to
   `duration-[var(--dur-fast)]`, each with `ease-frost`, in `components/ui/{dialog,popover,
   dropdown-menu,select,tooltip}.tsx`; `origin-top` on the command palette
   (`components/ui/command.tsx`, per the design doc); `duration-300` on the tier ring in
   `ResultPanel.tsx` and `WizardScreen.tsx` to `duration-[var(--dur-soft)] ease-frost`; the bare
   `transition-colors` in `components/shell/CitySidebar.tsx` onto fast/frost. `sheet.tsx` is
   left alone (its classes are asserted in `sheet.test.tsx`).

## Deliberately not in this pass

- Page-to-page transitions (the design doc's frost wipe): heavy for a tool people click through.
- Cards and rows travelling between columns: needs FLIP; React's `<ViewTransition>` does not
  fire for this store's synchronous updates.
- Scroll reveals on landing sections, tab-panel fades, list staggers: decoration, not meaning.
- A sticky header with a scrollspy: the header scrolls away by design.

## Tests

- `components/ui/use-settle.test.tsx`: with `Element.prototype.animate` stubbed, no call on
  mount, one call per change, opacity-only keyframes when `matchMedia` reports reduced motion.
- `tests/render/landing.test.tsx`: the root carries `data-anchor-glide`; clicking "Fees" sets
  `data-arrived` on `#fees` and it clears after the hold (fake timers); the skip link sets none;
  the in-page task rows and the door row render different arrows.
- Existing assertions stay true: link names and hrefs, the first tab stop, `WhoIsUp`'s
  `border-indigo-650`/`bg-pill`, the sheet classes, the 22-page Suspense guard.

## Housekeeping (CLAUDE.md)

- First step: save this plan as `docs/plans/2026-10-13-motion-pass.md` and keep it current.
- Read `~/.claude/skills/impeccable/reference/craft-floor.md` before the first UI edit.
- `docs/rime-and-ink-design-system.md`, "Motion > Patterns": add "Anchor glide and arrival" and
  "Change settle"; note the site header underline now fades in. `docs/readme.md`: the same, in
  short. `components/kit/KitScreen.tsx` "Motion": one demo of the change settle and the lit
  eyebrow. `docs/log.md`: one entry at the top.
- Work on the current `user-menu` tree as it stands; no commit unless asked.

## Verification

1. `pnpm check` (type-check, lint, tests, build) passes.
2. Run the design detector once on the changed files:
   `~/.claude/skills/impeccable/scripts/impeccable detect --json <changed targets>`.
3. For the user to look at in their own dev server (I do not open a browser):
   - `/`: click each header, task-row and footer link; the page glides and the eyebrow lights,
     then fades. Click the same link twice. Open `/#fees` directly.
   - `/` below 1024px: "Menu" > "Fees" glides and stays there (does not bounce back to the top).
   - `/` then "Plan an event": the wizard opens at the top with no glide.
   - With "Reduce motion" on in the OS: jumps are instant, the eyebrow still lights.
   - Wizard: Next/Back settles the step and the stepper fills; the plan bar does not move.
   - A case page: switch Clerk to Public Works in the user menu; act on a task and watch
     "Who's up" and the sidebar count.

## Status

Done on 2026-10-13: every step in Parts 1 and 2, the tests, the kit demo and the docs.
Type-check, lint and build pass; 3,241 of 3,242 tests pass (see the last item under Changes).
Not watched in a browser: the list under "Verification", step 3, is the owner's to look at.

## Changes

- **AppShell settles on the applicant, not the role.** Its page region is only shown to the
  Applicant, so the role never changes there; what changes in place is which applicant
  (`personaId`). CityShell settles on the role, as planned.
- **`useSettle` also skips an element that appears along with the change** (for example the page
  that mounts when the stored demo is read), and reads the tokens from `:root` rather than from
  the element. Both came out of writing its tests.
- **The tooltip had no duration class at all**; it got `--dur-tap` and `ease-frost` like the rest.
- **The work landed on `master`, uncommitted.** `user-menu` was merged while this was in progress.
- **One test fails that this work did not touch:** `tests/render/handoffs.test.tsx`, path 5,
  cannot find "Width (ft)". It fails the same way on a clean checkout of `0b3755d` ("Where step
  always opens on Bookable spaces"), whose log entry says the gate was not run. The fix is the
  one that change made in `applicant-states.test.tsx`: click the "Draw an area" tab first.

# Landing page: full-screen mobile menu

## Context
Under 1024px the landing page's site header (`components/landing/SiteHeader.tsx`) folds its
section links and the two doors into a "Menu" button that opens a 240px Radix dropdown. The user
wants that menu to take over the whole screen instead. Copy to `docs/plans/2026-10-14-landing-fullscreen-menu.md`
before starting work.

## Approach
Swap the `DropdownMenu` for the shared `Dialog` (`components/ui/dialog.tsx`), restyled as a
full-screen, opaque panel. A Dialog gives the focus trap, Esc to close, scroll lock and a named
dialog for free; no new primitive, no direct `radix-ui` import from a surface.

### `components/landing/SiteHeader.tsx`
- Keep the "Menu" button as `DialogTrigger asChild`, controlled with `open` state.
- `DialogContent` with `showCloseButton={false}` and className overrides (tailwind-merge wins):
  `inset-0 top-0 left-0 translate-x-0 translate-y-0 w-full max-w-none sm:max-w-none h-dvh
  flex flex-col gap-0 rounded-none border-0 bg-surface-solid p-0 shadow-none backdrop-blur-none
  overflow-y-auto`, motion per the design doc's "Mobile menu: 180ms in from -8px, scale(.985)"
  (`data-open:slide-in-from-top-2 data-open:zoom-in-[.985] duration-[180ms]`, no zoom on close).
- Layout inside, in the same `page-container`:
  1. **Top row** matching the header band (same `py-4 sm:py-5`, bottom `border-line-subtle`):
     `SiteIdentity` on the left (closes the menu on click), a 36px secondary "Close" button with
     `XIcon` on the right, in the exact spot the "Menu" button sat, so it toggles in place.
  2. `DialogTitle` "Menu" as `sr-only`; `aria-describedby={undefined}` (no description).
  3. **Section links** from `SECTION_LINKS`, stacked, full-width rows ≥44px, large display type
     (`font-heading text-h4 font-bold text-fg`), divided by `border-line-subtle`.
  4. **Doors** at the bottom (`mt-auto`): "City staff" as a `TEXT_LINK`, then "Plan an event" as a
     full-width primary `Button asChild` (44px). Both keep `doors.cityStaff` / `doors.planAnEvent`
     onClick and close the menu.
- Anchor links: on click set `followedAnchor.current = true` and close the dialog; keep the
  existing `onCloseAutoFocus` guard (it runs before `useReturnFocus` and its `preventDefault`
  stops focus jumping back to the trigger and scrolling the header into view). The anchor still
  navigates natively, so `useAnchorArrival`'s root click handler (bubbles through the portal)
  and the smooth glide keep working.
- Auto-close when the viewport crosses 1024px is not needed (the trigger is hidden ≥lg, but an
  open dialog would stay): add `lg:hidden` to the content so a rotate/resize never leaves a
  full-screen layer over the desktop header. Closing it on resize is overkill.
- Update the file's doc comment ("fold into one 'Menu' button" → opens a full-screen menu).

### `docs/rime-and-ink-design-system.md`
- Line ~171 "Under 1024px": the Menu button opens a full-screen menu on the solid band fill: the
  header row repeated with a Close button in the Menu button's place, the section links stacked
  large, then the two destinations at the bottom (primary button full width).
- Line ~296 motion entry stays (180ms in from -8px, scale(.985)), noted as the full-screen menu.

### `docs/log.md`
New entry at the top.

## Verification
- `pnpm check` (typecheck, lint incl. no raw colors, tests, build).
- Hand to the user to look at on a phone width (<1024px): open, Esc/Close, an anchor link glides
  and lights its section with the menu gone, both doors route and set the role, Tab stays inside.

## Status
Done. typecheck, lint and build pass; tests pass except `handoffs.test.tsx` path 5 ("Width (ft)"
label), which fails the same with these changes stashed.

## Changes
- Overriding `DialogContent`'s classes did not work: `cn` cannot resolve the custom tokens
  (`rounded-panel`, `shadow-hud`, `backdrop-blur-hud`, `zoom-in-95`), so `DialogContent` got a
  `fullScreen` prop with its own class set instead.
- Instead of `lg:hidden` on the content (the overlay would stay), an effect closes the menu when
  the window widens past 1024px.

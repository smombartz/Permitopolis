# Where step: full-width map, list underneath

## Context

On the wizard's Where step the map shares a row with its keyboard list from 768px up, so it
gets roughly half of the step column and reads too small. The map should span the full width
of its parent, and the list (or the area and route controls) should sit underneath it.

**How I read "the right column":** the list beside the map inside `LocationPicker`, since that
is what shares the map's parent div. The sticky "Your plan so far" panel on the far right of
every wizard step stays where it is. If you meant that panel instead, say so and the plan
changes to `WizardScreen.tsx`.

## What changes

All layout changes are in `components/map/LocationPicker.tsx`. The same wrapper is repeated in
the four tab panels (lines 265, 323, 407, 460).

1. **Stack at every width.** On each of the four wrappers, drop `md:flex-row` so it stays
   `flex flex-col gap-4`, and add `@container` so the content underneath can respond to the
   picker's own width.
2. **Map fills the row.** On the four `MapCanvas` elements, drop `flex-1 md:w-2/3`.
   `MapCanvas` already sets `w-full`; the area tab keeps `touch-none`. The map stays 16:10
   from its viewBox, so it is about 518px tall in the 828px step column.
3. **Content underneath, in columns where there is room.** A single column of buttons under a
   map this wide would make a very long page, so the lists become grids keyed to the picker's
   width (container queries, because `/dev/map` shows the picker at half width):
   - Bookable spaces `<ul>` (line 290) and street segments `<ul>` (line 429):
     `grid grid-cols-1 gap-2 @lg:grid-cols-2 @3xl:grid-cols-3` (streets keeps `gap-1.5`).
   - Route (line 487): the outer `div` becomes `flex flex-col gap-2`; its `<ul>` (line 488)
     gets the same grid. The miles and "Undo last segment" row and the availability note stay
     under the list.
   - Area (line 358): the outer `div` becomes `flex flex-col gap-3`; the Area select and the
     Width/Length pair sit in one row from `@lg` up, stacked below that. The sq ft line and
     availability note stay under them.
   - Remove `flex-1 md:w-1/3` from all four.
4. **Wording that says "beside".**
   - `components/wizard/StepWhere.tsx:38`: "A list under the map does the same by keyboard."
   - `LocationPicker.tsx:150` doc comment, and the comment at line 444 ("the column is a third
     of the row"), which no longer holds.
   - `tests/render/map.test.tsx:27` test title.
   - `docs/spec/prd.md:241` and `docs/plans/2026-10-12-permitopolis-prototype.md` lines 585
     and 760: "beside" becomes "under", so the sources do not send a later change back.

Nothing in `MapCanvas.tsx`, `WizardScreen.tsx` or any frozen contract changes. No test asserts
on the layout classes; the render tests find the lists by role and name, which stay the same.

## Who else gets this

`LocationPicker` has three consumers and all three take the new layout: `/apply`, the amend
wizard (it reuses `StepWhere`) and `/dev/map`. No prop is added to keep the old layout.

## Housekeeping (project rules)

- First step on approval: copy this plan to `docs/plans/2026-10-13-where-step-map-full-width.md`.
- Add a log entry at the top of `docs/log.md`.
- Update the `LocationPicker` description in `docs/readme.md` if it describes the layout.

## Verification

- `pnpm check` (type-check, lint, tests, build).
- For you to look at, since it is visual: `/apply` step 2 on all four tabs at 1280px and at
  375px, the amend wizard's Where step, and `/dev/map`.

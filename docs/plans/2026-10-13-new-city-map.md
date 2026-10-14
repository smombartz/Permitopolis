# New Permitopolis city map

## Context

The app's map is 16 straight lines and 12 rectangles in a 1200 x 800 box, with no names on it.
You drew a proper one: `../permitopolis-map/permitopolis-map.svg`, 1600 x 1000, in 13 named
layers (land use, parks, river, streets, buildings, amenities, labels). Its shape ids already
match the app's data: the 10 spaces in `lib/data/inventory.ts` and the 16 segments and 19 nodes in
`lib/data/streets.ts`. City Hall Plaza (200 x 100) and the Great Lawn (200 x 200) are still
exactly 20,000 and 40,000 square units, so "1 unit = 1 foot" and the capacity maths hold.

Rules, fees, conflicts and the seed refer to places by id only. The work is therefore in the
drawing layer: `lib/data/mapGeometry.ts`, `components/map/**` and their tests. No frozen contract
is edited.

**Branch:** all of this is done on a new branch, `new-city-map`, created from `master`. Nothing
is committed or merged to `master` until you ask.

Decisions you made:

1. **Colors:** keep the map's own palette, as map tokens in a new `styles/map.css`.
2. **Updates:** the SVG stays the source; `pnpm map:sync` regenerates code from it.
3. **Thumbnails:** zoom to the place.
4. **Map key:** shown, collapsed, on the large maps.

## Approach

The map is drawn as inline React SVG layers generated from your file, not loaded as an image.
Inline layers stay sharp when zoomed, use the app's font, let names sit above highlights, and let
each screen show only the layers it needs.

### 1. Source and sync script

- Copy the SVG to `design/map/permitopolis-map.svg`. This is the file you replace after editing.
- `scripts/sync-map.mjs` (Node, no new dependency; parses with the `jsdom` already installed for
  tests, or a small tag parser if it is not a direct dependency). `pnpm map:sync` writes two files;
  `pnpm map:sync --check` writes nothing and exits non-zero if they are stale.
  - **`components/map/art/layers.generated.tsx`**: one component per layer. Every `fill` and
    `stroke` hex becomes a token class (`fill-map-residential`), looked up from `styles/map.css`.
    A color with no token stops the sync and names the shape, so nothing lands unnamed. `id`s
    are dropped (the accessibility audit rejects duplicate ids, and several maps share a page)
    and `font-family` is dropped so text uses the app font.
  - **`lib/data/mapGeometry.generated.ts`**: `VIEWBOX`, one rect per space, and per segment
    `{ id, d, mid, box }`. `d` is the path as drawn, so River Road keeps its curves; `mid` and
    `box` are sampled along the path (M, L, H, V, Q, C; anything else stops the sync). It also
    carries what the SVG states in `data-*` (nodes, miles, households, capacity, square feet).
- `styles/map.css`: about 40 `--map-*` colors plus an `@theme inline` block, imported in
  `app/globals.css` after `tokens.css`. `styles/tokens.css` is not touched.

### 2. Geometry (`lib/data/mapGeometry.ts`, not frozen)

- Keeps its hand-written API (`spaceShape`, `segmentPath`, `DRAWABLE_AREA_RECT`,
  `SCALE_FT_PER_UNIT`, types) and re-exports the generated data. `VIEWBOX` becomes 1600 x 1000.
- `SegmentPath` changes from `{x1,y1,x2,y2}` to `{d, mid, box}`. `ZONE_OUTLINES` goes; the art
  replaces it.
- `components/map/geometry.ts`: the `line` shape kind becomes `path`; `lineMidpoint` reads `mid`.
  `occupiedIds` is unchanged, so `lib/view/closures.ts` and `lib/view/caseDetail.ts` are untouched.

### 3. Components (`components/map/`)

- **`MapCanvas.tsx` (new)** replaces `CityBackground.tsx` and the six copy-pasted `<svg>` blocks.
  It draws base layers, then its children (highlights or pickers), then names on top with
  `pointer-events-none`. Props: `viewBox`, `labels`, `nodes`, plus svg props and `ref`.
- **`PermitopolisMap.tsx`**: highlights become `<path>`s with a white casing underneath, so tier
  colors and indigo read on the green, yellow and pink zones. Highlight labels get larger with a
  white halo.
- **`MapThumbnail.tsx`**: uses a new pure `thumbnailFrame(location)` in `lib/view/map.ts`. It
  takes the place's bounding box, pads it, grows it to at least 320 x 200, keeps the map's 16:10
  shape and clamps to the map. Names show when the frame is 480 units wide or less.
- **`LocationPicker.tsx`**: the four tabs use `MapCanvas`.
  - Bookable spaces and street segments are transparent click targets over the art, indigo when
    chosen, so the drawn shelter, field or street shows through.
  - Draw a route shows the route nodes and dims segments that cannot be added next.
  - Draw an area is unchanged apart from coordinates; `pointToSvg` already reads `VIEWBOX`.
- **`MapKey.tsx` (new)**: a collapsed "Map key" using `components/ui/accordion.tsx`, with the
  three groups from your key (land use, permit locations, amenities). Each swatch is paired with
  its name. Shown under the picker and inside `PermitopolisMap`, so it appears on `/apply`,
  `/city/active?view=map` and `/city/map`.

### 4. Seed fix the new map exposes

Six seeded area events (`s3`, `f2`, `f3`, `f5`, two in `b05-b09`) store rectangles like
`{x: 40, y: 30}` that sit in the map's top-left corner, not in the Plaza or Lawn, and four have
a width x height that does not equal their stated square feet.

- `areaLocation()` in `lib/state/seed/helpers.ts` treats `x, y` as an offset from the area's
  corner, so each rectangle lands inside its area.
- The four mismatched sizes are corrected to match their stated square feet (for example
  6,000 sq ft becomes 100 x 60). Stated square feet and capacity do not change, so no tier, fee
  or rule outcome moves.
- This changes the seed fingerprint, which resets demos saved in a browser. That is wanted:
  saved rectangles in old coordinates would otherwise be wrong.

### 5. Tests

- `tests/map-sync.test.ts` (new): runs `sync-map.mjs --check`, and checks the SVG's nodes, miles,
  households, capacities and square feet against `streets.ts` and `inventory.ts`.
- `lib/view/map.test.ts`: add `thumbnailFrame` cases (one shelter, one block, the 5K loop, a
  place at the map's edge). The completeness and 20,000 / 40,000 sq ft tests stay as they are.
- `lib/state/seed/scripts.test.ts`: every seeded area rectangle is inside its area and its
  width x height equals its square feet.
- `tests/render/map.test.tsx`: the lap test counts highlight paths, not `svg > line`. Add: the
  map key is present and collapsed; names render above highlights.
- Existing guards keep applying: no raw color in `components/`, no duplicate ids, every svg named
  or hidden.

### 6. Docs

- This plan is saved as `docs/plans/2026-10-13-new-city-map.md` before work starts and kept
  current.
- `CLAUDE.md`: the Style rule names `styles/map.css` as the map's palette; Commands gains
  `pnpm map:sync`.
- `docs/readme.md`: a short "City map" section (source file, sync, layers, thumbnail framing).
- `docs/log.md`: one entry at the top.

## Order of work

1. [x] Branch `new-city-map` from master; save the plan to `docs/plans/`.
2. [x] Add the SVG, `styles/map.css`, the sync script and `map:sync`; generate both files.
3. [x] Switch `mapGeometry.ts` and `geometry.ts` to the new shapes; fix the seed rectangles.
4. [x] Build `MapCanvas`, then move `PermitopolisMap`, `MapThumbnail` and `LocationPicker` onto it.
5. [x] Add `MapKey`.
6. [x] Update tests, docs and the log; run the gate.

## Verification

- `pnpm map:sync` twice leaves no diff; `pnpm map:sync --check` passes.
- `pnpm check` (type-check, lint, tests, build) passes.
- For you to look at, since I do not check visuals: `/dev/map` (all three components),
  `/apply` step 2 (all four tabs, including dragging an area on the Plaza and the Lawn),
  `/city/active?view=map`, `/city/map`, a case's Overview, and a permit page on a phone width
  and in print preview.
- What most needs your eye: whether tier colors read over the colored zones, whether highlight
  labels collide with street names, and whether the thumbnail framing feels right.

## Not in this plan

- The map itself is not redrawn; any change to it is an edit to your SVG and a sync.
- `/city/map` still colors by tier, though the PRD says by status. That predates this work.

## Changes

- **Map key is a `<details>`, not the Accordion.** The Accordion wraps its trigger in a heading,
  and the accessibility audit checks that headings go down one level at a time; a key under a
  map would have put a stray heading on four screens. `<details>` is the pattern My queue
  already uses.
- **`MapCanvas` takes an `above` slot** as well as `children`: a booking's own label is drawn
  over the street names, where the plan only said names go on top.
- **Thumbnail lines are in screen pixels** (`non-scaling-stroke`), so a highlight is as heavy on
  one shelter as on the whole loop. Not in the plan; it follows from zooming.
- **The source SVG's `miles` are checked only where the drawing states them.** It gives miles
  for Main Street and River Road and not for the residential blocks.

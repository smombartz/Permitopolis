# Cases pipeline board: stacked, wider cards (/impeccable layout)

## Context

On `/city/cases` (Board view, any city role) the cards are hard to read. The board sits inside
the 1180px page column with 7 state columns at `min-w-44` (176px). After column padding, card
border and card padding, a card has about **134px** for content. Into that the card fits
several things side by side:

- row 1: event title + applicant **beside** up to three badges (Stalled, commission gavel, Tier).
  "Special event" alone is about 110px, so the title truncates to a few letters;
- row 2: case id **beside** "Sun, Jul 11 · 69 days to go", spread with `justify-between`;
- row 3: state chip, then waiting-on chips ("Public Works & Safety · 4d" is about 200px).

Goal: stack the content into clear groups read top to bottom, and give the cards more width.
The user chose to let the board use the full window width (minus gutters) instead of the
1180px column.

## Spatial thesis

- **Reading path:** what event (id, name, applicant) → when (date, days to go) → what kind
  (tier, state/ending, flags) → whose move (waiting on).
- **Leads:** the event name (semibold, up to 2 lines). Everything else supports it.
- **Rhythm:** tight inside a group (`gap-0.5`/`gap-1.5`), generous between groups (`gap-3`);
  a hairline above "whose move", the one group that answers "who do I chase".
- **Density:** one fact per line in the top groups; chips wrap; waiting-on chips stack one per
  line. No row holds two competing facts spread apart.

## Changes

### 1. `app/globals.css`: a `.page-bleed` utility next to `.page-container`

```css
/* Breaks a block out of .page-container to the window's width less the gutters, the same
   100vw - 2 * gutter the container uses below 1180px. */
.page-bleed {
  margin-inline: min(0px, calc(50% - 50vw + var(--container-gutter)));
}
```

Same `100vw` basis the container already uses, so no new horizontal-scroll risk. (Not
`styles/tokens.css`, which is frozen; this reuses its existing `--container-gutter`.)

### 2. `components/city/lists/PipelineBoard.tsx`

**Board row:** `<div className="page-bleed flex gap-3 overflow-x-auto pb-2">`.

**Columns:** `min-w-44` → `min-w-60` (240px, card content about 198px), keep `flex-1 basis-0`
(the render test requires `flex-1`), add `max-w-80` (320px) so a one-column board (State
filter) or a very wide window does not stretch cards back into long horizontal rows. Update the
comment above the column: columns share the window's width, at least 240px each, and the row
scrolls sideways when 7 do not fit.

**Card (`PipelineCard`)**, inside the same `Link` (same classes, `gap-2` → `gap-3`):

```
PMT-27-0118                        ← CaseId, text-xs (eyebrow)
Riverfront Summer 5K               ← Truncate lines={2}, text-sm font-semibold text-fg
Riverside Running Club             ← Truncate (1 line), text-xs text-fg-secondary
                                     (gap-3)
Sun, Jul 11                        ← DateText short, text-xs
69 days to go                      ← text-xs text-fg-label   ("No date yet" if none)
                                     (gap-3)
[◆ Special event] [Quote sent] [⚠] ← flex-wrap gap-1.5: TierBadge, then ending chip
                                     (if c.ending) or state chip (if showStateChip),
                                     StalledBadge, CommissionBadge
────────────────────────────────── ← border-t border-line-subtle pt-3
[A Applicant · 4d]                 ← WaitingOnChips stacked: flex-col items-start,
[P Public Works & Safety · 2d]       each chip max-w-full so a long label truncates
```

- Identity uses `Truncate` (`components/ui/truncate.tsx`, already has `lines={2}` and a `title`
  tooltip) directly instead of `EventTitle`, which is single-line by design for table rows.
  `EventTitle` itself is not changed.
- A case with an ending shows its ending chip in the chips row and has **no** waiting footer
  (today the ending chip replaces the waiting chips; same rule, new position).
- Empty waiting: `WaitingOnChips` `emptyText="Nothing waiting"` at `text-xs`.
- Behavior, link target, `from`, and the data-model (`boardCardWaiting`, `eventDate`,
  `isStalled`) are unchanged. No view-model changes.

### 3. Tests: `tests/render/city-lists.test.tsx`

- Rename "a board card shows the event date beside the days to go" → "…with the days to go";
  assertions stay.
- Add: a board card stacks its waiting-on chips (the waiting container has `flex-col`) and a
  case with an ending has no "Nothing waiting" footer.

### 4. Docs (per CLAUDE.md)

- Copy this plan to `docs/plans/2026-10-14-pipeline-board-cards.md` before editing.
- Log entry at the top of `docs/log.md`; note `.page-bleed` in `docs/readme.md`.

## Before editing

Read `/Users/trarara/.claude/skills/impeccable/reference/craft-floor.md` (Impeccable step 3).

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (render tests for city lists, the no-raw-color
  guard), then `pnpm check`.
- `impeccable detect --json --scope layout components/city/lists/PipelineBoard.tsx app/globals.css`;
  explain or fix any finding.
- Visual check is the user's (CLAUDE.md): Board view grouped by State and by Event date, at
  1280, 1440 and 1920 wide; a State filter (one column); a long event name; a card waiting on
  Public Works & Safety; an ended case (Closed and ended on).

## Status

Done 2026-10-14. `pnpm check` passes (3,247 tests); the layout detector reports nothing.

## Changes

- The case id moved from above the event name to under the applicant, so the name leads the
  card and nothing sits on top of it as a label.
- The board also gets `justify-center-safe`: on a window wider than seven 320px columns it
  centers instead of hugging the left gutter, and it never centers past the scroll start.
- The ended-case test finds its card by "Denied", because that applicant's organization has
  the event's name and the name shows twice on the card.

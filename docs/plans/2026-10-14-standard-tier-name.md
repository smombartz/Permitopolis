# Rename the "Reviewed" tier to "Standard"

**Status:** done 2026-10-14 (steps 0–5). Typecheck and lint pass; tests updated, not run.

## Context

The middle tier is labelled "Reviewed", which reads as a finished action ("this event has been
reviewed") when it means "this event needs a review". It also sits awkwardly next to the case
states "In review" and "Needs info". The user chose **Standard**: Instant / Standard / Special
event reads as a size scale and never as a status. Only the label people see changes; the
internal `Tier` key `"reviewed"` (and `reviewedAttendance`, `fees.*.reviewed`, `lead.reviewed`,
`IntakeTab "reviewed"`) stays, so no data shape, seed id or rule changes.

## Rule for the replacement

Replace the tier name `Reviewed` → `Standard` wherever it is the tier's name (whole word,
capitalised). Do **not** touch:
- `Reviewed by` (a column/field header about who reviews: landing `PermitTiers.tsx:72`, PRD table)
- lowercase `reviewed` (verb: "reviewed by Public Works & Safety", and the `reviewed` key)
- camelCase identifiers (`tierIsReviewedOrSpecial`, `reviewedAt`, `reviewedCls`): leave as is
- `In review`, `Needs info`, the `Review` phase

Find with `grep -rnP "\bReviewed\b(?! by)"`, apply with a scripted perl substitution of the same
pattern, then read the whole diff by eye.

## Steps

0. Copy this plan to `docs/plans/2026-10-14-standard-tier-name.md` (CLAUDE.md rule).
1. **Label sources** (what screens render):
   - `lib/types.ts:404` `TIER_LABEL.reviewed = "Standard"` (frozen contract, but this is an
     owner-directed change on master, not a workstream edit), plus the comment at line 50.
   - `lib/view/cityLists.ts:514` `INTAKE_TAB_LABEL.reviewed = "Standard"`.
   - `components/city/settings/TierRulesSection.tsx`: `TIER_LABEL_SHORT`, the section
     description, the field `"Standard at"` and its hint ("…makes an event Standard, not Instant.").
   - `components/kit/KitScreen.tsx` (option label + two copy lines).
   - Copy strings in `lib/view/landing.ts`, `lib/view/settings.ts` (error "Must be at least the
     Standard lead time."), `lib/data/demoScript.ts`, seed `notes` in
     `lib/state/seed/background/b01-b04.ts`.
   - `tierSummary` in `lib/rules/classify.ts` already builds from `TIER_LABEL` ("This is a
     Standard event: …"); article "a" stays correct. Same for amend banners built from labels.
2. **Comments and JSDoc** in `lib/` and `components/` that name the tier: same substitution, so
   the code and the UI agree.
3. **Tests** (~35 files under `tests/` and `lib/**/*.test.ts`): update expected strings and
   names, e.g. `getByRole("tab", { name: /^Reviewed/ })` → `/^Standard/`,
   `"Jazz in the Plaza: Reviewed, unchanged"`, `spinbutton "Reviewed at"` → `"Standard at"`,
   `tests/render/map.test.tsx` legend.
4. **Sources of truth**: `docs/spec/prd.md`, `docs/spec/flows.md`, `docs/spec/scenarios.json`,
   `docs/readme.md`, and the project overview in `CLAUDE.md`. Also the tier glossary/badge lines
   in `docs/plans/2026-10-12-permitopolis-prototype.md`. Leave the other dated plans and
   `docs/log.md` as history.
5. Log entry at the top of `docs/log.md`; a readme note that the middle tier is "Standard" in copy
   and `reviewed` in code.

## Verification

- `grep -rnP "\bReviewed\b(?! by)" app components lib tests docs/spec docs/readme.md CLAUDE.md`
  returns nothing.
- `pnpm typecheck` and `pnpm lint` pass (tests are updated but not run, per CLAUDE.md "Testing for now").
- Note to user: a browser with saved demo state may still show old activity text such as
  "This is a Reviewed event" until Demo → Reset. The user checks badges, the intake tab, settings
  and the wizard panel visually.

## Changes

- Verification uses `pnpm typecheck` and `pnpm lint` only, following CLAUDE.md's new "Testing for now" rule.
- "Reviewed by the block-party exception" (where the tier name happens to sit before "by") became
  "Standard through the block-party exception". The insurance card's reason in `lib/rules/catalog.ts`
  and the kit ("Every reviewed event needs…") became "Every Standard and Special event needs…".

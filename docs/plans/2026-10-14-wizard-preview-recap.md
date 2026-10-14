# Wizard: no vendor default for markets, an "Other" type, and a preview that carries the event

**Status:** done 2026-10-14.

## Context

On step 1 (What) of `/apply`, picking **Market or festival** makes the right-hand preview show
"1 food vendor" (a Food or vending trigger, a vendor permit line, Health & Legal as reviewer). The
cause is `addOnsForEventType()` in `lib/view/wizard.ts:104`, which switches food or vending on with
one vendor when that type is picked. The user wants:

1. Market or festival to behave like every other type. Food vendors are chosen later, in the
   Size step's add-on toggles (`StepSize.tsx:148`), which already exist.
2. A seventh event type, **Other**.
3. A preview that shows what the applicant has entered: event type, name and description, then
   place, date, attendance and add-ons as they fill in later steps. The panel is on every step,
   so the recap goes along with them through the wizard.

## Changes

### 1. No food vending default for Market or festival
- `lib/view/wizard.ts`: delete `addOnsForEventType()` and update the step 1 comment. No type
  pre-fills add-ons any more; Class or club meetup still repeats by default (`repeatsByDefault`).
- `components/wizard/StepWhat.tsx`: `selectType` sends only `{ eventType: type }`.
- `lib/view/wizard.test.ts:80-89`: replace the market test with one that checks no type touches
  add-ons (or remove it along with the function).
- `docs/spec/prd.md:227`: change the line to say that only Class or club meetup pre-fills
  (repeat), and that food or vending is chosen in step 4.

### 2. Add an "Other" event type
`lib/types.ts` is a frozen contract for parallel builders. This is a direct request from the
user in the main session, so I'll edit it and note that in the log.
- `lib/types.ts`: add `| "other"` to `EventType` and `other: "Other"` to `EVENT_TYPE_LABEL`.
- `lib/view/wizard.ts`: append `"other"` to `EVENT_TYPES` (last).
- `components/wizard/constants.ts`: icon (`CircleEllipsisIcon` from lucide) and blurb "Something
  else. Say what it is in the description."
- `components/wizard/StepWhat.tsx`: the comment says "six kinds", change it to seven. With seven
  cards the grid's last row has one card, which is fine. When Other is selected, the description
  hint reads "Tell us what kind of event this is." instead of "Optional, one line." It is still
  not required.
- `components/map/LocationPicker.tsx` `STARTING_MODE` is `Partial<…>`, so it needs no entry.
  `PermitChecker` reads `EVENT_TYPE_LABEL` and picks Other up by itself. Rules only check for
  `block_party`, so Other classifies like any other non-street type.

### 3. The preview carries the event ("Your event" recap)
- **Shared helpers.** `lib/view/caseDetail.ts` already has `addOnsSummary`, `seriesSummary` and
  `setupTeardownText`. They only read answer fields. Widen their parameter from `EventCase` to
  `EventAnswers` and export them, so both screens describe add-ons and sessions the same way.
- **New view-model** in `lib/view/wizard.ts`:
  `eventRecap(answers): { type: EventType | null; name: string | null; description: string | null; rows: KeyValueItem[] }`
  - `rows`: Place (`location.label`), Date and hours (`fmtDate` + `fmtTimeRange`, plus
    `seriesSummary` for a series), Attendance (`fmtNumber`), Add-ons (`addOnsSummary`, or
    "None" once the Size step has been answered).
  - Rows for steps not reached yet are null, so they read "Not provided". Other
    copy can be considered later.
  - Tests in `lib/view/wizard.test.ts`: a blank recap, and a full one built from seed S3.
- **`components/wizard/ResultPanel.tsx`**: a new `answers` prop. At the top of the panel, above
  the tier badge, add a "Your event" block:
  - The event type with its icon (`EVENT_TYPE_ICON`) and label in a chip; muted "Pick a type"
    until one is chosen.
  - The name as the heading (`text-fg font-semibold`); "Untitled event" in `text-fg-label` while
    it is empty.
  - The description in `text-fg-secondary` when there is one.
  - `KeyValueList` (`components/ui/key-value`) with the recap rows.
  - Then a divider (`border-line-subtle`), and the tier, triggers, fees and the rest as they are
    now.
- **`components/wizard/WizardScreen.tsx`**: pass `answers` to both `ResultPanel` uses (the
  sticky aside and the phone sheet).

### 4. Housekeeping
- `docs/log.md`: add an entry at the top.
- Save this plan as `docs/plans/2026-10-14-wizard-preview-recap.md` before starting.

## Verification
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (wizard and caseDetail view tests, the no-raw-color
  guard), then `pnpm check` for the build.
- Checking the UI is the user's job: on `/apply`, pick Market or festival and confirm the
  preview has no vendor or Health & Legal line. Pick Other. Type a name and a description and
  watch them appear in the preview. Move through Where, When and Size and watch the recap rows
  fill in.

## Changes
- The shared helpers went into a new `lib/view/eventSummary.ts` instead of being exported from
  `caseDetail.ts`, so the wizard's view-model does not import the case detail module, which pulls
  in `lib/state`. `caseDetail.ts` imports them from there and re-exports `seriesSummary`.
- The Market or festival blurb no longer says "usually with food or vendors".

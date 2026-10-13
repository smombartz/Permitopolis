# Accessibility and responsive pass (workstream 5F)

Part of `docs/plans/2026-10-12-permitopolis-prototype.md` (Phase 5, workstream 5F). One pass over
the whole prototype, alone, on `build`, after the Phases 5 and 6 integration (`057b0c19`). No dev
server and no browser (CLAUDE.md): the pass works from the markup, the classes and jsdom tests, so
it is systematic, not impressionistic. What a person with a screen reader and a phone still has to
check is written down at the end and in `docs/readme.md`, "Accessibility".

## The bar

PRD, "App shell, routes and demo controls" (Look and feel) and "Success test": WCAG 2.2 AA.
Keyboard reachable, visible focus, status changes announced through `aria-live`; color always
comes with an icon and a label; city screens work from 1280px wide; applicant screens and the
landing page work down to 375px. Design system: Rime & Ink tokens only, `fg-tertiary` never on
text, reduced motion honored.

## How

1. **The instrument first.** `tests/render/a11y.test.tsx`: every route, for every role that can
   reach it, against the seed, inside its real shell. It asserts one `h1`, a `main` landmark, no
   unnamed button, link or form control, and no duplicate ids. Written before the fixes, so its
   first run is the list of what is wrong.
2. **Static sweeps over the classes**, each one a grep with every hit read: `fg-tertiary` on
   text; `outline-none` with no `focus-visible` ring; fixed widths wider than 335px on applicant
   screens; controls shorter than 44px on applicant screens; a pair of controls rendered for two
   breakpoints; motion not covered by the reduced-motion rule; `aria-live` regions and what
   re-renders inside them; keyboard handlers on `document` or `window`.
3. **Screen by screen**, the six headings of the brief (keyboard, names and roles, live regions,
   color and contrast, responsive, motion), fixing in the style of the surrounding code with the
   smallest change that meets the bar. No redesign.
4. **Gate and commit after each group** (`pnpm check`).

## Steps

- [x] The route and role test, and the keyboard tests for the board's card sheet, the case's
      action panel and the palette (focus moves in, Esc closes, focus returns).
      `tests/render/a11y.test.tsx` (581 pages), `tests/render/a11yAudit.ts`,
      `tests/render/keyboard.test.tsx` (18 tests)
- [x] The shell: skip link, landmarks, the top bar, the Demo menu, the coach, the palette, the
      shortcuts dialog, toasts
- [x] Shared components (`components/ui`, `components/domain`): names, focus rings, live regions,
      tap targets, `fg-tertiary`
- [x] The landing page and the demo guide
- [x] The wizard and the amendment
- [x] My events, the board and its sheets
- [x] Checkout, the permit and the public check
- [ ] My queue, Cases, Intake
- [ ] The case detail: every tab and every action panel
- [ ] Active permits
- [ ] Payments, closures map, work orders, verifications, inspections, settings
- [ ] Contrast: `lib/contrast.test.ts` extended to the token pairs the screens use
- [ ] Docs: `docs/readme.md` "Accessibility", `docs/log.md`, the main plan ticked

## Findings and fixes

### The instrument's first run

`tests/render/a11y.test.tsx` on the tree as the integration left it: 200 of 581 pages failed, on
33 distinct problems. The ones that were not one-offs:

| Found | Where | Fix |
|---|---|---|
| A table with no name (403 hits) | Every `FeeTable`, the case's payments, Active permits' list, Intake, Payments, the pipeline table, Settings' inventory, the landing page's trigger table, the demo guide's scenarios | `aria-labelledby` the department printed above a fee table; `aria-label` on the rest |
| A select's trigger with no name, its label pointing at nothing | Every `<Field><Select>`: the wizard's Frequency, the landing page's Event type, the Remind, Pay and Request information panels | `Field` hands its id and its `aria-*` to the Select root, which renders no element. `Select` now passes them down to its trigger |
| No `h1` | A shell's "This screen is built for ..." panel; an unknown case | The panel's message is its `h1`; `EmptyState` takes `headingLevel` |
| A `div` inside an `ol` | The landing page's five steps | The scroll thread sits beside the list |
| An `svg` with `role="img"` and no name | The permit's QR code | `title` |
| Headings that skip a level | The pipeline board's columns were `h3` under the page's `h1` | `h2` |
| Duplicate ids | `LocationPicker`'s three fields, hard-coded | `useId()` |

### What no test of the markup would have found: the focus ring was never drawn

The app writes a ring as `outline-none focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-focus-ring` (the readme tells a builder to). In Tailwind 4 `outline-none`
sets `--tw-outline-style: none` on the element and `focus-visible:outline-2` draws
`outline-style: var(--tw-outline-style)`. The built stylesheet has both rules:

```css
.outline-none{--tw-outline-style:none;outline-style:none}
.focus-visible\:outline-2:focus-visible{outline-style:var(--tw-outline-style);outline-width:2px}
```

Together they draw nothing. No button, link, tab, chip or row in the app showed keyboard focus.
Fixed in one place, `app/globals.css`: an unlayered `:focus-visible { --tw-outline-style: solid }`
(unlayered outranks the utilities layer), and a base-layer default ring for anything focusable
that names none. `tests/guards.test.ts` holds both rules and refuses an `outline-none` with no
other way to show focus on the same class string.

Around it:

- **The ring's color.** The design doc's `#5157d8b3` is 2.95:1 on the page ground and 2.67:1 on
  a danger-tinted row; a focus indicator needs 3:1 (WCAG 1.4.11). The token is opaque
  indigo-500 now (5.07:1 on the page, 4.3:1 or better on every tint). On the night surface the
  indigo ring is 2.1:1, so `[data-tone="night"]` gives it the mint accent (10:1).
- **Menus.** The item under the keys was `focus:bg-surface-2` on `surface-solid`: 1.02:1,
  nothing. A select's options were worse: `data-focus:` matches an attribute Radix never sets
  (it sets `data-highlighted`), so they had no highlight at all. Both get the pill fill and an
  inset ring; the palette's selected option the same.
- **Checkbox, radio, switch.** Focus was a 1px border and a 12% halo, and a checked control
  kept its own border. They take the ring.
- **A tab panel** is a tab stop with `outline-none`. It takes the ring.

### Focus was dropped when a sheet or a dialog closed

Radix hands focus back to a dialog's trigger. A card's sheet and a case's action panel open from
the URL, and the palette, the shortcuts list and every confirmation from state: none has a
trigger, so Esc left the keyboard at the top of the page. `components/ui/return-focus.tsx`
remembers what had focus when the content mounted and goes back to it; if that is gone, to the
page's content. `tests/render/keyboard.test.tsx` was written first and failed on all five.

### The rest of the shell and the shared components

- **Skip link** in both shells and on the landing page (`components/ui/skip-link.tsx`); the
  city's lands past the sidebar. `<main>` is there before hydration too, `aria-busy`.
- **Shortcuts.** One rule, `lib/keyboard.ts`: `?` fired with Ctrl held and inside a menu's
  typeahead; `/` pulled focus out from under an open sheet; the arrow keys were taken from the
  whole page (a keyboard could not scroll a list page). Cmd+Shift+K is the browser's again.
- **Live regions.** `Banner` and `InlineAlert` were `role="alert"` or `role="status"` by variant,
  on 72 uses, nearly all of them static: Active permits raised an alert for every row whose
  hold expires tomorrow, a case with such a hold raised one on arrival, and an action panel
  that could not run raised one as it opened, each again on every remount. They carry no live role now; `live` makes one a polite
  status. `Field`'s error was `role="alert"` and cut in on every keystroke of a field that
  validates as it is typed in: it is a standing polite region. `LeadTimeRisk` was a `status`
  per table row. The case's state line no longer repeats what the action's toast just said.
  The coach's live part is its step, not its buttons. `FilterBar`'s count is a status. The top
  bar's demo date is polite.
- **Names.** The persona picker's `aria-label` hid the name it shows (WCAG 2.5.3). The date
  picker's label replaced its value, so a chosen date was never read out. The palette's field
  had a placeholder for a name.
- **Contrast.** `text-current/85` on a success or warning tint is 3.9:1 (banners, a badge's
  reason, the ending banner): full strength now, with a guard. The night section's "Live
  activity" was 4.46:1.
- **Touch.** A 36px button takes a 44px tap on a touch screen (an invisible `::after`); menu
  and select items are 44px tall there; the date pickers' days too.
- `Field required` reaches a screen reader (`aria-required`); the asterisk was `aria-hidden`
  with nothing behind it.

### The applicant's side and the landing page

- **Page titles.** Every route had the one title, "Permitopolis · City Clerk · Events
  Permitting" (WCAG 2.4.2), and Next's route announcer reads the title out after each
  client-side navigation, so it said the same words every time. Each `page.tsx` now exports its
  own (`"My queue"`, `"Permit"`), under a template in the root layout, and a page about one
  record adds its name from the store (`useDocumentTitle`: "Riverfront Summer 5K · Case").
- **Landing page.** 72px and 60px headlines at 375px: "workspace," at 60px is within a few
  pixels of a 335px column. One step down below 640px (60 and 48), and a word wraps before it
  pushes the page sideways. The comparison table's triggers are row headers. The demo guide's
  seven "Start this path" and six "Jump" buttons say which.
- **Wizard.** One announcer (`WizardAnnouncer`) for a change of tier and a change at the date
  gate, on both the wizard and the amendment (which had none): the live panel and the gate's
  banner showed the same news side by side on a wide window and neither was mounted on some
  steps of a narrow one. The date button's `aria-label` ("Event date") hid the date it shows.
  The event-type cards are a radio group with a radio group's keyboard. An availability reason
  can be another event's 90-character name in a `whitespace-nowrap` pill: it wraps. The location
  picker's tabs had no height of their own once the list wrapped, its street names were
  truncated in a column a third of the row wide, and a chosen space or street is marked as
  well as tinted. A what-if sentence wraps inside the 320px panel.
- **Board.** A phone's four tabs are 44px. The stars are a radio group that says "3 stars", not
  "★". "Change your event", when it cannot be done, says why on the menu (it was a `title` on a
  disabled item). Each "View permit" and "Pay this session" says which. A simulated sign-off is
  read out. The file input is off screen, so the drop zone wears its focus ring.
- **Checkout.** The card fields are required and say so; a submit that fails puts focus on the
  first wrong field, whose error is its description. Signing took the signature form away with
  the button that had focus, and paying the card form: focus moves on to the Pay section.

## Not verifiable here

Filled in at the end: what needs a browser, a screen reader or a phone.

## Changes

- 2026-10-13: plan written.
- 2026-10-13: the instrument's first run and the keyboard tests changed the order of work: the
  focus ring and the focus return are in shared code, so they were fixed before any screen.

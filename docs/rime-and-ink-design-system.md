# Rime & Ink

## Essence

A cool, frosted, desktop-native aesthetic: translucent white glass layered over a pale blue-grey ground, with deep navy ink for type and a single saturated indigo for action. It feels precise and quiet, like a well-made system utility rather than a marketing site. Depth comes from blur, long soft shadows with negative spread and a 1px inset highlight on every raised surface. The product's own UI, rendered as live components with monospace detail and keycap hints, does the work that illustration would do elsewhere.

---

## Color Palette

Text and border colors are ink tones with alpha baked into 8-digit hex, so they pick up the tint of whatever glass they sit on.

### Backgrounds

- Page base: `#edf3f8`, the frosted ground under everything
- Frost scale: `#fbfdff` (000), `#f5f8fc` (050), `#edf3f8` (100), `#d9e4ee` (200), used for wipes, backdrops and gradients
- Page atmosphere (stacked on the base, top to bottom):
  - `linear-gradient(135deg, #ffffffcc, transparent 34%)`
  - `radial-gradient(940px 560px at 16% -4%, #ffffffe6, transparent 60%)`
  - `radial-gradient(780px 520px at 92% 14%, #c4dae97a, transparent 62%)`
  - `radial-gradient(520px 360px at 66% 18%, #0f9f9a14, transparent 66%)`
  - `radial-gradient(700px 520px at 52% 110%, #5157d81a, transparent 58%)`
- Grid overlay: 1px lines at `rgba(21,32,48,.043)` on a 56px grid, fixed, masked to fade out by 72% of the viewport height
- Grain overlay: fractal-noise SVG, fixed, `opacity: .2`, `mix-blend-mode: multiply`

### Surfaces (white glass)

| Token | Value | Use |
|---|---|---|
| surface-hover | `#ffffffe6` (90%) | Hovered rows, focused fields, keycap tops |
| surface-strong | `#ffffffd1` (82%) | Nav bar, inputs, hovered cards |
| surface-1 | `#ffffff9e` (62%) | Default card/panel fill, secondary buttons |
| surface-2 | `#ffffff85` (52%) | Nested rows, FAQ items, nav hover |
| surface-3 | `#ffffff6b` (42%) | Chips, tertiary tiles |
| surface-soft | `#ffffff42` (26%) | Band sections, "future" cards |
| glass-tinted | `#f8fbffbd` | HUD/modal panels (cool-tinted white) |

### Text

- Primary: `#0d1420f0` (ink-950 at 94%), headings and body emphasis
- Secondary: `#1d2a3bad` (ink-800 at 68%), body copy, nav links
- Tertiary: `#4350668f` (ink-650 at 56%), captions, labels, placeholders
- Accent: `#32389f`, links, active states, emphasis inside UI
- Pill text: `#30368f`

### Accents

- Indigo 500: `#5157d8`, the live/interactive indigo (hover, selection, focus, line work)
- Indigo 650: `#32389f`, the resting primary-button fill and accent ink
- Selected-row gradient: `linear-gradient(90deg, #5b5ef7fa, #454bd8fa)` over indigo 500
- Teal 500: `#0f9f9a`, used only as atmosphere (radial glows, secondary line gradients); soft fill `#0f9f9a1f`
- Aubergine: `#7c4d8f`, a rare third accent in diagrams
- Ink scale: `#0d1420` (950), `#1d2a3b` (800), `#435066` (650), `#667288` (500)

### Pills and focus

- Pill fill `#5157d817`, pill border `#5157d838`
- Focus ring `#5157d8b3`; soft focus halo `#5157d829`. In the Permitopolis app the ring is opaque indigo-500 (`#5157d8`): at 70% it is 2.95:1 on the page ground and 2.67:1 on a tinted row, under the 3:1 a focus indicator needs (WCAG 1.4.11). On the night surface the ring is the mint accent.
- Selection glow `#5157d85c`; accent glow `#5157d847`

### Borders

- Glass edge: `#ffffffe0`, the bright rim on frosted panels
- Subtle: `#3d4d6321`, dividers, nested element borders
- Magnetic: `#54658029`, cool-grey rim for mock-UI chrome
- Inverse (on dark): `#ffffff1f`

### Semantic

| Role | Solid | Text | Surface | Border |
|---|---|---|---|---|
| Success | `#16815f` | `#0c6a4d` | `#16815f1a` / strong `#16815f24` | `#16815f47` |
| Warning | `#d88a1d` | `#8a5208` | `#d88a1d1f` | `#d88a1d4d` |
| Danger | `#b91c3b` | `#8a1530` | `#b91c3b1a` | `#b91c3b47` |

- Success glow (status dots): `0 0 12px #16815f8c`
- Window-chrome dots: `#ff6258`, `#ffbd2e`, `#28c840`
- Star ratings use the warning amber

### Dark interlude

One full-bleed section flips to night mode:

- Base: ink-950 at 97%, plus a 7% white top sheen, a teal radial (24%) top-right and an indigo radial (18%) bottom-left, with a faint white grain at 4.5%
- Text `#fafdfff0`, secondary `#e2e8f4b8`, tertiary `#e2e8f480`
- Accent: mint `#94e2d5eb` (timestamps, live dot, links)
- Borders `#ffffff1f`; row dividers `rgba(255,255,255,.08)`
- On dark, additions are `#85e8c9` and removals `#ff9aa8`
- Dark glass panel: `rgba(15,22,34,.9)` with an 11% white top sheen, `1px solid rgba(255,255,255,.14)`, `blur(34px) saturate(1.32)`

---

## Typography

### Families

- **Display:** system SF stack, Display first: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif`. Weights 700 and 800. Letter-spacing 0.
- **Body/UI:** the same stack with Text first. Weights 400, 600 and 700 (650 and 750 appear in dense UI).
- **Mono:** IBM Plex Mono at 400, 500 and 600. Used for keycaps, tags, timestamps, variables, file names, snippets and section micro-labels inside mock UI.

Only the mono face is a webfont. Everything else uses the OS font, which is a large part of the native feel.

### Scale

| Level | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| Hero | 72px | 700 | 0.96 | Landing headline, max ~11ch, balanced wrap |
| Article title | 60px | 800 | 1.02 | Long-form page title |
| H2 | 60px | 700 | 1.0 | Section headlines, balanced |
| H3 feature | 48px | 700 | 1.0 | Feature-block headlines |
| Price | 36px | 800 | 1.1 | Price numerals |
| Card title | 30px | 700 | 1.2 | List-card headlines |
| H4 | 24px | 700 | 1.33 | Article subheads, card titles |
| Lead | 20px | 400 | 32px | Hero subcopy (secondary color) |
| Body L | 18px | 400 | 32px | Section intros, article dek |
| Body | 16px | 400 | 24px (32px long-form) | Default |
| UI | 14px | 400/600 | 20–24px | Buttons, nav, table, list items |
| Caption | 12px | 400 | 16px | Chips, metadata |
| Eyebrow | 11px | 600 | 1.5 | Section pill label, uppercase |
| Overline | 11px | 700 | 1.5 | Form labels, footer headings, table headers, uppercase |
| Micro badge | 10px | 700 | 1.5 | Outline badges, uppercase |
| Mono tag | ~10px | 700 | 1 | Category tags in rows, uppercase |
| Mono detail | 11–12px | 400 | 1.4 | Snippets, file names, timestamps |

### Treatments

- **Tracking applies only to uppercase:** `.12em` for eyebrows, labels and mono tags; `.14em` for footer headings; `.08em` for micro badges; `.16em` for mono group labels in menus. Mixed-case text is never tracked.
- **Eyebrow pill** above every section headline: 11px/600 uppercase, `.12em`, pill text color on pill fill, 1px pill border, 8px radius, padding 4×10. The headline sits 20px below it.
- **Hero underline:** a thin, slightly irregular hand-drawn indigo stroke under the last word, about 60% of its width, at 85% opacity. It is the one organic gesture in the system.
- **Text wrapping:** `text-wrap: balance` on headings and `pretty` on leads.
- **Monospace as UI:** template variables, file names and timestamps are always mono and often accent-colored. Numerals in logs use tabular figures.
- Body copy is secondary-colored by default. Primary ink is reserved for headings, labels and values.

---

## Spacing

### Base unit

4px (0.25rem). Marketing layout snaps to the 4px scale. Mock UI uses finer rem steps (0.42, 0.5, 0.72, 0.85rem) to feel like a dense native app.

### Common values

- 2xs: 4px (chip vertical padding, icon gaps)
- xs: 8px (nav padding, button icon gap, list gaps)
- sm: 12px (button horizontal padding at small size, nav link padding)
- md: 16px (row padding, FAQ trigger vertical padding, card padding inside mocks)
- lg: 20–24px (card padding, eyebrow to headline, large-button padding)
- xl: 32–40px (feature panel padding, article panel padding, grid gaps)
- 2xl: 80px (closing section bottom padding)
- Section: **104px** top and bottom on every major section

### Layout

- Container: `width: min(1180px, 100vw - 40px)`, centered
- Hero: two columns (copy about 0.9fr, product visual about 1.1fr), 96px top padding, generous min-height
- Feature blocks alternate copy and visual sides, separated by 104px
- Three-tier pricing grid with equal columns and a ~16px gap
- Long-form text panel capped at 72ch with 40px padding; paragraphs about 640–670px wide
- Floating nav sits 16px from the top, centered, sized to its content (about 790px wide). It is the nav of a product or marketing page.
- Site header is the default header: the header of a page that speaks for an institution (a city office, a department), and of the app behind it. A band across the whole screen instead of a floating bar. See "Site header" below. A page has one or the other, never both.

### Site header

The header of a page that speaks for an institution. It is the one place in the system where an opaque surface runs edge to edge: the institution's name sits on something solid, and the page's glass starts below it.

- **Band:** full viewport width, in normal flow at the top of the page. It scrolls away with the page; it is not sticky and does not float. Fill `#f8fbff` (surface-solid, opaque), a 1px subtle border along the bottom, no shadow and no blur.
- **Row:** one row inside the 1180px container, 16px above and below (20px from 640px wide), identity on the left and navigation on the right, at least 24px between them.
- **Identity:** the seal and the name, as one link to the page's own home. The seal is a line drawing in ink 950, 48px square (56px from 640px). To its right, 12px away (16px from 640px), two lines: the institution's name in the display stack at 18px/700 with tight leading (24px from 640px), primary ink; under it the office or department at 14px in secondary. The name is always written out; the seal never stands alone and is hidden from a screen reader.
- **Navigation, from 1024px:** the section links, 4px apart; then 24px; then one inline accent link for the secondary destination; then 24px; then one 44px primary button. Nothing else goes in the row: no search, no icons, no second button.
- **Under 1024px:** the links, the accent link and the button fold into one 36px secondary button labelled "Menu" with a leading menu icon. It opens a 240px menu, right-aligned: the section links, a divider, then the two destinations. The identity stays as it is.
- **What it is not:** it carries no eyebrow, no status line and no banner above it, and no second row below it.
- **In the app:** the same band, the same row and the same identity, with two differences. It is pinned to the top of the screen (sticky, above the page, still no shadow and no blur), so the controls stay in reach; anything that sticks below it starts 24px under it. And the navigation side holds the app's controls instead of links, 8px apart: a status line in 12px mono (the demo date), a 36px secondary Search button, the 36px secondary user button, then one 36px ghost icon button (the Demo menu). The user button shows who is acting, a role icon or an applicant's initials with the name beside it, and opens a 256px menu, right-aligned: the city officials, a divider, then the applicants. The name and the office are cut with an ellipsis instead of wrapping. Under 1024px the status line shortens to the day; under 768px the user button is its icon alone; under 640px the status line is for a screen reader only and Search is its icon alone.

---

## Elevation

Every raised surface combines three things: a translucent fill, a backdrop blur, and a long, soft drop shadow with large negative spread plus a 1px white inset at the top edge. Shadows are cool blue-grey, never black.

### Shadows

- **Card:** `0 26px 70px -46px #34455c75, inset 0 1px 0 #ffffffdb`
- **HUD/modal:** `0 34px 96px -48px #3a4a648c, inset 0 1px 0 #ffffffd1`
- **Nav bar:** `0 24px 60px -42px rgba(37,50,72,.72), inset 0 1px 0 rgba(255,255,255,.9)`
- **Mock window:** `0 22px 70px -44px rgba(52,69,92,.58), inset 0 1px 0 rgba(255,255,255,.92)`
- **Hero stage:** `0 54px 150px -86px rgba(19,29,45,.82), inset 0 1px 0 rgba(255,255,255,.96)`
- **Card hover:** `0 22px 58px -46px rgba(37,50,72,.62)`
- **Primary button:** `0 18px 34px -24px rgba(50,56,159,.9), inset 0 1px 0 rgba(255,255,255,.2)`
- **Dark button:** `0 18px 34px -24px rgba(13,20,32,.9), inset 0 1px 0 rgba(255,255,255,.16)`
- **Selected row:** `0 18px 44px -30px rgba(81,87,216,.78)`
- **Keycap:** `0 22px 48px -28px rgba(37,50,72,.64), inset 0 1px 0 rgba(255,255,255,.94), inset 0 -10px 18px -18px rgba(29,42,59,.42)`. The bottom inner shade makes it read as a physical key.
- **Step marker (lit):** `0 0 0 1px rgba(81,87,216,.32), 0 10px 26px -10px rgba(81,87,216,.8)`
- **Dark glass:** `0 34px 90px -34px rgba(12,20,32,.72), inset 0 1px 0 rgba(255,255,255,.14)`

### Blur

- Frosted panel: `blur(28px) saturate(1.25)`
- Nav bar: `blur(40px)`
- HUD/modal panel: `blur(30px) saturate(1.35)`
- Secondary button: `blur(24px)`
- Modal backdrop: `blur(8px) saturate(1.1)` over frost-000 at 62%

### Border radii

- 6px: kbd hints, footer link focus
- 8px: buttons, inputs, eyebrow pills, small chips (the control radius)
- 9–11px: mock chips, list rows, FAQ items, search fields
- 12px: nav bar, keycaps, mock windows, packet cards
- 14px: panels and cards (the panel radius)
- 16–18px: index cards, diagram nodes
- 24–30px: hero illustration stages, closing CTA card
- 999px: dots, status pills, scrubber tracks, outline badges

---

## Interactive States

Shared timing: **180ms** on `cubic-bezier(.2,.72,.2,1)` for buttons, cards and fields. Nav and text links use 150ms on `cubic-bezier(.4,0,.2,1)`.

### Buttons

Sizes are 36px (compact, 12px padding), 44px (16px) and 56px (20px). The 56px primary can stack a 10px uppercase micro-label above the main label.

- **Primary**
  - Default: indigo 650 fill, white 14px/600 text, `1px` black/10 border, 8px radius, primary-button shadow
  - Hover: fill brightens to indigo 500 and the button rises 2px
  - Active: returns to 0 and the shadow compresses to `0 8px 18px -14px`
- **Secondary (glass)**
  - Default: surface-1 fill, subtle border, primary ink, card shadow, 24px backdrop blur
  - Hover: fill goes to surface-strong and the button rises 2px
  - Active: shadow compresses to `0 10px 28px -24px`
- **Dark:** ink-950 fill; hover ink-800. Used for terminal actions inside mock UI.
- **Focus-visible:** 2px focus-ring outline with a 2px offset in the page (or panel) color
- **Disabled:** 50% opacity, pointer events off
- **Icons:** 16px, 2px stroke, line style; arrows trail the label

### Links

- **Nav:** 14px secondary text, padding 8×12, 8px radius. On hover, the fill goes to surface-2 and the text to primary.
- **Site header:** 14px/600 primary ink, 44px tall with 12px side padding, 8px radius. On hover the label takes an underline at a 4px offset and nothing else moves: no fill, no lift. Focus-visible is the 2px ring, drawn inside the link (offset -2px).
- **Footer:** 14px secondary text that turns primary on hover
- **On dark:** mint accent, 600 weight, underline on hover with 4px offset
- **Inline accent links:** accent color with a trailing arrow. In the site header the accent link is 14px/500, underlined at a 4px offset from the start, with no arrow; on hover it turns primary ink.

### Lists and rows

- Rest: surface-2 fill, subtle border, 10–11px radius
- Hover/selected: the full indigo gradient fill with white text and 72%-white secondary text. The row nudges 2px right (vertical lists) or lifts 1px (menus). The selected row's shadow breathes on a 3.6s loop.
- Cards: on hover, lift 1px, border becomes indigo at 20%, fill goes to surface-strong, and the shadow deepens
- Diagram nodes: on hover, lift 4px and scale to 1.02 over 240ms

### Form inputs

- **Field:** min-height 44px, 8px radius, subtle border, surface-strong fill, padding ~12×13, 16px text, tertiary placeholder
- **Focus-visible:** border turns focus-ring, fill goes to surface-hover, plus a 4px halo `0 0 0 4px rgba(81,87,216,.12)`
- **Labels:** 11px/700 uppercase, `.12em`, tertiary, 6px above the field
- **Checkbox:** native control with `accent-color` set to indigo 650
- **Search field:** 10px radius with a leading 20px icon, 18px input text and a trailing kbd hint. It takes the same focus treatment via `:focus-within`.
- **Accordion item:** focus-within gives a focus-ring border, surface-1 fill and the 4px soft halo

### Keyboard hints

- **kbd:** mono at 0.72em, `1px` border of currentColor at 20%, fill of currentColor at 8%, 6px radius, padding 2×6. It adapts to any text color.
- **Keycaps (decorative):** 52×46px, 12px radius, white-to-strong gradient, keycap shadow, mono 15px

---

## Motion

### Principles

Motion behaves like material settling under glass: things arrive from slightly below with a tiny scale-up, then come to rest. Idle states breathe, float and sweep slowly, so the page always feels quietly alive. Nothing bounces or overshoots. Durations are short for interaction (120–320ms) and long for ambient loops (3.6–8s).

### Tokens

- Durations: tap `120ms`, fast `180ms`, gentle `240ms`, soft `320ms`
- Easing:
  - frost `cubic-bezier(.2,.72,.2,1)` for UI
  - settle `cubic-bezier(.18,.72,.16,1)` for entrances
  - press `ease-out`

### Patterns

- **Material settle (entrance):** opacity 0→1, `translateY(18px) scale(.985)`→rest, 820ms settle easing, 120ms delay
- **Key drop:** keycaps fall in from `translateY(-16px) scale(.94)` over 700ms, staggered 70ms apart
- **Idle float:** the hero panel drifts between `rotate(-2.6deg)` and `rotate(-2.1deg) translateY(-5px)` over 7s ease-in-out. Background windows rise 8px over 8s, phase-offset by layer.
- **Surface sweep:** a blurred white band crosses a panel diagonally in a 5.8s loop. It is visible for only about 20% of the cycle.
- **Breathing selection:** the selected row's glow swells on a 3.6s loop
- **Caret:** 1s two-step blink. In the dark section it is a block caret blinking every 1.05s, alongside a 2.4s pulsing live dot.
- **Scroll thread:** an indigo line draws itself down through consecutive sections as you scroll. It is a 2.2px core over an 8px glow at 30%, with round caps and non-scaling stroke. Numbered step markers light up as the line reaches them, and a dot marks the leading tip.
- **Demo loops:** a timeline thumb steps across four stops in 4.8s; diff lines lift 1px and saturate in sequence
- **Page transition:** a full-screen frost wipe (frost 000→100→200 gradient with a diagonal glass highlight and a faint indigo bottom edge), anchored to the bottom
- **Command palette:** the backdrop frosts in (62% frost with 8px blur) and the panel opens 18vh from the top, 640px wide, from a top-center origin
- **Menus and toasts:**
  - Mobile menu: 180ms in from `-8px, scale(.985)`
  - Toast in: 300ms from `+12px`
  - Toast out: 240ms ease-in
- **Accordion:** height expands over 220ms ease-out and collapses over 180ms
- **Reduced motion:** all durations become 0.01ms, loops run once, and the scroll thread is removed

---

## Design Principles

- **Glass on frost, not glass on glass.** Translucent white layers sit on a cool, gridded, grain-textured ground. Depth comes from blur, long negative-spread shadows and a bright inset top edge, not from opacity stacking or heavy outlines.
- **One action color.** Indigo means "you can act here," and nothing else competes with it. Teal only tints the atmosphere, amber marks ratings, and green marks status.
- **The interface is the illustration.** Product moments are shown as real, slightly rotated component mockups with mono detail, keycaps and live micro-animations, not as abstract art.
- **Keyboard-first vocabulary.** Shortcut hints, keycaps and "esc / navigate" footers appear throughout, which signals speed and native fluency.
- **Calm, physical motion.** Elements settle, float, breathe and wipe. Interaction feedback is a 2px lift and a color step, never a bounce.

---

## Implementation Notes

- **Token structure:** primitives (`frost-*`, `ink-*`, `indigo-*`, `teal-*`) feed semantic roles (`bg-page`, `surface-1…3`, `fg-primary/secondary/tertiary/accent`, `border-glass/subtle`, `pill-*`, `focus-ring`, `radius-control: 8px`, `radius-panel: 14px`, `section-space: 104px`, `dur-*`, `ease-*`). The original uses Tailwind v4 utilities that reference these variables.
- **Alpha-in-hex text:** text levels are ink with alpha (`f0`, `ad`, `8f`), which keeps type harmonized on tinted glass. Use `color-mix(in srgb, …)` for derived tints, such as the kbd fill and border from `currentColor`.
- **Reusable panel classes:**
  - Frosted panel: glass-edge border, 14px radius, surface-1 fill, card shadow, `blur(28px) saturate(1.25)`
  - HUD panel: magnetic border, top white sheen plus teal and indigo radial glows over the tinted glass, HUD shadow, `blur(30px) saturate(1.35)`
- **Page chrome:** the background, grid and grain live on `body`, `body::before` and `body::after` as fixed layers at `z-index` -2 and -1.
- **Site header:** a `<header>` outside `<main>` holding the identity link, a `<nav>` labelled "Primary" and the two destinations. Both layouts (the row from 1024px, the "Menu" button under it) are in the markup and switched with CSS, so the right one is there on the first paint. In the Permitopolis app the band, the identity and the section link are `SiteHeader`, `SiteIdentity` and `SiteHeaderNavLink` in `components/ui/site-header.tsx`, with the seal in `components/ui/city-seal.tsx`. `/` uses them through `components/landing/SiteHeader.tsx`; every applicant and city screen uses them, pinned, through `components/shell/TopBar.tsx`, where the user button is `UserMenu.tsx`. `/dev/kit` shows both.
- **Featured pricing card:** gets a `1px` indigo 650 border. The "later" card uses a dashed subtle border on surface-soft with no shadow.
- **Comparison table:**
  - 11px uppercase tertiary headers with a sticky first column
  - Row dividers in the subtle border color
  - The recommended column carries a faint indigo wash
  - Check icons in accent and em-dashes in tertiary
- **Icons:** a line icon set at 2px stroke, 16px in UI and 20px in fields
- **Decorative lines:** 1px gradient hairlines (`transparent → indigo 18% → teal 16% → transparent`) cross section backgrounds at slight angles
- **Fonts:** load only the mono webfont and rely on the system stack for text, which is fast and keeps the native look

/**
 * The page's sections, named once. The header nav, the "I want to…" list and the footer all read
 * this file, so a section never has two names or two targets (the accessibility audit holds links
 * with one name to one destination).
 */
export const SECTION_ID = {
  checker: "check-your-event",
  howToApply: "how-to-apply",
  permitTiers: "permit-tiers",
  whatDecides: "what-decides-the-tier",
  fees: "fees",
  questions: "questions",
} as const;

export interface SectionLink {
  href: string;
  label: string;
}

/** The header nav's four anchors, repeated in the footer. */
export const SECTION_LINKS: SectionLink[] = [
  { href: `#${SECTION_ID.howToApply}`, label: "How to apply" },
  { href: `#${SECTION_ID.permitTiers}`, label: "Permit tiers" },
  { href: `#${SECTION_ID.fees}`, label: "Fees" },
  { href: `#${SECTION_ID.questions}`, label: "Questions" },
];

/**
 * A major section: the container, and Rime & Ink's 104px above and below. The page scrolls an
 * anchor to 80px from the top (`scroll-padding-block` in globals.css); the negative scroll
 * margin takes back the section's own top padding, so a nav link lands with the eyebrow near the
 * top of the screen instead of 184px down it. The site header scrolls away, so nothing covers it.
 */
export const SECTION = "page-container flex -scroll-mt-28 flex-col py-[var(--section-space)]";

/** An inline accent link on the page's light ground: the site header's "City staff". */
export const TEXT_LINK =
  "rounded-control font-medium text-fg-accent underline underline-offset-4 outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** A link on the night band (Rime & Ink "Links", on dark): mint, 600, underlined on hover. The ring turns mint under `data-tone="night"`. */
export const NIGHT_TEXT_LINK =
  "rounded-kbd font-semibold text-night-accent underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

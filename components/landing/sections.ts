/**
 * The page's sections, named once. The primary nav, the "I want to…" list and the footer all read
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

/** The primary nav's four anchors, repeated in the footer. */
export const SECTION_LINKS: SectionLink[] = [
  { href: `#${SECTION_ID.howToApply}`, label: "How to apply" },
  { href: `#${SECTION_ID.permitTiers}`, label: "Permit tiers" },
  { href: `#${SECTION_ID.fees}`, label: "Fees" },
  { href: `#${SECTION_ID.questions}`, label: "Questions" },
];

/** An underlined text link on the page's light ground. */
export const TEXT_LINK =
  "rounded-control font-medium text-fg-accent underline underline-offset-4 outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** The same link on a night band (the nav strip, the footer); the ring turns mint under `data-tone="night"`. */
export const NIGHT_TEXT_LINK =
  "rounded-control font-medium text-night-fg underline underline-offset-4 outline-none hover:text-night-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

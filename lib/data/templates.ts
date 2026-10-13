/**
 * Review sections, condition wording and request wording, by department. Used by seed
 * scripts and by the reviewer panels (workstream 4C/4D) so the demo's canned language is
 * written once. Section names match the card titles in lib/rules/catalog.ts.
 */
import type { Dept } from "@/lib/types";

/** What each department's review covers, in the order a reviewer would read down the list. */
export const REVIEW_SECTIONS: Record<Dept, string[]> = {
  clerk: ["Alcohol details and liquor liability insurance", "Application completeness"],
  pws: [
    "Sound details",
    "Structure specs and layout",
    "Cooking and generator safety",
    "Pyrotechnics or drone operator license",
    "City services request",
    "Site plan",
    "Traffic control plan",
    "Security and medical plan",
    "Emergency plan",
    "Cleanup plan",
  ],
  hl: ["Certificate of insurance", "Vendor list", "Vendor health permits", "Accessibility plan"],
};

/** 8 to 12 realistic conditions per department, for review_decide's `conditions` and the quote. */
export const CONDITION_TEMPLATES: Record<Dept, string[]> = {
  clerk: [
    "Temporary alcohol license posted at each point of sale",
    "No glass containers past the gate",
    "Alcohol sales stop one hour before the event ends",
    "A copy of the permit is on site at all times",
    "Neighbors notified of the exact closure times",
    "Noise variance limited to the approved hours",
    "Vendor list kept current with the Clerk's office",
    "Any change to the plan is reported to the Clerk before the event",
  ],
  pws: [
    "Sound ends at 9 pm",
    "Speakers face away from the residences on Elm Street",
    "No more than 85 dB at 50 feet",
    "Route closed 6 to 11:30 am",
    "8 officers on the route",
    "40 barricades",
    "Finish-line sound off by 11 am",
    "Barricades placed by 6 am and cleared by 10 pm",
    "A fire lane of 20 feet stays open at all times",
    "Generators placed at least 10 feet from any structure",
    "Tents secured with weighted ballast, no stakes in paved areas",
    "A certified flagger at every vehicle crossing",
  ],
  hl: [
    "Certificate names the City of Permitopolis as additional insured",
    "Each food vendor displays its health permit at the booth",
    "A hand-washing station within 10 feet of every food booth",
    "An accessible route at least 36 inches wide to every viewing area",
    "One accessible restroom per 300 attendees",
    "Alcohol service stops 30 minutes before the event ends",
    "A licensed bartender staffs every alcohol point",
    "Perishable food held at or below 41°F until service",
    "A certified food handler present at every booth",
    "Accessible parking marked within 200 feet of the main entrance",
  ],
};

/**
 * Common "we need something" wording for request_info. `{vendor}` is filled in when the template
 * is picked (`fillRequestTemplate()` in lib/view/clerkTools.ts): the ticked card's vendor, or
 * "each vendor".
 */
export const REQUEST_TEMPLATES: Record<Dept, string[]> = {
  clerk: [
    "Please upload your alcohol vendor's liquor liability certificate",
    "We need a complete list of participating organizations",
    "Your application is missing a signature; please resubmit",
  ],
  pws: [
    "Please clarify your sound equipment setup and speaker placement",
    "We need the exact barricade placement plan",
    "Please confirm police staffing hours",
    "Your structure specs are missing the tent anchoring detail",
  ],
  hl: [
    "Please upload {vendor}'s current health permit",
    "Your certificate of insurance is missing the additional-insured endorsement",
    "Please list all vendors and what each will serve",
    "Please upload a clear, legible copy of your certificate of insurance",
  ],
};

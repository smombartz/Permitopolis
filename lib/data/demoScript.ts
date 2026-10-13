/**
 * The demo script: the Demo menu's scenario jump list, and the seven rehearsed paths the
 * demo guide (`/demo`) and "Demo hints" walk a presenter through. Pure data, no React.
 * Links are built with `lib/routes.ts` so a route change here never drifts from the real
 * ones. Case ids follow `docs/spec/prd.md`'s "Seed data" table and plan 3.3.
 *
 * Owned by workstream 2B (components/shell, lib/view/shell.ts).
 */
import { routes } from "@/lib/routes";
import type { Party } from "@/lib/types";

export type ScenarioKey = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export interface ScenarioJump {
  id: ScenarioKey;
  /** Shown in the Demo menu's jump list, e.g. "S1 · Maya Chen". */
  label: string;
  role: Party;
  /** Set only when `role` is the Applicant: which persona the jump opens. */
  personaId?: string;
  path: string;
  /** The PRD's "Up on May 3" line: what is waiting when the jump lands. */
  state: string;
}

export const SCENARIO_JUMPS: ScenarioJump[] = [
  {
    id: "S1",
    label: "S1 · Maya Chen",
    role: "applicant",
    personaId: "maya-chen",
    path: routes.permit("PMT-27-0109"),
    state: "Nobody; permit active",
  },
  {
    id: "S2",
    label: "S2 · Sunrise Yoga Club",
    role: "applicant",
    personaId: "sunrise-yoga-club",
    path: routes.apply({ caseId: "PMT-27-0142", step: "when" }),
    state: "Applicant, in the wizard",
  },
  {
    id: "S3",
    label: "S3 · Downtown Arts Collective",
    role: "applicant",
    personaId: "downtown-arts-collective",
    path: routes.event("PMT-27-0118"),
    state: "Applicant: upload the food truck's health permit, due Wed, May 5",
  },
  {
    id: "S4",
    label: "S4 · Maple Street block captain",
    role: "applicant",
    personaId: "maple-street-block-captain",
    path: routes.event("PMT-27-0126"),
    state: "Applicant: 3 of 12 neighbor sign-offs",
  },
  {
    id: "S5",
    label: "S5 · Riverfront Summer 5K",
    role: "clerk",
    path: routes.city.case("PMT-27-0097"),
    state:
      "Applicant: accept, sign and pay $6,530 by Fri, May 14. Health & Legal: verify the race-day insurance certificate.",
  },
  {
    id: "S6",
    label: "S6 · Main Street Food Truck Festival",
    role: "pws",
    path: routes.city.case("PMT-27-0031"),
    state: "Public Works & Safety: cleanup check and actual hours, due Fri, May 7",
  },
];

export type DemoPathPriority = "P0" | "P1";

export interface DemoStep {
  role: Party;
  /** Set when the step is the applicant acting as a specific persona (a lib/data/people.ts id). */
  persona?: string;
  text: string;
}

export interface DemoPath {
  id: number;
  title: string;
  priority: DemoPathPriority;
  /** The scenario this path is built on, or null for the tier-watching path's new applicant. */
  scenario: ScenarioKey | null;
  summary: string;
  steps: DemoStep[];
}

/**
 * The PRD's "Demo script": the seven acceptance-test paths, each run from a fresh seed.
 * Paths 1 to 6 are P0; path 7 (amendment) is P1.
 */
export const DEMO_PATHS: DemoPath[] = [
  {
    id: 1,
    title: "Instant in two minutes",
    priority: "P0",
    scenario: "S2",
    summary: "Finish the wizard, pay the first session, and see the 13-session permit on Active permits.",
    steps: [
      {
        role: "applicant",
        persona: "sunrise-yoga-club",
        text: "Finish the wizard from step 3. The plan shows Instant, 13 sessions at $20.",
      },
      {
        role: "applicant",
        persona: "sunrise-yoga-club",
        text: "Pay the first session; the series permit appears with its QR code.",
      },
      { role: "clerk", text: "Active permits shows 13 Sundays on Field 4." },
    ],
  },
  {
    id: 2,
    title: "Watch the tier move",
    priority: "P0",
    scenario: null,
    summary: "Every answer updates the tier, the what-if chip, the reviewers and the fee estimate live.",
    steps: [
      {
        role: "applicant",
        persona: "new",
        text: "Pick Picnic or party at Shelter 2 for 40 people: Instant.",
      },
      { role: "applicant", text: "Turn on alcohol: Reviewed, and the what-if chip offers the way back." },
      { role: "applicant", text: "Switch the location to two Main Street blocks: Special event." },
      { role: "applicant", text: "Set attendance to 1,200 with no street: still Special." },
    ],
  },
  {
    id: 3,
    title: "Answer a request",
    priority: "P0",
    scenario: "S3",
    summary: "Answer a reviewer's request, get the consolidated quote, pay, and the permit issues.",
    steps: [
      {
        role: "applicant",
        persona: "downtown-arts-collective",
        text: "Open the pinned card, use the sample file, send. The card moves to With the city.",
      },
      { role: "hl", text: "Verify it and approve the section." },
      { role: "clerk", text: "Consolidate (Public Works & Safety's conditions carry over), approve and send the $715 quote." },
      { role: "applicant", persona: "downtown-arts-collective", text: "Accept, sign and pay." },
      { role: "clerk", text: "Insurance was already verified, so issue the permit; it appears in Active permits." },
    ],
  },
  {
    id: 4,
    title: "Neighbors and the date hold",
    priority: "P0",
    scenario: "S4",
    summary: "The last sign-off unblocks intake; accepting places the date hold and routes the case.",
    steps: [
      {
        role: "applicant",
        persona: "maple-street-block-captain",
        text: 'Press "Simulate a sign-off" three times.',
      },
      {
        role: "clerk",
        text: "Accept is now enabled in intake: accept (the date hold appears), confirm routing, and the case moves to In review.",
      },
      { role: "pws", text: "Public Works & Safety's queue now shows the block party." },
    ],
  },
  {
    id: 5,
    title: "Two parties up at once",
    priority: "P0",
    scenario: "S5",
    summary: "Who's up shows two parties at once; issuing the permit waits on both of them.",
    steps: [
      {
        role: "clerk",
        text: "Open the case: Who's up highlights both the applicant and Health & Legal, and Issue permit says why it is disabled.",
      },
      { role: "hl", text: "Verify the insurance." },
      { role: "applicant", text: "Sign and pay." },
      {
        role: "clerk",
        text: "Issue the permit; Public Works & Safety gets its work orders and the route shows on its map for Jul 11.",
      },
      { role: "clerk", text: "Starting a new City Hall Plaza event on Jul 11 shows the Impacted warning." },
    ],
  },
  {
    id: 6,
    title: "Closeout",
    priority: "P0",
    scenario: "S6",
    summary: "Public Works & Safety logs the actuals; the Clerk reconciles and the applicant sees the refund.",
    steps: [
      { role: "pws", text: "Pass the cleanup check and log 72 officer-hours and 4 crew-hours." },
      { role: "clerk", text: "Reconciliation shows $750 over the estimate; issue the $250 deposit refund and close." },
      {
        role: "applicant",
        text: 'The board shows the refund, the feedback form and "Book again next year", which drafts Sat, Apr 22, 2028.',
      },
    ],
  },
  {
    id: 7,
    title: "Amend up a tier",
    priority: "P1",
    scenario: "S1",
    summary: "Adding a DJ raises the tier mid-flight; the date gate fires and the live permit stays valid.",
    steps: [
      {
        role: "applicant",
        persona: "maya-chen",
        text: "Add a DJ. The event becomes Reviewed and the date gate fires: 19 days left, 30 needed.",
      },
      { role: "applicant", text: "Choose the late fee." },
      {
        role: "applicant",
        text: "New cards tagged Amendment appear, and the current permit stays valid for the original plan.",
      },
    ],
  },
];

/**
 * The demo script: the Demo menu's scenario jump list and date jumps, and the seven rehearsed
 * paths the demo guide (`/demo`) and "Demo hints" walk a presenter through. Pure data, no React.
 * Links are built with `lib/routes.ts` so a route change here never drifts from the real
 * ones. Case ids follow `docs/spec/prd.md`'s "Seed data" table and plan 3.3;
 * `tests/seed.test.ts` checks every jump against the seed itself.
 *
 * First written by workstream 2B (the jumps and the paths); each step's id, page and
 * presenter's wording were added by 5E for the demo coach (lib/view/coach.ts).
 */
import { routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import type { ISODate, Party } from "@/lib/types";

export type ScenarioKey = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export interface ScenarioJump {
  id: ScenarioKey;
  /** Shown in the Demo menu's jump list: the persona for an applicant jump, the event for a city one. */
  label: string;
  /** The seeded case the jump opens. */
  caseId: string;
  role: Party;
  /**
   * The case's applicant. Set on every jump, city ones included, so that switching to the
   * Applicant afterwards shows this scenario's organizer and not whoever was picked before.
   */
  personaId: string;
  path: string;
  /** The PRD's "Up on May 3" line: what is waiting when the jump lands. */
  state: string;
}

const S1 = "PMT-27-0109";
const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S4 = "PMT-27-0126";
const S5 = "PMT-27-0097";
const S6 = "PMT-27-0031";

export const SCENARIO_JUMPS: ScenarioJump[] = [
  {
    id: "S1",
    label: "S1 · Maya Chen",
    caseId: S1,
    role: "applicant",
    personaId: "maya-chen",
    path: routes.permit(S1),
    state: "Nobody; permit active",
  },
  {
    id: "S2",
    label: "S2 · Sunrise Yoga Club",
    caseId: S2,
    role: "applicant",
    personaId: "sunrise-yoga-club",
    path: routes.apply({ caseId: S2, step: "when" }),
    state: "Applicant, in the wizard",
  },
  {
    id: "S3",
    label: "S3 · Downtown Arts Collective",
    caseId: S3,
    role: "applicant",
    personaId: "downtown-arts-collective",
    path: routes.event(S3),
    state: "Applicant: upload the food truck's health permit, due Wed, May 5",
  },
  {
    id: "S4",
    label: "S4 · Maple Street block captain",
    caseId: S4,
    role: "applicant",
    personaId: "maple-street-block-captain",
    path: routes.event(S4),
    state: "Applicant: 3 of 12 neighbor sign-offs",
  },
  {
    id: "S5",
    label: "S5 · Riverfront Summer 5K",
    caseId: S5,
    role: "clerk",
    personaId: "riverfront-running-club",
    path: routes.city.case(S5),
    state:
      "Applicant: accept, sign and pay $6,530 by Fri, May 14. Health & Legal: verify the race-day insurance certificate.",
  },
  {
    id: "S6",
    label: "S6 · Main Street Food Truck Festival",
    caseId: S6,
    role: "pws",
    personaId: "main-street-business-alliance",
    path: routes.city.case(S6),
    state: "Public Works & Safety: cleanup check and actual hours, due Fri, May 7",
  },
];

export interface DemoDateJump {
  date: ISODate;
  /** What the date is for, shown after the formatted date. */
  note: string;
  /** The scenario whose event falls on this date, if any. */
  scenario?: ScenarioKey;
}

/**
 * "Set demo date" quick jumps: the seed date, then the two event days the demo script visits.
 * Jumping to Jun 18 puts Jazz in the Plaza on Event day once it has been permitted.
 */
export const DEMO_DATE_JUMPS: DemoDateJump[] = [
  { date: DEFAULT_DEMO_TODAY, note: "Start of the demo" },
  { date: "2027-06-18", note: "Jazz in the Plaza", scenario: "S3" },
  { date: "2027-07-11", note: "Riverfront Summer 5K", scenario: "S5" },
];

export type DemoPathPriority = "P0" | "P1";

export interface DemoStep {
  /**
   * Stable within its path, read back by `lib/view/coach.ts`'s derive function so a coach strip
   * or a render test can name the step a presenter is on without counting array indexes.
   */
  id: string;
  role: Party;
  /**
   * Who the applicant is, on every applicant step (a lib/data/people.ts id): the scenario's own
   * organizer, or "new" for somebody starting a fresh event. Never set on a city step.
   */
  persona?: string;
  /** The page to be on for this step, a `lib/routes.ts` link. */
  page: string;
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
        id: "finish-wizard",
        role: "applicant",
        persona: "sunrise-yoga-club",
        page: routes.apply({ caseId: S2, step: "when" }),
        text: "Finish the wizard from step 3. The plan shows Instant, 13 sessions at $20.",
      },
      {
        id: "pay-first-session",
        role: "applicant",
        persona: "sunrise-yoga-club",
        page: routes.quote(S2),
        text: "Pay the first session; the series permit appears with its QR code.",
      },
      { id: "view-active-permits", role: "clerk", page: routes.city.active(), text: "Active permits shows 13 Sundays on Field 4." },
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
        id: "pick-shelter",
        role: "applicant",
        persona: "new",
        page: routes.apply(),
        text: "Pick Picnic or party at Shelter 2 for 40 people: Instant.",
      },
      { id: "turn-on-alcohol", role: "applicant", persona: "new", page: routes.apply(), text: "Turn on alcohol: Reviewed, and the what-if chip offers the way back." },
      { id: "two-main-blocks", role: "applicant", persona: "new", page: routes.apply(), text: "Switch the location to two Main Street blocks: Special event." },
      { id: "set-attendance-1200", role: "applicant", persona: "new", page: routes.apply(), text: "Set attendance to 1,200 with no street: still Special." },
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
        id: "respond-to-request",
        role: "applicant",
        persona: "downtown-arts-collective",
        page: routes.event(S3),
        text: "Open the pinned card, use the sample file, send. The card moves to With the city.",
      },
      { id: "verify-and-approve", role: "hl", page: routes.city.case(S3), text: "Verify it and approve the section." },
      { id: "send-quote", role: "clerk", page: routes.city.case(S3), text: "Consolidate (Public Works & Safety's conditions carry over), approve and send the $715 quote." },
      { id: "accept-sign-pay", role: "applicant", persona: "downtown-arts-collective", page: routes.quote(S3), text: "Accept, sign and pay." },
      { id: "issue-permit", role: "clerk", page: routes.city.case(S3), text: "Insurance was already verified, so issue the permit; it appears in Active permits." },
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
        id: "simulate-signoffs",
        role: "applicant",
        persona: "maple-street-block-captain",
        page: routes.event(S4),
        text: 'Press "Simulate a sign-off" three times.',
      },
      {
        id: "accept-and-route",
        role: "clerk",
        page: routes.city.case(S4),
        text: "Accept is now enabled in intake: accept (the date hold appears), confirm routing, and the case moves to In review.",
      },
      { id: "pws-queue", role: "pws", page: routes.city.queue(), text: "Public Works & Safety's queue now shows the block party." },
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
        id: "open-case",
        role: "clerk",
        page: routes.city.case(S5),
        text: "Open the case: Who's up highlights both the applicant and Health & Legal, and Issue permit says why it is disabled.",
      },
      { id: "verify-insurance", role: "hl", page: routes.city.case(S5), text: "Verify the insurance." },
      { id: "sign-and-pay", role: "applicant", persona: "riverfront-running-club", page: routes.quote(S5), text: "Sign and pay." },
      {
        id: "issue-permit",
        role: "clerk",
        page: routes.city.case(S5),
        text: "Issue the permit; Public Works & Safety gets its work orders and the route shows on its map for Jul 11.",
      },
      // In the wizard, as somebody new: the Clerk has no page that starts an event.
      { id: "new-plaza-event", role: "applicant", persona: "new", page: routes.apply(), text: "Starting a new City Hall Plaza event on Jul 11 shows the Impacted warning." },
    ],
  },
  {
    id: 6,
    title: "Closeout",
    priority: "P0",
    scenario: "S6",
    summary: "Public Works & Safety logs the actuals; the Clerk reconciles and the applicant sees the refund.",
    steps: [
      { id: "log-cleanup", role: "pws", page: routes.city.case(S6), text: "Pass the cleanup check and log 72 officer-hours and 4 crew-hours." },
      { id: "reconcile-close", role: "clerk", page: routes.city.case(S6), text: "Reconciliation shows $750 over the estimate; issue the $250 deposit refund and close." },
      {
        id: "book-again",
        role: "applicant",
        persona: "main-street-business-alliance",
        page: routes.event(S6),
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
        id: "add-dj",
        role: "applicant",
        persona: "maya-chen",
        // The wizard reopened on the same record: the board's menu and the permit both link here.
        page: routes.amend(S1),
        text: "Add a DJ. The event becomes Reviewed and the date gate fires: 19 days left, 30 needed.",
      },
      { id: "choose-late-fee", role: "applicant", persona: "maya-chen", page: routes.amend(S1), text: "Choose the late fee." },
      {
        id: "amendment-cards",
        role: "applicant",
        persona: "maya-chen",
        page: routes.event(S1),
        text: "New cards tagged Amendment appear, and the current permit stays valid for the original plan.",
      },
    ],
  },
];

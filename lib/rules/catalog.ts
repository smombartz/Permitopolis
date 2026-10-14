/**
 * The card catalogue: every applicant card, when the plan includes it and how it behaves.
 * FROZEN after Phase 0. requirements() instantiates these; transition() relies on the ids,
 * the unlock events and the flags; seed scripts refer to cards by id.
 *
 * Task ids are `${caseId}:${catalogId}`, plus `:${n}` (1-based) for per-vendor cards.
 *
 * Lifecycle rules shared by rules and state:
 * - Plan cards are all created when the applicant confirms the plan (create_board), so the
 *   whole journey is visible on day one. Later-stage cards start 'locked' with `unlocksOn`.
 * - Closeout cards are created when the case enters Closeout (or Closed, for an Instant
 *   event that skips Closeout), by closeoutCards().
 * - Completing a card with `needsCheck` sends it to its reviewer ('submitted'); the reviewer
 *   accepts it (verify_document, or review_decide approving, which accepts all of that
 *   department's submitted cards) or sends it back (reject_document: 'changes_requested').
 *   A card without `needsCheck` goes straight to 'done'.
 * - Re-uploading to a document card that is already 'done' (before the event) sends it back
 *   to 'submitted' for a fresh check.
 * - `preSubmit` cards must all be 'submitted' or 'done' before Submit application unlocks.
 * - Meeting cards are closed by the city with complete_city_task on the card's id.
 * - "Download per-vendor food permits" opens when Health & Legal issues them
 *   (`food_permits_issued`), which it can once every vendor's health permit is verified.
 * - A reviewer's request pins `request` on an existing card, or creates one
 *   `respond_to_request:${n}` card when it targets nothing.
 */
import type { Classification, RulesConfig } from "@/lib/rules/types";
import type { Dept, EventAnswers, TaskKind, TaskPhase, UnlockEvent } from "@/lib/types";

export type CatalogId =
  | "insurance_certificate"
  | "sound_details"
  | "alcohol_details"
  | "vendor_list"
  | "vendor_health_permit"
  | "structure_specs"
  | "cooking_generator_safety"
  | "pyro_drone_license"
  | "city_services_request"
  | "site_plan"
  | "traffic_control_plan"
  | "security_medical_plan"
  | "emergency_plan"
  | "accessibility_plan"
  | "cleanup_plan"
  | "neighbor_signoff"
  | "submit_application"
  | "pre_application_meeting"
  | "community_notification"
  | "respond_to_request"
  | "accept_and_sign"
  | "pay_fees"
  | "coordination_meeting"
  | "site_walkthrough"
  | "vendor_food_permits"
  | "carry_permit"
  | "final_bill_or_refund"
  | "feedback"
  | "book_again";

export type DueRule =
  /** No due date. */
  | { type: "none" }
  /** Event date minus the tier's lead time: the last day to submit. */
  | { type: "submit_by" }
  /** Event date minus N days, where N is an sla key in the config. */
  | { type: "before_event"; sla: keyof RulesConfig["sla"] }
  /** N days after the card unlocks, where N is an sla key in the config. Set by transition() at unlock. */
  | { type: "after_unlock"; sla: keyof RulesConfig["sla"] }
  /** The date hold's expiry. Set by transition() when the quote is sent. */
  | { type: "hold_expiry" }
  /** The event date (first session for a series). */
  | { type: "event_day" };

export interface CardSpec {
  id: CatalogId;
  kind: TaskKind;
  title: string;
  /** Shown as the "Why" line. `{vendor}` is replaced for per-vendor cards. */
  why: string;
  reviewer: Dept | null;
  phase: TaskPhase;
  /** 'plan': created at create_board. 'closeout': created by closeoutCards(). 'request': created by request_info. */
  stage: "plan" | "closeout" | "request";
  /** Whether the plan includes this card. */
  when: (answers: EventAnswers, cls: Classification) => boolean;
  /** Null: open ('todo') from the start. Otherwise the card starts 'locked' until this event. */
  unlocksOn: UnlockEvent | null;
  /** Shown on a locked card, e.g. "Unlocks when your quote is ready". */
  unlockHint?: string;
  due: DueRule;
  /** Must be submitted or done before Submit application unlocks. */
  preSubmit: boolean;
  /** Completing it sends it to the reviewer instead of straight to done. */
  needsCheck: boolean;
  /** One card per food vendor. */
  perVendor?: boolean;
}

const reviewedOrSpecial = (_a: EventAnswers, cls: Classification) => cls.tier !== "instant";
const special = (_a: EventAnswers, cls: Classification) => cls.tier === "special";
const always = () => true;
const usesStreet = (a: EventAnswers) => a.location?.mode === "streets" || a.location?.mode === "route";

export const CARD_CATALOG: CardSpec[] = [
  {
    id: "insurance_certificate",
    kind: "document",
    title: "Certificate of insurance",
    why: "Every Standard and Special event needs proof of liability insurance",
    reviewer: "hl",
    phase: "before_submitting",
    stage: "plan",
    when: reviewedOrSpecial,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "sound_details",
    kind: "form",
    title: "Sound details",
    why: "Because you added amplified sound",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.amplifiedSound,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "alcohol_details",
    kind: "form",
    title: "Alcohol details and liquor liability insurance",
    why: "Because you are serving alcohol",
    reviewer: "clerk",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.alcohol,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "vendor_list",
    kind: "form",
    title: "Vendor list",
    why: "Because you have food or vending",
    reviewer: "hl",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.foodVending !== null,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "vendor_health_permit",
    kind: "document",
    title: "Health permit: {vendor}",
    why: "Each food vendor needs a current health permit",
    reviewer: "hl",
    phase: "review",
    stage: "plan",
    when: (a) => a.addOns.foodVending !== null,
    unlocksOn: null,
    due: { type: "before_event", sla: "vendorHealthPermitDaysBefore" },
    preSubmit: false,
    needsCheck: true,
    perVendor: true,
  },
  {
    id: "structure_specs",
    kind: "document",
    title: "Structure specs and layout",
    why: "Because you have tents or stages",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.tentsStages !== null,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "cooking_generator_safety",
    kind: "form",
    title: "Cooking and generator safety",
    why: "Because you have cooking or generators",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.cookingGenerators,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "pyro_drone_license",
    kind: "document",
    title: "Pyrotechnics or drone operator license",
    why: "Because you have fireworks or drones",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.fireworksDrones,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "city_services_request",
    kind: "form",
    title: "City services request",
    why: "Because you asked for city services",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: (a) => a.addOns.cityServices !== null,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "site_plan",
    kind: "form",
    title: "Site plan",
    why: "Special events need a site plan drawn on the map",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: special,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "traffic_control_plan",
    kind: "document",
    title: "Traffic control plan",
    why: "Because your event closes a street",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    // A small block party asks for barricades through the city services request instead.
    when: (a, cls) => usesStreet(a) && !cls.blockPartyException,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "security_medical_plan",
    kind: "document",
    title: "Security and medical plan",
    why: "Special events need a security and medical plan",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    // A crowd at the configured Special threshold (1,000 by default) already makes the tier
    // Special, so the tier carries the PRD's "Special event or 1,000+ people".
    when: special,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "emergency_plan",
    kind: "document",
    title: "Emergency plan",
    why: "Special events need an emergency plan",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: special,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "accessibility_plan",
    kind: "form",
    title: "Accessibility plan",
    why: "Special events need an accessible route, restrooms and viewing area",
    reviewer: "hl",
    phase: "before_submitting",
    stage: "plan",
    when: special,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "cleanup_plan",
    kind: "form",
    title: "Cleanup plan",
    why: "Special events need a cleanup plan",
    reviewer: "pws",
    phase: "before_submitting",
    stage: "plan",
    when: special,
    unlocksOn: null,
    due: { type: "submit_by" },
    preSubmit: true,
    needsCheck: true,
  },
  {
    id: "neighbor_signoff",
    kind: "sign_off",
    title: "Neighbor sign-off",
    why: "Because a block party needs every household on the block to agree",
    reviewer: "clerk",
    phase: "review",
    stage: "plan",
    when: (_a, cls) => cls.blockPartyException,
    unlocksOn: null,
    // Not a pre-submit card: the Clerk cannot accept the application until it is done.
    due: { type: "none" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "submit_application",
    kind: "action",
    title: "Submit application",
    why: "Send your application to the City Clerk",
    reviewer: "clerk",
    phase: "before_submitting",
    stage: "plan",
    when: reviewedOrSpecial,
    unlocksOn: "presubmit_done",
    unlockHint: "Unlocks when every card before submitting is done",
    due: { type: "submit_by" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "pre_application_meeting",
    kind: "meeting",
    title: "Pre-application meeting",
    why: "Special events start with a meeting with the City Clerk and both review groups",
    reviewer: "clerk",
    phase: "review",
    stage: "plan",
    when: special,
    unlocksOn: "accepted",
    unlockHint: "Unlocks when the City Clerk accepts your application",
    due: { type: "after_unlock", sla: "preApplicationMeetingDaysAfterAcceptance" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "community_notification",
    kind: "action",
    title: "Community notification",
    why: "Special events must post a notice for neighbors and businesses",
    reviewer: "clerk",
    phase: "review",
    stage: "plan",
    when: special,
    unlocksOn: "accepted",
    unlockHint: "Unlocks when the City Clerk accepts your application",
    due: { type: "before_event", sla: "communityNoticeDaysBefore" },
    preSubmit: false,
    needsCheck: true,
  },
  {
    id: "respond_to_request",
    kind: "action",
    title: "Respond to a request",
    why: "A reviewer asked for something",
    reviewer: null,
    phase: "review",
    stage: "request",
    when: () => false,
    unlocksOn: null,
    due: { type: "none" },
    preSubmit: false,
    needsCheck: true,
  },
  {
    id: "accept_and_sign",
    kind: "sign_off",
    title: "Accept conditions and sign",
    why: "Your quote lists the conditions of your permit",
    reviewer: "clerk",
    phase: "permit",
    stage: "plan",
    when: reviewedOrSpecial,
    unlocksOn: "quote_sent",
    unlockHint: "Unlocks when your quote is ready",
    due: { type: "hold_expiry" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "pay_fees",
    kind: "payment",
    // Instant events show this as "Pay and book"; it is open from the start and done at booking.
    title: "Pay fees and deposit",
    why: "Payment holds your date and lets the City Clerk issue your permit",
    reviewer: "clerk",
    phase: "permit",
    stage: "plan",
    when: always,
    unlocksOn: "quote_sent",
    unlockHint: "Unlocks when your quote is ready",
    due: { type: "hold_expiry" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "coordination_meeting",
    kind: "meeting",
    title: "Coordination meeting",
    why: "Special events meet with the City Clerk and Public Works & Safety before the day",
    reviewer: "clerk",
    phase: "before_event",
    stage: "plan",
    when: special,
    unlocksOn: "permitted",
    unlockHint: "Unlocks when your permit is issued",
    due: { type: "before_event", sla: "coordinationMeetingDaysBefore" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "site_walkthrough",
    kind: "meeting",
    title: "Site walkthrough",
    why: "Public Works & Safety walks the site with you before the event",
    reviewer: "pws",
    phase: "before_event",
    stage: "plan",
    when: special,
    unlocksOn: "permitted",
    unlockHint: "Unlocks when your permit is issued",
    due: { type: "before_event", sla: "walkthroughDaysBefore" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "vendor_food_permits",
    kind: "action",
    title: "Download per-vendor food permits",
    why: "Each vendor displays its temporary food permit at the event",
    reviewer: "hl",
    phase: "before_event",
    stage: "plan",
    when: (a, cls) => cls.tier === "special" && a.addOns.foodVending !== null,
    // Not the permit alone: Health & Legal issues each vendor's food permit first (its own
    // "Issue food permits" task, see CITY_TASKS), and only then is there anything to download.
    unlocksOn: "food_permits_issued",
    unlockHint: "Unlocks when Health & Legal issues the food permits",
    due: { type: "before_event", sla: "vendorFoodPermitsDaysBefore" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "carry_permit",
    kind: "action",
    title: "Carry your permit",
    why: "Have your permit on your phone on the day",
    reviewer: null,
    phase: "event_day",
    stage: "plan",
    when: always,
    unlocksOn: "event_day",
    unlockHint: "For the day of your event",
    due: { type: "event_day" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "final_bill_or_refund",
    kind: "payment",
    title: "Final bill or refund",
    why: "The City Clerk compares estimated and actual costs after your event",
    reviewer: "clerk",
    phase: "after",
    stage: "closeout",
    // Events with a deposit or city costs to reconcile. Instant events skip it, except that
    // reconcile_close adds one when an Instant closeout exception carries a charge.
    when: reviewedOrSpecial,
    unlocksOn: "invoice_issued",
    unlockHint: "Unlocks when the City Clerk finishes reconciling costs",
    due: { type: "after_unlock", sla: "finalBillDaysAfterInvoice" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "feedback",
    kind: "form",
    title: "Tell us how it went",
    why: "Two minutes of feedback helps the next organizer",
    reviewer: "clerk",
    phase: "after",
    stage: "closeout",
    when: always,
    unlocksOn: "closed",
    unlockHint: "Unlocks when your event is closed out",
    due: { type: "none" },
    preSubmit: false,
    needsCheck: false,
  },
  {
    id: "book_again",
    kind: "action",
    title: "Book again next year",
    why: "Start next year's application from this one",
    reviewer: null,
    phase: "after",
    stage: "closeout",
    when: always,
    unlocksOn: "closed",
    unlockHint: "Unlocks when your event is closed out",
    due: { type: "none" },
    preSubmit: false,
    needsCheck: false,
  },
];

export const CARD_BY_ID: Record<CatalogId, CardSpec> = Object.fromEntries(
  CARD_CATALOG.map((card) => [card.id, card]),
) as Record<CatalogId, CardSpec>;

/**
 * City-owned tasks, created inside transition(). Ids are `${caseId}:${id}`; review tasks
 * add the department (`:review:pws`) and verification tasks add the card
 * (`:verify:insurance_certificate`, `:verify:vendor_health_permit:1`).
 *
 * A task that one action finishes is named for it: the title starts with the words on that
 * action's button and its panel ("Send quote: consolidate the reviews"), so Who's up, My queue,
 * Your actions and the sheet call one step one thing.
 */
export const CITY_TASKS = {
  /**
   * Clerk. Created by submit: 'todo', or 'locked' with payload.awaitingSignoffs while a block
   * party's neighbor sign-offs are still out (the last sign-off opens it). Done by
   * accept_complete. A request at intake parks it until the applicant answers.
   */
  intake_check: { owner: "clerk", kind: "review", title: "Accept as complete: check the application" },
  /** Clerk. Created by accept_complete. Done by confirm_routing. */
  confirm_routing: { owner: "clerk", kind: "action", title: "Confirm routing: reviewers and due dates" },
  /** Clerk, Special events. Created by accept_complete. Done by schedule_meeting on the applicant's pre_application_meeting card. */
  schedule_pre_application_meeting: { owner: "clerk", kind: "meeting", title: "Schedule the pre-application meeting" },
  /**
   * One per routed department. Created by confirm_routing, titled by `reviewTaskTitle()`: the
   * Clerk's own review is the license it issues. Done by review_decide.
   */
  review: { owner: null, kind: "review", title: "Review your sections" },
  /**
   * The card's reviewer. Created when an applicant card with needsCheck becomes 'submitted' and
   * the department's own review task is no longer open to cover it, from routing through Event
   * day. One per card; a second upload reopens it. Done by verify_document or reject_document.
   */
  verify: { owner: null, kind: "review", title: "Verify" },
  /**
   * Clerk. Created when every routed review is approved; done by send_quote. Also created when
   * a department denies its section, titled "Decide: a reviewer denied" (payload.denied): the
   * Clerk's move is then deny.
   */
  consolidate: { owner: "clerk", kind: "action", title: "Send quote: consolidate the reviews" },
  /**
   * Clerk. Created by send_quote, locked until the applicant has signed and paid the quote and
   * insurance is verified; locked again if verified insurance is re-uploaded. Done by issue_permit.
   */
  issue_permit: { owner: "clerk", kind: "action", title: "Issue permit" },
  /** Public Works & Safety. Created by issue_permit, one per approved service: `:work_order:barricades`, `:work_order:police`, `:work_order:closure`, `:work_order:trash`, `:work_order:power`. Done by complete_city_task. */
  work_order: { owner: "pws", kind: "action", title: "Work order" },
  /**
   * Health & Legal. Created by issue_permit for a case whose plan has the applicant's "Download
   * per-vendor food permits" card (a Special event with food vendors), due when that card is.
   * Locked until every vendor's health permit is verified; done by complete_city_task, which
   * raises `food_permits_issued` and so opens the applicant's card.
   */
  issue_food_permits: { owner: "hl", kind: "action", title: "Issue food permits" },
  /** Public Works & Safety. Created when the case enters Closeout. Both done by log_closeout. */
  cleanup_inspection: { owner: "pws", kind: "inspection", title: "Log closeout: cleanup inspection" },
  log_actual_hours: { owner: "pws", kind: "action", title: "Log closeout: actual hours" },
  /** Clerk. Created when the case enters Closeout, locked until hours are logged. Done by reconcile_close. */
  reconcile: { owner: "clerk", kind: "action", title: "Reconcile and close" },
  /**
   * Clerk. Created when the applicant submits an amendment (`submit` on a case with one pending).
   * Locked while a department still has one of the amendment's cards, or has sent one back; done
   * by decide_amendment. One per case: a later amendment opens it again.
   */
  decide_amendment: { owner: "clerk", kind: "review", title: "Decide amendment: approve or decline the change" },
  /** Clerk. Created for an Instant event's Closeout exception (damage or dispute). Done by reconcile_close. */
  instant_exception: { owner: "clerk", kind: "review", title: "Reconcile and close: resolve the exception" },
} as const;

export type CityTaskId = keyof typeof CITY_TASKS;

/** What the Clerk's own review of an event with alcohol is called: the license it issues (PRD, "Licenses"). */
export const LICENSE_REVIEW_TITLE = "Review the temporary alcohol license";

/**
 * A department's review task, as My queue, Who's up and Your actions call it. The Clerk reviews
 * the temporary alcohol license "as its own review section, like any department" (PRD, City
 * Clerk views), so its task says which license; every other review is the department's sections.
 */
export function reviewTaskTitle(dept: Dept, answers: Pick<EventAnswers, "addOns">): string {
  return dept === "clerk" && answers.addOns.alcohol ? LICENSE_REVIEW_TITLE : CITY_TASKS.review.title;
}

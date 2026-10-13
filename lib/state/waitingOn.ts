/**
 * "Who's up." Nobody sets a party's standing by hand: it is read off the case's tasks and
 * reviews. waitingOn() and nextMove() share one pass over the four parties.
 */
import { daysBetween } from "@/lib/dates";
import { plural } from "@/lib/format";
import { ENDING_LABEL, PARTIES, PARTY_LABEL } from "@/lib/types";
import type { Ending, EventCase, ISODate, Party, Task, UnlockEvent } from "@/lib/types";
import { byDueDate, signoffsLeft, taskDueDate } from "./core";
import type { Involvement, PartyStanding, PartyStatus, StateApi } from "./types";

const DEFAULT_SCOPE: Record<Party, string> = {
  applicant: "Describing the event, documents and payment",
  clerk: "Intake, routing, quote, permit and closeout",
  pws: "Streets, structures and safety",
  hl: "Insurance, food and accessibility",
};

/** The row of a department that is named on the applicant's cards but has no review yet. */
export const AWAITING_ROUTING_NOTE = "Starts when the City Clerk routes the case";

const CITY_UNLOCK_HINT: Record<string, string> = {
  issue_permit: "Unlocks when paid and verified",
  reconcile: "Unlocks when hours are logged",
  consolidate: "Unlocks when every review is in",
};

/**
 * What a party covers on this case. A reviewing department reads as the sections routed to it.
 * The Clerk owns every case from intake to closeout, so its row says that even when a section
 * of its own (the alcohol license) is routed to it as well.
 */
function scopeFor(c: EventCase, party: Party): string {
  if (party === "applicant" || party === "clerk") return DEFAULT_SCOPE[party];
  const review = c.reviews.find((r) => r.dept === party);
  if (review && review.sections.length > 0) return review.sections.join(", ");
  return DEFAULT_SCOPE[party];
}

/** How a party stands to a case, before looking at what it has to do (see `Involvement`). */
export const involvement: StateApi["involvement"] = (c: EventCase, party: Party): Involvement => {
  if (party === "applicant") return "active";
  if (c.state === "draft") return "none";
  if (party === "clerk") return "active";
  if (c.reviews.some((r) => r.dept === party) || c.tasks.some((t) => t.owner === party)) return "active";
  const notRoutedYet = c.reviews.length === 0 && (c.state === "submitted" || c.state === "needs_info");
  return notRoutedYet && c.tasks.some((t) => t.reviewer === party) ? "awaiting_routing" : "none";
};

const isOpenStatus = (status: Task["status"]) => status === "todo" || status === "changes_requested";

/**
 * The day an open task last became this party's to act on: the start of the stretch it has been
 * open for now. A card that was sent back, or a series' "Carry your permit" that opens again for
 * each session, counts from that last opening, not from its first. A plan card nobody has
 * touched has no history: it has been the applicant's since the application went in (or, for a
 * Draft, since it was started).
 */
function openSince(c: EventCase, task: Task): ISODate {
  let since: string | null = null;
  for (let i = task.history.length - 1; i >= 0 && isOpenStatus(task.history[i].status); i--) since = task.history[i].at;
  return (since ?? task.history.at(-1)?.at ?? c.submittedAt ?? c.createdAt).slice(0, 10);
}

/** Days the case has sat with a party: counted from its longest-open task. */
function daysActionable(c: EventCase, tasks: Task[], today: ISODate): number {
  let max = 0;
  for (const t of tasks) max = Math.max(max, daysBetween(openSince(c, t), today));
  return max;
}

/** The stages of a case in the order they happen, as the events that unlock tasks. */
const UNLOCK_ORDER: UnlockEvent[] = [
  "presubmit_done",
  "submitted",
  "accepted",
  "routed",
  "quote_sent",
  "signed",
  "paid",
  "permitted",
  "event_day",
  "closeout",
  "hours_logged",
  "invoice_issued",
  "closed",
];

/**
 * How soon a locked task opens. A task with no unlock event is parked on something specific
 * that a party up now is doing (the sign-offs, payment and verification), so it comes first.
 */
function unlockRank(task: Task): number {
  return task.unlocksOn ? UNLOCK_ORDER.indexOf(task.unlocksOn) : -1;
}

/** This party's locked task that opens first; the earlier-created one when two open together. */
function nextToUnlock(c: EventCase, party: Party): Task | undefined {
  let soonest: Task | undefined;
  for (const t of c.tasks) {
    if (t.owner !== party || t.status !== "locked") continue;
    if (!soonest || unlockRank(t) < unlockRank(soonest)) soonest = t;
  }
  return soonest;
}

/**
 * What a locked task waits for, by the event that unlocks it. Who's up is read by the applicant
 * and by city staff alike, so these say "the quote", not "your quote" as the cards themselves do.
 */
export const UNLOCK_NOTE: Partial<Record<UnlockEvent, string>> = {
  presubmit_done: "Unlocks when every card before submitting is done",
  accepted: "Unlocks when the City Clerk accepts the application",
  quote_sent: "Unlocks when the quote is ready",
  permitted: "Unlocks when the permit is issued",
  event_day: "For the day of the event",
  hours_logged: "Unlocks when hours are logged",
  invoice_issued: "Unlocks when the City Clerk finishes reconciling costs",
  closed: "Unlocks when the event is closed out",
};

/** What a waiting party's row says: the locked task it gets next, and what that task waits for. */
function lockedStanding(c: EventCase, party: Party, locked: Task[]): { task?: Task; note?: string } {
  const answering = locked.find((t) => t.payload.awaitingAnswer === true);
  if (answering) return { task: answering, note: "Waiting on the applicant's response" };
  const signoffs = locked.find((t) => t.payload.awaitingSignoffs === true);
  if (signoffs) return { task: signoffs, note: `Waiting on ${plural(signoffsLeft(c), "neighbor sign-off")}` };
  const hinted = locked.find((t) => CITY_UNLOCK_HINT[t.catalogId]);
  if (hinted) return { task: hinted, note: CITY_UNLOCK_HINT[hinted.catalogId] };
  const next = nextToUnlock(c, party);
  return { task: next, note: next?.unlocksOn ? UNLOCK_NOTE[next.unlocksOn] : undefined };
}

function decisionNote(c: EventCase, party: Party): string | undefined {
  const review = c.reviews.find((r) => r.dept === party);
  if (!review) return undefined;
  if (review.status === "approved") return "Approved";
  if (review.status === "approved_with_conditions") return "Approved with conditions";
  if (review.status === "denied") return "Denied its section";
  return undefined;
}

export const waitingOn: StateApi["waitingOn"] = (c: EventCase, today: ISODate): PartyStatus[] => {
  if (c.ending) {
    return PARTIES.map((party) => ({
      party,
      status: (involvement(c, party) !== "none" ? "done_for_now" : "not_involved") as PartyStanding,
      openTasks: [],
      oldestDue: null,
      daysHolding: 0,
      note: `Ended: ${ENDING_LABEL[c.ending as keyof typeof ENDING_LABEL]}`,
      scope: scopeFor(c, party),
    }));
  }

  return PARTIES.map((party) => {
    const open = c.tasks.filter((t) => t.owner === party && (t.status === "todo" || t.status === "changes_requested")).sort(byDueDate);
    const ownedTasks = c.tasks.filter((t) => t.owner === party);
    const locked = ownedTasks.filter((t) => t.status === "locked");
    const standing = involvement(c, party);

    let status: PartyStanding;
    if (party === "applicant" && c.state === "draft" && open.length === 0) {
      status = "up_now";
    } else if (open.length > 0) {
      status = "up_now";
    } else if (standing === "none") {
      status = "not_involved";
    } else if (standing === "awaiting_routing") {
      // Not "Done for now": it has done nothing yet. Its turn starts with the Clerk's routing.
      status = "waiting";
    } else if (locked.length > 0 && ownedTasks.every((t) => t.status === "locked" || t.status === "done")) {
      status = "waiting";
    } else {
      status = "done_for_now";
    }

    // `open` is sorted, so its first dated task is the oldest due.
    const oldestDue = open.map(taskDueDate).find((d): d is ISODate => d !== null) ?? null;
    // An applicant who is up with no card open is still in the wizard: since the Draft was started.
    const daysHolding = status !== "up_now" ? 0 : open.length > 0 ? daysActionable(c, open, today) : Math.max(0, daysBetween(c.createdAt.slice(0, 10), today));

    let note: string;
    let nextTask: Task | undefined;
    if (status === "up_now") {
      note = open[0]?.title ? `Up: ${open[0].title}` : "Working on the plan";
    } else if (standing === "awaiting_routing") {
      note = AWAITING_ROUTING_NOTE;
    } else if (status === "waiting") {
      const waitingFor = lockedStanding(c, party, locked);
      note = waitingFor.note ?? "Waiting on an earlier step";
      nextTask = waitingFor.task;
    } else if (status === "done_for_now") {
      note = decisionNote(c, party) ?? "Nothing due right now";
    } else {
      note = "Not involved in this case";
    }

    const row: PartyStatus = { party, status, openTasks: open, oldestDue, daysHolding, note, scope: scopeFor(c, party) };
    return nextTask ? { ...row, nextTask } : row;
  });
};

/**
 * What a party does next, read as "<party> <phrase>". Cards and city tasks whose titles are
 * commands ("Accept conditions and sign", "Issue permit") get their own wording; the rest are
 * built from the task's kind and title.
 */
const PHRASE: Record<string, string> = {
  // applicant cards
  neighbor_signoff: "collects the neighbor sign-offs",
  submit_application: "submits the application",
  community_notification: "posts the community notice",
  respond_to_request: "responds to the request",
  accept_and_sign: "accepts the conditions and signs",
  pay_fees: "pays the fees and deposit",
  vendor_food_permits: "downloads the vendors' food permits",
  carry_permit: "carries the permit on the day",
  final_bill_or_refund: "pays the final bill",
  feedback: "sends feedback",
  book_again: "can book again for next year",
  // city tasks
  intake_check: "checks the application is complete",
  confirm_routing: "confirms reviewers and due dates",
  schedule_pre_application_meeting: "schedules the pre-application meeting",
  consolidate: "consolidates the reviews and sends the quote",
  issue_permit: "issues the permit",
  cleanup_inspection: "inspects the cleanup",
  log_actual_hours: "logs the actual hours",
  reconcile: "reconciles the costs and closes",
  instant_exception: "resolves the exception",
};

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function verbPhrase(task: Task): string {
  // After a department denies its section the Clerk's task is to deny the application, not to quote it.
  if (task.catalogId === "consolidate" && task.payload.denied === true) return "acts on a reviewer's denial";
  // Until the Clerk reconciles, nobody knows whether the event ends in a bill or a refund.
  if (task.catalogId === "final_bill_or_refund" && task.status === "locked") return "gets the final bill or refund";
  const known = PHRASE[task.catalogId];
  if (known) return known;
  if (task.catalogId.startsWith("review:")) return "reviews its sections";
  if (task.catalogId.startsWith("verify:")) return `verifies the ${lowerFirst(task.title.replace(/^Verify /, ""))}`;
  if (task.catalogId.startsWith("work_order:")) return "completes its work orders";
  const title = lowerFirst(task.title);
  switch (task.kind) {
    case "document":
      return `uploads the ${title}`;
    case "form":
      return `fills out the ${title}`;
    case "payment":
      return `pays the ${title}`;
    case "sign_off":
      return `signs off on the ${title}`;
    case "meeting":
      return `attends the ${title}`;
    case "review":
      return `reviews the ${title}`;
    case "inspection":
      return `carries out the ${title}`;
    default:
      return `completes "${task.title}"`;
  }
}

function partyName(party: Party, applicantName?: string): string {
  return party === "applicant" ? applicantName || "The applicant" : PARTY_LABEL[party];
}

/** How an ended case reads in a sentence: "this case was denied", "lost its date hold". */
const ENDING_PHRASE: Record<Ending, string> = {
  withdrawn: "was withdrawn",
  denied: "was denied",
  cancelled: "was cancelled",
  hold_expired: "lost its date hold",
};

export const nextMove: StateApi["nextMove"] = (c: EventCase, today: ISODate, applicantName?: string): string => {
  if (c.ending) return `Next: nothing further; this case ${ENDING_PHRASE[c.ending]}.`;
  if (c.state === "closed") return "Next: nothing further; this case is closed.";

  const statuses = waitingOn(c, today);
  const upNow = statuses.filter((s) => s.status === "up_now");
  if (upNow.length === 0) return "Next: nothing is actionable right now.";

  // An applicant who is up with no card open is still in the wizard: a Draft before its board.
  const parts = upNow.map((s) => `${partyName(s.party, applicantName)} ${s.openTasks[0] ? verbPhrase(s.openTasks[0]) : "finishes the plan"}`);
  // "A, and B" for two; "A, B, and C" for three or more.
  let sentence = `Next: ${parts.length > 2 ? `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}` : parts.join(", and ")}`;

  // A department parked on the applicant's answer goes next. Otherwise it is the waiting party
  // whose locked task unlocks soonest: after closeout hours are logged the Clerk reconciles,
  // and only then does the applicant's final bill open. A department still waiting to be
  // routed has no task to name, so the sentence stops before it.
  const reReviewer = statuses.find((s) => s.status === "waiting" && c.tasks.some((t) => t.owner === s.party && t.payload.awaitingAnswer === true));
  if (reReviewer) return `${sentence}, then ${partyName(reReviewer.party, applicantName)} re-reviews.`;

  let next: { party: Party; task: Task } | undefined;
  for (const s of statuses) {
    if (s.status !== "waiting") continue;
    const task = nextToUnlock(c, s.party);
    if (task && (!next || unlockRank(task) < unlockRank(next.task))) next = { party: s.party, task };
  }
  if (next) sentence += `, then ${partyName(next.party, applicantName)} ${verbPhrase(next.task)}`;

  return `${sentence}.`;
};

/** A case before Permitted with nobody up is a bug; dev builds can surface this. */
export function isStalled(c: EventCase, today: ISODate): boolean {
  if (c.ending) return false;
  const beforePermitted = c.state === "draft" || c.state === "submitted" || c.state === "in_review" || c.state === "needs_info" || c.state === "quote_sent";
  if (!beforePermitted) return false;
  return waitingOn(c, today).every((s) => s.status !== "up_now");
}

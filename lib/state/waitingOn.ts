/**
 * "Who's up." Nobody sets a party's standing by hand: it is read off the case's tasks and
 * reviews. waitingOn() and nextMove() share one pass over the four parties.
 */
import { daysBetween } from "@/lib/dates";
import { plural } from "@/lib/format";
import { ENDING_LABEL, PARTIES, PARTY_LABEL } from "@/lib/types";
import type { EventCase, ISODate, Party, Task } from "@/lib/types";
import { signoffsLeft, taskDueDate } from "./core";
import type { PartyStanding, PartyStatus, StateApi } from "./types";

const DEFAULT_SCOPE: Record<Party, string> = {
  applicant: "Describing the event, documents and payment",
  clerk: "Intake, routing, quote, permit and closeout",
  pws: "Streets, structures and safety",
  hl: "Insurance, food and accessibility",
};

const CITY_UNLOCK_HINT: Record<string, string> = {
  issue_permit: "Unlocks when paid and verified",
  reconcile: "Unlocks when hours are logged",
  consolidate: "Unlocks when every review is in",
};

function scopeFor(c: EventCase, party: Party): string {
  if (party === "applicant") return DEFAULT_SCOPE.applicant;
  const review = c.reviews.find((r) => r.dept === party);
  if (review && review.sections.length > 0) return review.sections.join(", ");
  return DEFAULT_SCOPE[party];
}

function involvedLocal(c: EventCase, party: Party): boolean {
  if (party === "applicant") return true;
  if (party === "clerk") return c.state !== "draft";
  return c.reviews.some((r) => r.dept === party) || c.tasks.some((t) => t.owner === party || t.reviewer === party);
}

function daysActionable(tasks: Task[], today: ISODate): number {
  let max = 0;
  for (const t of tasks) {
    const firstOpen = t.history.find((h) => h.status === "todo" || h.status === "changes_requested");
    if (!firstOpen) continue;
    max = Math.max(max, daysBetween(firstOpen.at.slice(0, 10), today));
  }
  return Math.max(0, max);
}

function lockedNote(c: EventCase, tasks: Task[]): string | undefined {
  if (tasks.some((t) => t.payload.awaitingAnswer === true)) return "Waiting on the applicant's response";
  if (tasks.some((t) => t.payload.awaitingSignoffs === true)) return `Waiting on ${plural(signoffsLeft(c), "neighbor sign-off")}`;
  for (const t of tasks) {
    const hint = CITY_UNLOCK_HINT[t.catalogId];
    if (hint) return hint;
  }
  return undefined;
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
      status: (involvedLocal(c, party) ? "done_for_now" : "not_involved") as PartyStanding,
      openTasks: [],
      oldestDue: null,
      daysHolding: 0,
      note: `Ended: ${ENDING_LABEL[c.ending as keyof typeof ENDING_LABEL]}`,
      scope: scopeFor(c, party),
    }));
  }

  return PARTIES.map((party) => {
    const open = c.tasks.filter((t) => t.owner === party && (t.status === "todo" || t.status === "changes_requested"));
    const ownedTasks = c.tasks.filter((t) => t.owner === party);
    const locked = ownedTasks.filter((t) => t.status === "locked");
    const involved = involvedLocal(c, party);

    let status: PartyStanding;
    if (party === "applicant" && c.state === "draft" && open.length === 0) {
      status = "up_now";
    } else if (open.length > 0) {
      status = "up_now";
    } else if (!involved) {
      status = "not_involved";
    } else if (locked.length > 0 && ownedTasks.every((t) => t.status === "locked" || t.status === "done")) {
      status = "waiting";
    } else {
      status = "done_for_now";
    }

    const dueDates = open.map(taskDueDate).filter((d): d is ISODate => d !== null).sort();
    const oldestDue = dueDates[0] ?? null;
    const daysHolding = status === "up_now" ? daysActionable(open, today) : 0;

    let note: string;
    if (status === "up_now") {
      note = open[0]?.title ? `Up: ${open[0].title}` : "Working on the plan";
    } else if (status === "waiting") {
      note = lockedNote(c, locked) ?? "Waiting on an earlier step";
    } else if (status === "done_for_now") {
      note = decisionNote(c, party) ?? "Nothing due right now";
    } else {
      note = "Not involved in this case";
    }

    return { party, status, openTasks: open, oldestDue, daysHolding, note, scope: scopeFor(c, party) };
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

export const nextMove: StateApi["nextMove"] = (c: EventCase, today: ISODate, applicantName?: string): string => {
  if (c.ending) return `Next: nothing further; this case is ${ENDING_LABEL[c.ending].toLowerCase()}.`;
  if (c.state === "closed") return "Next: nothing further; this case is closed.";

  const statuses = waitingOn(c, today);
  const upNow = statuses.filter((s) => s.status === "up_now");
  if (upNow.length === 0) return "Next: nothing is actionable right now.";

  const parts = upNow.map((s) => `${partyName(s.party, applicantName)} ${s.openTasks[0] ? verbPhrase(s.openTasks[0]) : "acts"}`);
  let sentence = `Next: ${parts.join(", and ")}`;

  // A department parked on the applicant's answer goes next; otherwise whoever is waiting on an earlier step.
  const reReviewer = statuses.find((s) => s.status === "waiting" && c.tasks.some((t) => t.owner === s.party && t.payload.awaitingAnswer === true));
  const waitingParty = reReviewer ?? statuses.find((s) => s.status === "waiting");
  if (waitingParty) {
    const lockedTask = c.tasks.find((t) => t.owner === waitingParty.party && t.status === "locked");
    const then = reReviewer ? "re-reviews" : lockedTask ? verbPhrase(lockedTask) : "acts";
    sentence += `, then ${partyName(waitingParty.party, applicantName)} ${then}`;
  }

  return `${sentence}.`;
};

/** A case before Permitted with nobody up is a bug; dev builds can surface this. */
export function isStalled(c: EventCase, today: ISODate): boolean {
  if (c.ending) return false;
  const beforePermitted = c.state === "draft" || c.state === "submitted" || c.state === "in_review" || c.state === "needs_info" || c.state === "quote_sent";
  if (!beforePermitted) return false;
  return waitingOn(c, today).every((s) => s.status !== "up_now");
}

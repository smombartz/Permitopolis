/**
 * "Who's up." Nobody sets a party's standing by hand: it is read off the case's tasks and
 * reviews. waitingOn() and nextMove() share one pass over the four parties.
 */
import { daysBetween } from "@/lib/dates";
import { ENDING_LABEL, PARTIES, PARTY_LABEL } from "@/lib/types";
import type { EventCase, ISODate, Party, Task } from "@/lib/types";
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

function lockedNote(tasks: Task[]): string | undefined {
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

    const dueDates = open.map((t) => t.dueDate).filter((d): d is ISODate => d !== null).sort();
    const oldestDue = dueDates[0] ?? null;
    const daysHolding = status === "up_now" ? daysActionable(open, today) : 0;

    let note: string;
    if (status === "up_now") {
      note = open[0]?.title ? `Up: ${open[0].title}` : "Working on the plan";
    } else if (status === "waiting") {
      note = lockedNote(locked) ?? "Waiting on an earlier step";
    } else if (status === "done_for_now") {
      note = decisionNote(c, party) ?? "Nothing due right now";
    } else {
      note = "Not involved in this case";
    }

    return { party, status, openTasks: open, oldestDue, daysHolding, note, scope: scopeFor(c, party) };
  });
};

function verbPhrase(task: Task): string {
  const title = task.title.charAt(0).toLowerCase() + task.title.slice(1);
  switch (task.kind) {
    case "document":
      return `uploads ${title}`;
    case "form":
      return `fills out ${title}`;
    case "payment":
      return `pays ${title}`;
    case "sign_off":
      return `signs off on ${title}`;
    case "meeting":
      return `schedules ${title}`;
    case "review":
      return `reviews ${title}`;
    case "inspection":
      return `inspects for ${title}`;
    default:
      return `completes ${title}`;
  }
}

function partyName(party: Party): string {
  return party === "applicant" ? "The applicant" : PARTY_LABEL[party];
}

export const nextMove: StateApi["nextMove"] = (c: EventCase, today: ISODate): string => {
  if (c.ending) return `Next: nothing further; this case is ${ENDING_LABEL[c.ending].toLowerCase()}.`;
  if (c.state === "closed") return "Next: nothing further; this case is closed.";

  const statuses = waitingOn(c, today);
  const upNow = statuses.filter((s) => s.status === "up_now");
  if (upNow.length === 0) return "Next: nothing is actionable right now.";

  const parts = upNow.map((s) => `${partyName(s.party)} ${s.openTasks[0] ? verbPhrase(s.openTasks[0]) : "acts"}`);
  let sentence = `Next: ${parts.join(", and ")}`;

  const waitingParty = statuses.find((s) => s.status === "waiting");
  if (waitingParty) sentence += `, then ${PARTY_LABEL[waitingParty.party]} ${waitingParty.party === "applicant" ? "acts" : "reviews again"}`;

  return `${sentence}.`;
};

/** A case before Permitted with nobody up is a bug; dev builds can surface this. */
export function isStalled(c: EventCase, today: ISODate): boolean {
  if (c.ending) return false;
  const beforePermitted = c.state === "draft" || c.state === "submitted" || c.state === "in_review" || c.state === "needs_info" || c.state === "quote_sent";
  if (!beforePermitted) return false;
  return waitingOn(c, today).every((s) => s.status !== "up_now");
}

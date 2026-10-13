/**
 * What the engine and the screens read about an amendment (PRD, "Amend"): where it stands, the
 * plan the permit still covers, and what the amended plan owes. Pure, like every selector; the
 * transitions that move an amendment along are in ./transitions/amendment.ts.
 *
 * How an amendment is kept. `amend` writes the new answers onto the record at once (tier,
 * triggers, sessions and fee lines follow them), sets `flags.amendmentPending` when the change
 * adds a card somebody has to see, and puts what the record looked like before on the
 * amendment's own "Submit application" card (`payload.pendingAmendment`). So the board, the
 * city's lists and the fee table all show the amended plan while it is pending, and the plan
 * the permit covers (`permittedPlan()`) is read back from that card: the permit page and the
 * public check show it. A decline restores it exactly.
 */
import { classify, estimateFees } from "@/lib/rules";
import { round2 } from "@/lib/rules/shared";
import type { RulesConfig } from "@/lib/rules/types";
import type { EventAnswers, EventCase, FeeLine, ISODate, Task, TaskStatus, Tier, Trigger, UnlockEvent } from "@/lib/types";
import { caseTotal, findTask, taskId, totalPaid } from "./core";

/** The record as it was before a pending amendment, kept so the permit can still be read and a decline can put it back. */
export interface PendingAmendment {
  /** The answers the permit still covers. */
  priorAnswers: EventAnswers;
  priorTier: Tier;
  priorTriggers: Trigger[];
  priorLateFee: boolean;
  /** The fee lines exactly as they were: a reviewer's lines, the Clerk's edits and the ids included. */
  priorFeeLines: FeeLine[];
  /** How "Submit application" stood before the amendment reopened it; null when the amendment added the card. */
  priorSubmit: { status: TaskStatus; unlocksOn: UnlockEvent | null; tags: Task["tags"] } | null;
  proposedOn: ISODate;
}

function submitCard(c: EventCase): Task | undefined {
  return findTask(c, taskId(c.id, "submit_application"));
}

/** The pending amendment's record of the plan before it, or null when none is pending. */
export function pendingAmendment(c: EventCase): PendingAmendment | null {
  if (!c.flags.amendmentPending) return null;
  return (submitCard(c)?.payload.pendingAmendment as PendingAmendment | undefined) ?? null;
}

/**
 * Where a pending amendment stands:
 * - `proposed`: the applicant is still on its cards, or has not submitted it yet.
 * - `submitted`: with the city. Departments check its cards, then the City Clerk decides.
 * - `approved`: the Clerk approved it; it takes effect once the applicant has signed and paid
 *   what it adds.
 * Null when no amendment is pending.
 */
export type AmendmentStage = "proposed" | "submitted" | "approved";

export function amendmentStage(c: EventCase): AmendmentStage | null {
  if (!c.flags.amendmentPending) return null;
  const submit = submitCard(c);
  const submitted = !!submit && submit.tags.includes("amendment") && submit.status === "done";
  if (!submitted) return "proposed";
  return findTask(c, taskId(c.id, "decide_amendment"))?.status === "done" ? "approved" : "submitted";
}

/**
 * The amendment's cards a department still has (`submitted`) or has sent back
 * (`changes_requested`). The Clerk's decision waits for them: approving a DJ before Public Works
 * & Safety has read the sound details would decide nothing.
 */
export function amendmentCardsInFlight(c: EventCase): Task[] {
  return c.tasks.filter((t) => t.owner === "applicant" && t.tags.includes("amendment") && (t.status === "submitted" || t.status === "changes_requested"));
}

const hasPermit = (c: EventCase) => c.ending === null && (c.state === "permitted" || c.state === "event_day");

/** A permitted case whose "Accept conditions and sign" card is open again: an approved amendment added it. */
export function amendmentSignOpen(c: EventCase): boolean {
  return hasPermit(c) && findTask(c, taskId(c.id, "accept_and_sign"))?.status === "todo";
}

/** A permitted case whose payment card is open again: an amendment made the plan cost more than was paid. */
export function amendmentPayOpen(c: EventCase): boolean {
  return hasPermit(c) && findTask(c, taskId(c.id, "pay_fees"))?.status === "todo";
}

/**
 * What an amended plan owes beyond what has been paid: positive when more is due, negative when
 * something goes back. A series' sessions that are billed on their own day (upcoming or due) are
 * left out, as they are from a quote: only what the plan asks for now is compared.
 */
export function amendmentBalance(c: EventCase, cfg: RulesConfig): number {
  const total = caseTotal(c);
  if (!c.schedule?.recurrence) return round2(total - totalPaid(c));
  const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0;
  const billedLater = c.schedule.occurrences.filter((o) => o.billing === "upcoming" || o.billing === "due").length;
  return round2(total - billedLater * perSession - totalPaid(c));
}

/** What the applicant can pay toward an amendment now: the balance while the payment card is open, else 0. */
export function amendmentPaymentDue(c: EventCase, cfg: RulesConfig): number {
  return amendmentPayOpen(c) ? Math.max(0, amendmentBalance(c, cfg)) : 0;
}

/**
 * The case as its permit covers it: the record itself, or, while an amendment is pending, the
 * record with the answers, tier and triggers it had before ("The current permit stays valid for
 * the original plan until the amendment is approved"). The permit page and the public check
 * show this; everything else shows the record.
 */
export function permittedPlan(c: EventCase): EventCase {
  const pending = pendingAmendment(c);
  return pending ? { ...c, ...pending.priorAnswers, tier: pending.priorTier, triggers: pending.priorTriggers } : c;
}

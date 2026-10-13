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
import { permitComponents } from "@/lib/rules";
import { round2 } from "@/lib/rules/shared";
import type { PermitComponent, RulesConfig } from "@/lib/rules/types";
import type { EventAnswers, EventCase, FeeLine, ISODate, Task, TaskStatus, Tier, Trigger, UnlockEvent } from "@/lib/types";
import { caseTotal, findTask, sessionPrice, taskId, totalPaid } from "./core";

/** The record as it was before a pending amendment, kept so the permit can still be read and a decline can put it back. */
export interface PendingAmendment {
  /** The answers the permit still covers. */
  priorAnswers: EventAnswers;
  priorTier: Tier;
  priorTriggers: Trigger[];
  priorLateFee: boolean;
  /** The fee lines exactly as they were: a reviewer's lines, the Clerk's edits and the ids included. */
  priorFeeLines: FeeLine[];
  /** How "Submit application" stood before the amendment reopened it, its own name included; null when the amendment added the card. */
  priorSubmit: { status: TaskStatus; unlocksOn: UnlockEvent | null; tags: Task["tags"]; title?: string; why?: string } | null;
  /**
   * How a permitted case's payment card stood before the amendment: an approval opens it again
   * for the difference, and a lapse puts it back. Null before the permit (the card is still the
   * quote's) and when the plan has none; absent on an amendment proposed before this was kept.
   */
  priorPay?: Pick<Task, "status" | "title" | "why" | "dueDate" | "unlocksOn" | "payload"> | null;
  proposedOn: ISODate;
}

/** What the amendment's own Submit card is called while it is the amendment's: it sends a change, not an application. */
export const AMENDMENT_SUBMIT_CARD = { title: "Submit amendment", why: "Send your change to the City Clerk" } as const;

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
  const billedLater = c.schedule.occurrences.filter((o) => o.billing === "upcoming" || o.billing === "due").length;
  return round2(total - billedLater * sessionPrice(c, cfg) - totalPaid(c));
}

/** What the applicant can pay toward an amendment now: the balance while the payment card is open, else 0. */
export function amendmentPaymentDue(c: EventCase, cfg: RulesConfig): number {
  return amendmentPayOpen(c) ? Math.max(0, amendmentBalance(c, cfg)) : 0;
}

/**
 * The case as its permit covers it: the record itself, or, while an amendment is pending, the
 * record with the answers, tier, triggers and fee lines it had before ("The current permit stays
 * valid for the original plan until the amendment is approved"). The permit page and the public
 * check show this, and a cancellation refunds it (the amended plan's deposit and late fee are
 * nobody's until the amendment takes effect); everything else shows the record.
 */
export function permittedPlan(c: EventCase): EventCase {
  const pending = pendingAmendment(c);
  return pending ? { ...c, ...pending.priorAnswers, tier: pending.priorTier, triggers: pending.priorTriggers, feeLines: pending.priorFeeLines } : c;
}

/**
 * What the permit covers, read off the record: the plan the permit is for (`permittedPlan()`)
 * and the triggers stored with it, never the tier rules as Settings has them today. A case past
 * Draft keeps the tier it was submitted under, so its permit keeps its list: lowering "Reviewed
 * at" does not add an insurance check to an Instant permit that is already issued. The block
 * party exception is on the record as its trigger.
 */
export function permitCovers(c: EventCase): PermitComponent[] {
  const plan = permittedPlan(c);
  return permitComponents(plan, plan.triggers, plan.triggers.some((t) => t.id === "block_party"));
}

/**
 * What has been paid toward a pending amendment: whatever is paid beyond what the plan the
 * permit covers asks for. It was paid for the amended plan, so it goes back whole if that plan
 * never takes effect (the permit is cancelled, or the event arrives first). 0 with none pending.
 */
export function paidTowardPendingAmendment(c: EventCase, cfg: RulesConfig): number {
  const plan = permittedPlan(c);
  return plan === c ? 0 : Math.max(0, -amendmentBalance(plan, cfg));
}

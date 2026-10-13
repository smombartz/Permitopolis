/**
 * Pure view-model for the amendment wizard (`/events/[id]/amend`). No React, no store: the
 * screen keeps the applicant's proposed answers locally (nothing is dispatched until the last
 * step is confirmed) and calls `buildAmendmentDiff()` on every change to compare them with the
 * record as it stands, the same way `amend()` (`lib/state/transitions/applicant.ts`) will. The
 * two are not the same code, so a test holds them together against the real seed
 * (amend.test.ts); if they ever disagree, `amend()` is the one that counts.
 */
import { fmtDate, fmtMoney, fmtNumber, fmtTimeRange, plural } from "@/lib/format";
import { classify, dateGate, estimateFees, requirements, type Classification, type DateGate, type FeeEstimate } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import { amendmentBalance, amendmentCardsInFlight, amendmentStage, checkDecideAmendment, pendingAmendment, type AmendmentStage } from "@/lib/state";
import { PARTY_LABEL, TIER_LABEL, type AddOns, type Dept, type EventAnswers, type EventCase, type ISODate, type Task, type TaskStatus, type Tier } from "@/lib/types";

/** Mirrors `answersOf()` in transitions/applicant.ts: only what the wizard collects. */
export function amendAnswersOf(a: EventAnswers): EventAnswers {
  return { eventType: a.eventType, name: a.name, description: a.description, location: a.location, schedule: a.schedule, attendance: a.attendance, addOns: a.addOns };
}

function isCatalogId(id: string): id is keyof typeof CARD_BY_ID {
  return id in CARD_BY_ID;
}

/** A board card's title, for a plan-stage catalogue id (never a city task or a request card). */
function planCardCatalogIds(tasks: Task[]): Set<string> {
  return new Set(
    tasks
      .filter((t) => t.owner === "applicant" && isCatalogId(t.catalogId) && (CARD_BY_ID as Record<string, CardSpec>)[t.catalogId]?.stage === "plan")
      .map((t) => t.catalogId),
  );
}

export interface CardDiffRow {
  catalogId: string;
  title: string;
}

export interface AmendmentDiff {
  /** False once nothing a reviewer needs to see again changed (same as `amend()`'s `material`): applies at once, with no City Clerk decision. */
  material: boolean;
  tierBefore: Tier;
  tierAfter: Tier;
  tierRose: boolean;
  tierFell: boolean;
  tierLabelBefore: string;
  tierLabelAfter: string;
  summary: string;
  cardsAdded: CardDiffRow[];
  cardsRemoved: CardDiffRow[];
  feeBefore: number;
  feeAfter: number;
  paid: number;
  /** Positive: more is owed. Negative: a refund. Zero: nothing changes hands. */
  feeDiff: number;
  lateFeeAmount: number | null;
  gate: DateGate;
  /** The gate's own answer to "does this amendment need the tier's notice at all" (a later date or a tier rise), mirroring `amendmentNeedsNotice()`. */
  needsNotice: boolean;
}

/**
 * The full comparison the amendment's last step shows: what changes, the tier before and
 * after, the cards the new plan adds and the ones it no longer calls for, the fee difference,
 * and whether the date gate now fails. `lateFee` is the applicant's own choice at the gate, the
 * same flag the wizard's `DateGateBanner` sets.
 */
export function buildAmendmentDiff(original: EventCase, proposed: EventAnswers, ctx: RulesCtx, options: { lateFee?: boolean } = {}): AmendmentDiff {
  const answers = amendAnswersOf(proposed);
  const beforeCls = classify(original, ctx.cfg);
  const afterCls = classify(answers, ctx.cfg);

  const gate = dateGate(answers, afterCls, ctx, original.id);
  const tierOrder: Tier[] = ["instant", "reviewed", "special"];
  const tierRose = tierOrder.indexOf(afterCls.tier) > tierOrder.indexOf(beforeCls.tier);
  const tierFell = tierOrder.indexOf(afterCls.tier) < tierOrder.indexOf(beforeCls.tier);
  const needsNotice = tierRose || original.schedule?.date !== answers.schedule?.date;

  const lateFee = !!options.lateFee;
  const freshTasks = requirements(answers, afterCls, { caseId: original.id, today: ctx.today, cfg: ctx.cfg });
  const beforeCardIds = planCardCatalogIds(original.tasks);
  const freshCardIds = new Set(freshTasks.filter((t) => isCatalogId(t.catalogId)).map((t) => t.catalogId));
  const existingTaskIds = new Set(original.tasks.map((t) => t.id));

  const titleFor = (catalogId: string): string => (isCatalogId(catalogId) ? (CARD_BY_ID as Record<string, CardSpec>)[catalogId]?.title ?? catalogId : catalogId);

  const cardsAdded: CardDiffRow[] = freshTasks
    .filter((t) => !existingTaskIds.has(t.id))
    .map((t) => ({ catalogId: t.catalogId, title: t.title }));
  const cardsRemoved: CardDiffRow[] = [...beforeCardIds]
    .filter((id) => !freshCardIds.has(id))
    .map((id) => ({ catalogId: id, title: titleFor(id) }));

  const material = cardsAdded.length > 0;
  const fees: FeeEstimate = estimateFees(answers, afterCls, ctx.cfg, { caseId: original.id, lateFee });
  const lateFeeLine = fees.lines.find((line) => line.kind === "late_fee");
  const feeBefore = original.feeLines.reduce((sum, line) => sum + (line.kind === "deposit" ? line.estimate : line.kind === "fee" || line.kind === "late_fee" ? line.estimate : 0), 0);
  const paid = original.payments.reduce((sum, p) => sum + p.amount, 0);
  const feeAfter = fees.total;

  return {
    material,
    tierBefore: beforeCls.tier,
    tierAfter: afterCls.tier,
    tierRose,
    tierFell,
    tierLabelBefore: TIER_LABEL[beforeCls.tier],
    tierLabelAfter: TIER_LABEL[afterCls.tier],
    summary: afterCls.summary,
    cardsAdded,
    cardsRemoved,
    feeBefore: round2(feeBefore),
    feeAfter: round2(feeAfter),
    paid: round2(paid),
    feeDiff: round2(feeAfter - paid),
    lateFeeAmount: lateFeeLine ? lateFeeLine.estimate : null,
    gate,
    needsNotice,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "This change makes your event Reviewed. Everything you entered is kept; 3 new cards will be added." */
export function tierRiseBannerText(diff: AmendmentDiff): string {
  const n = diff.cardsAdded.length;
  return `This change makes your event ${diff.tierLabelAfter}. Everything you entered is kept; ${n} new card${n === 1 ? "" : "s"} will be added.`;
}

/** Whether the proposed change is ready to confirm: the gate passes outright, or the applicant chose the late fee and that is what carries it through. */
export function amendmentGateSatisfied(diff: AmendmentDiff, lateFee: boolean): boolean {
  return diff.gate.ok || (lateFee && !diff.gate.ok && diff.gate.fixes.includes("late_fee"));
}

export type { Classification };

/* ---------------------------------------------------------------------- */
/* A pending amendment, as the city reads it: the case's banner and the   */
/* Clerk's "Decide amendment" panel                                        */
/* ---------------------------------------------------------------------- */

const ADD_ON_LABEL: [key: keyof AddOns, label: string][] = [
  ["amplifiedSound", "Amplified sound"],
  ["alcohol", "Alcohol"],
  ["foodVending", "Food or vending"],
  ["tentsStages", "Tents or stages"],
  ["cookingGenerators", "Cooking or generators"],
  ["fireworksDrones", "Fireworks or drones"],
  ["admission", "Admission charged"],
  ["cityServices", "City services"],
];

const isOn = (value: AddOns[keyof AddOns]) => value !== null && value !== false;

/**
 * What an amendment changes in the applicant's answers, one line each, in the order of the
 * wizard: "Place: Shelter 3 to Shelter 2", "Amplified sound: added". An add-on that stays on
 * with other numbers (two more vendors, ten more barricades) reads "changed".
 */
export function answerChanges(before: EventAnswers, after: EventAnswers): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`Name: ${before.name || "none"} to ${after.name || "none"}`);
  if (before.location?.label !== after.location?.label) lines.push(`Place: ${before.location?.label ?? "none"} to ${after.location?.label ?? "none"}`);
  if (before.schedule?.date !== after.schedule?.date) lines.push(`Date: ${before.schedule ? fmtDate(before.schedule.date) : "none"} to ${after.schedule ? fmtDate(after.schedule.date) : "none"}`);
  const hours = (a: EventAnswers) => (a.schedule ? fmtTimeRange(a.schedule.start, a.schedule.end) : "none");
  if (hours(before) !== hours(after)) lines.push(`Hours: ${hours(before)} to ${hours(after)}`);
  if (before.attendance !== after.attendance) lines.push(`Attendance: ${before.attendance === null ? "none" : fmtNumber(before.attendance)} to ${after.attendance === null ? "none" : fmtNumber(after.attendance)}`);
  for (const [key, label] of ADD_ON_LABEL) {
    const was = isOn(before.addOns[key]);
    const is = isOn(after.addOns[key]);
    if (was !== is) lines.push(`${label}: ${is ? "added" : "removed"}`);
    else if (is && JSON.stringify(before.addOns[key]) !== JSON.stringify(after.addOns[key])) lines.push(`${label}: changed`);
  }
  return lines;
}

/** How a card of the amendment stands, in the city's words. */
const AMENDMENT_CARD_STATUS: Record<TaskStatus, string> = {
  locked: "Not open yet",
  todo: "With the applicant",
  submitted: "Being checked",
  changes_requested: "Sent back",
  done: "Checked",
};

export interface AmendmentCardRow {
  id: string;
  title: string;
  status: TaskStatus;
  /** "Being checked by Public Works & Safety", "Checked", "With the applicant". */
  statusText: string;
  reviewer: Dept | null;
}

export interface AmendmentReview {
  stage: AmendmentStage;
  proposedOn: ISODate | null;
  tierBefore: Tier;
  tierAfter: Tier;
  changes: string[];
  /** The cards the amendment added, in the order the board lists them. */
  cards: AmendmentCardRow[];
  totalBefore: number;
  totalAfter: number;
  paid: number;
  /** Positive: the applicant owes it once approved. Negative: it goes back. */
  balance: number;
  lateFee: number | null;
  /** Why the Clerk cannot approve yet, in the engine's words; null when the Clerk can. */
  approveBlockedBy: string | null;
  /** One sentence for the banner on the case: where the amendment stands and whose move it is. */
  status: string;
}

function joinParties(depts: Dept[]): string {
  const names = depts.map((d) => PARTY_LABEL[d]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A pending amendment as the city side shows it: what changed, the cards it added and who has
 * each, the money, and whose move it is. Null when nothing is pending. Every figure is the
 * engine's (`amendmentBalance()`, the stage, the check the Clerk's approval runs), read off the
 * record and the plan it kept from before.
 */
export function amendmentReview(c: EventCase, cfg: RulesConfig): AmendmentReview | null {
  const stage = amendmentStage(c);
  if (stage === null) return null;
  const prior = pendingAmendment(c);
  const cards: AmendmentCardRow[] = c.tasks
    .filter((t) => t.owner === "applicant" && t.tags.includes("amendment"))
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      statusText: t.status === "submitted" && t.reviewer ? `Being checked by ${PARTY_LABEL[t.reviewer]}` : t.status === "done" && t.catalogId === "submit_application" ? "Submitted" : AMENDMENT_CARD_STATUS[t.status],
      reviewer: t.reviewer,
    }));

  const sum = (lines: EventCase["feeLines"]) => Math.round(lines.reduce((total, line) => total + line.estimate, 0) * 100) / 100;
  const balance = amendmentBalance(c, cfg);
  const approve = stage === "submitted" ? checkDecideAmendment(c, "approve") : null;
  const checking = [...new Set(amendmentCardsInFlight(c).filter((t) => t.status === "submitted" && t.reviewer).map((t) => t.reviewer as Dept))];
  const sentBack = amendmentCardsInFlight(c).some((t) => t.status === "changes_requested");

  let status: string;
  if (stage === "proposed") status = "Waiting on the applicant to finish its cards and submit it.";
  else if (stage === "approved") status = balance > 0 ? `Approved. Waiting on the applicant to sign and pay ${fmtMoney(balance)}.` : "Approved. Waiting on the applicant to sign.";
  else if (sentBack) status = "A card was sent back: waiting on the applicant, then the City Clerk decides.";
  else if (checking.length > 0) status = `${joinParties(checking)} ${checking.length === 1 ? "is" : "are"} checking its cards, then the City Clerk decides.`;
  else status = "Its cards are checked: the City Clerk decides.";

  return {
    stage,
    proposedOn: prior?.proposedOn ?? null,
    tierBefore: prior?.priorTier ?? c.tier,
    tierAfter: c.tier,
    changes: prior ? answerChanges(prior.priorAnswers, c) : [],
    cards,
    totalBefore: prior ? sum(prior.priorFeeLines) : sum(c.feeLines),
    totalAfter: sum(c.feeLines),
    paid: Math.round(c.payments.reduce((total, p) => total + p.amount, 0) * 100) / 100,
    balance,
    lateFee: c.feeLines.find((line) => line.kind === "late_fee" && !(prior?.priorFeeLines ?? []).some((before) => before.kind === "late_fee"))?.estimate ?? null,
    approveBlockedBy: approve && !approve.ok ? approve.reason : null,
    status,
  };
}

/** "Instant to Reviewed, 4 new cards" (or "Reviewed, 1 new card" when the tier holds): the banner's first words. */
export function amendmentHeadline(review: AmendmentReview): string {
  const tier = review.tierBefore === review.tierAfter ? TIER_LABEL[review.tierAfter] : `${TIER_LABEL[review.tierBefore]} to ${TIER_LABEL[review.tierAfter]}`;
  return `${tier}, ${plural(review.cards.length, "new card")}`;
}

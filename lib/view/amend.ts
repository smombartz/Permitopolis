/**
 * Pure view-model for the amendment wizard (`/events/[id]/amend`). No React, no store: the
 * screen keeps the applicant's proposed answers locally (nothing is dispatched until the last
 * step is confirmed) and calls `buildAmendmentDiff()` on every change to compare them with the
 * record as it stands, the same way `amend()` (`lib/state/transitions/applicant.ts`) will. The
 * two are not the same code, so a test holds them together against the real seed
 * (amend.test.ts); if they ever disagree, `amend()` is the one that counts.
 */
import { classify, dateGate, estimateFees, requirements, type Classification, type DateGate, type FeeEstimate } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import type { RulesCtx } from "@/lib/rules/types";
import { TIER_LABEL, type EventAnswers, type EventCase, type Task, type Tier } from "@/lib/types";

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

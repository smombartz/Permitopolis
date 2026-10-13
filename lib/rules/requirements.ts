/**
 * requirements(): the applicant's plan cards, all created up front. Locked cards
 * carry their unlock event; transition() fills dueDate for after_unlock and
 * hold_expiry rules once those events happen. Also permitComponents(), the
 * "one permit covers" list shown in the wizard and the board.
 */
import { CARD_CATALOG, type CardSpec } from "./catalog";
import { getSegment } from "@/lib/data/streets";
import { estimateFees } from "./fees";
import { DEFAULT_CONFIG } from "./config";
import { dueDate } from "./shared";
import type { Classification, PermitComponent, RulesConfig } from "./types";
import type { EventAnswers, ISODate, Task, TaskStatus, Trigger } from "@/lib/types";

function cardDueDate(spec: CardSpec, a: EventAnswers, cls: Classification, today: ISODate, cfg: RulesConfig): ISODate | null {
  const eventDate = a.schedule?.date ?? today;
  switch (spec.due.type) {
    case "none":
      return null;
    case "submit_by": {
      // The tier's notice before the event. A board made inside that notice (a late fee taken at
      // the date gate, an amendment close to the day) is due today: never on a day already gone.
      const by = dueDate(eventDate, -cls.leadTimeDays, cfg);
      return by < today ? today : by;
    }
    case "before_event":
      return dueDate(eventDate, -cfg.sla[spec.due.sla], cfg);
    case "after_unlock":
      return null; // set by transition() when the card unlocks
    case "hold_expiry":
      return null; // set by transition() when the quote is sent
    case "event_day":
      return eventDate;
    default:
      return null;
  }
}

function vendorName(a: EventAnswers, n: number): string {
  return a.addOns.foodVending?.vendorNames?.[n - 1] ?? `Vendor ${n}`;
}

function cardFromSpec(
  spec: CardSpec,
  a: EventAnswers,
  cls: Classification,
  ctx: { caseId: string; today: ISODate; cfg: RulesConfig },
  n?: number,
): Task {
  const { caseId, today, cfg } = ctx;
  const id = n === undefined ? `${caseId}:${spec.id}` : `${caseId}:${spec.id}:${n}`;
  const title = n === undefined ? spec.title : spec.title.replace("{vendor}", vendorName(a, n));
  const dueDateValue = cardDueDate(spec, a, cls, today, cfg);
  const status: TaskStatus = spec.unlocksOn === null ? "todo" : "locked";

  const task: Task = {
    id,
    catalogId: spec.id,
    owner: "applicant",
    kind: spec.kind,
    title,
    why: spec.why,
    reviewer: spec.reviewer,
    dueDate: dueDateValue,
    status,
    unlocksOn: spec.unlocksOn,
    phase: spec.phase,
    // A per-vendor card says whose it is in its payload as well as its title, so a screen that
    // needs the vendor (the health permit's checklist) does not read it back out of the title.
    payload: n === undefined ? {} : { vendorName: vendorName(a, n) },
    history: [],
    tags: [],
  };

  if (spec.id === "neighbor_signoff") {
    const segmentId = a.location?.segmentIds[0];
    const households = segmentId ? getSegment(segmentId)?.households ?? 0 : 0;
    task.payload = { progress: { done: 0, total: households } };
  }

  if (spec.id === "pay_fees") {
    const estimate = estimateFees(a, cls, cfg, { caseId });
    task.payload = { amount: estimate.dueNow ?? estimate.total };
    if (cls.tier === "instant") {
      task.title = "Pay and book";
      task.status = "todo";
      task.unlocksOn = null;
    }
  }

  return task;
}

export const requirements: (answers: EventAnswers, cls: Classification, ctx: { caseId: string; today: ISODate; cfg?: RulesConfig }) => Task[] = (
  answers,
  cls,
  ctxIn,
) => {
  const ctx = { caseId: ctxIn.caseId, today: ctxIn.today, cfg: ctxIn.cfg ?? DEFAULT_CONFIG };
  const tasks: Task[] = [];
  for (const spec of CARD_CATALOG) {
    if (spec.stage !== "plan") continue;
    if (!spec.when(answers, cls)) continue;
    if (spec.perVendor) {
      const count = answers.addOns.foodVending?.vendors ?? 0;
      for (let n = 1; n <= count; n++) tasks.push(cardFromSpec(spec, answers, cls, ctx, n));
    } else {
      tasks.push(cardFromSpec(spec, answers, cls, ctx));
    }
  }
  return tasks;
};

function hasTrigger(triggers: Trigger[], id: string): boolean {
  return triggers.some((t) => t.id === id);
}

export function permitComponents(a: EventAnswers, triggers: Trigger[], blockPartyException: boolean): PermitComponent[] {
  const components: PermitComponent[] = [];
  const tierIsReviewedOrSpecial = triggers.length > 0;

  if (a.location?.mode === "inventory") {
    // Booking a space is automatic only when nothing raises the tier; on a Reviewed or Special plan the Clerk approves it with the rest.
    components.push({ id: "space_reservation", label: "Space reservation", approvedBy: tierIsReviewedOrSpecial ? "City Clerk" : "City Clerk (automatic for Instant)" });
  }
  if (a.location?.mode === "area") {
    components.push({ id: "public_space_use", label: "Public space use", approvedBy: "City Clerk" });
  }
  if (blockPartyException) {
    components.push({ id: "block_party", label: "Block party approval", approvedBy: "City Clerk, Public Works & Safety" });
  } else if (hasTrigger(triggers, "street") || hasTrigger(triggers, "route")) {
    components.push({ id: "street_closure", label: "Street closure or route approval", approvedBy: "Public Works & Safety" });
  }
  if (a.addOns.amplifiedSound) {
    components.push({ id: "amplified_sound", label: "Amplified sound approval", approvedBy: "Public Works & Safety" });
  }
  if (a.addOns.alcohol) {
    components.push({ id: "alcohol_license", label: "Temporary alcohol license", approvedBy: "City Clerk, with Public Works & Safety for police" });
  }
  if (a.addOns.foodVending !== null) {
    components.push({ id: "food_vendor_permits", label: "Temporary food and vendor permits", approvedBy: "Health & Legal" });
  }
  if (a.addOns.tentsStages !== null || a.addOns.cookingGenerators || a.addOns.fireworksDrones) {
    components.push({ id: "structure_fire", label: "Structure and fire approval", approvedBy: "Public Works & Safety" });
  }
  if (tierIsReviewedOrSpecial) {
    components.push({ id: "insurance_verification", label: "Insurance verification", approvedBy: "Health & Legal" });
  }
  return components;
}

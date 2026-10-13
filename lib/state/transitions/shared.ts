/** Logic shared by more than one transition handler. */
import { addDaysISO } from "@/lib/dates";
import { CITY_TASKS } from "@/lib/rules/catalog";
import type { RulesCtx } from "@/lib/rules/types";
import type { EventCase, Task } from "@/lib/types";
import { lastSessionDate } from "../clock";
import { addTask, addTasks, findTask, moveTask, newTask, quotePaid, taskId, vendorHealthPermits } from "../core";

/**
 * "When the case is signed, the quote is paid and insurance_certificate is done, the
 * issue_permit task unlocks to 'todo'." Called after accept_and_sign, after a quote payment and
 * after a verification, since any one of them can be the last of the three conditions.
 */
export function maybeUnlockIssuePermit(c: EventCase, ctx: RulesCtx): EventCase {
  const issuePermitId = taskId(c.id, "issue_permit");
  const issuePermit = findTask(c, issuePermitId);
  if (!issuePermit || issuePermit.status !== "locked") return c;
  if (!c.flags.signed) return c;
  if (!quotePaid(c, ctx.cfg)) return c;
  const insurance = findTask(c, taskId(c.id, "insurance_certificate"));
  if (insurance && insurance.status !== "done") return c;
  return moveTask(c, issuePermitId, "todo", ctx, "system");
}

/**
 * Health & Legal's "Issue food permits" opens once every vendor's health permit is verified.
 * Called when the task is created (the permit is issued) and after each verification, since
 * either can come last.
 */
export function maybeUnlockIssueFoodPermits(c: EventCase, ctx: RulesCtx): EventCase {
  const id = taskId(c.id, "issue_food_permits");
  const task = findTask(c, id);
  if (!task || task.status !== "locked") return c;
  if (vendorHealthPermits(c).left > 0) return c;
  return moveTask(c, id, "todo", ctx, "system");
}

/**
 * Public Works & Safety's work orders for the plan as it stands: one per approved service, due
 * two days before the last session. `issue_permit` creates them; an amendment that takes effect
 * on a permitted case brings them in step (`syncWorkOrders()`).
 */
export function workOrdersFor(c: EventCase, ctx: RulesCtx): Task[] {
  const last = lastSessionDate(c);
  const due = last ? addDaysISO(last, -2) : ctx.today;
  const services = c.addOns.cityServices;
  const usesStreet = c.location?.mode === "streets" || c.location?.mode === "route";
  const orders: { key: string; title: string }[] = [];
  if (usesStreet || (services?.barricades ?? 0) > 0) orders.push({ key: "barricades", title: "Deliver barricades" });
  if ((services?.policeOfficers ?? 0) > 0 || c.addOns.alcohol) orders.push({ key: "police", title: "Staff police officers" });
  if (usesStreet) orders.push({ key: "closure", title: "Close the street" });
  if (services?.trash) orders.push({ key: "trash", title: "Arrange trash service" });
  if (services?.power) orders.push({ key: "power", title: "Arrange power" });
  return orders.map((o) =>
    newTask({ id: taskId(c.id, `work_order:${o.key}`), catalogId: `work_order:${o.key}`, owner: CITY_TASKS.work_order.owner, kind: CITY_TASKS.work_order.kind, title: o.title, dueDate: due, phase: "before_event" }, ctx, "system"),
  );
}

/**
 * Brings a permitted case's work orders in step with a plan that changed after the permit: a
 * service the amended plan adds gets its work order, and one it drops loses its work order
 * unless that is already done (what was delivered stays on the record). Nothing happens before
 * the permit: `issue_permit` creates them all then.
 */
export function syncWorkOrders(c: EventCase, ctx: RulesCtx): EventCase {
  if (!c.permit) return c;
  const wanted = workOrdersFor(c, ctx);
  const wantedIds = new Set(wanted.map((t) => t.id));
  const kept = c.tasks.filter((t) => !t.catalogId.startsWith("work_order:") || t.status === "done" || wantedIds.has(t.id));
  const missing = wanted.filter((t) => !kept.some((existing) => existing.id === t.id));
  return kept.length === c.tasks.length && missing.length === 0 ? c : addTasks({ ...c, tasks: kept }, missing);
}

/**
 * A plan with the applicant's "Download per-vendor food permits" card (a Special event with food
 * vendors) gives Health & Legal the task of issuing them, due when the applicant's card is. It
 * starts locked and opens once every vendor's health permit is verified, which may be now.
 */
export function withFoodPermitsTask(c: EventCase, ctx: RulesCtx): EventCase {
  const card = findTask(c, taskId(c.id, "vendor_food_permits"));
  const id = taskId(c.id, "issue_food_permits");
  if (!card || findTask(c, id)) return c;
  const spec = CITY_TASKS.issue_food_permits;
  const task = newTask({ id, catalogId: "issue_food_permits", owner: spec.owner, kind: spec.kind, title: spec.title, dueDate: card.dueDate, status: "locked", phase: "before_event" }, ctx, "system");
  return maybeUnlockIssueFoodPermits(addTask(c, task), ctx);
}

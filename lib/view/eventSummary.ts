/**
 * How an event's own answers read as plain text: its sessions, setup and teardown, and add-ons.
 * Shared by the case detail's Overview tab and the wizard's "Your event" recap, so a draft and
 * the case it becomes describe themselves the same way. Pure: answers in, strings out.
 */
import { fmtDate, fmtTime, plural } from "@/lib/format";
import type { EventAnswers } from "@/lib/types";

/** "Weekly, 13 sessions, Sun, Jun 6, 2027 to Sun, Aug 29, 2027", or null for a single event. */
export function seriesSummary(a: EventAnswers): string | null {
  if (!a.schedule?.recurrence) return null;
  const held = a.schedule.occurrences.filter((o) => o.billing !== "skipped");
  const count = held.length > 0 ? held.length : null;
  const freq = a.schedule.recurrence.frequency === "weekly" ? "Weekly" : "Biweekly";
  const countText = count !== null ? plural(count, "session") : "sessions";
  return `${freq}, ${countText}, ${fmtDate(a.schedule.date)} to ${fmtDate(a.schedule.recurrence.until)}`;
}

/** "8:00 AM to 6:00 PM", or null when neither setup nor teardown is set. */
export function setupTeardownText(a: EventAnswers): string | null {
  const sched = a.schedule;
  if (!sched || (!sched.setupStart && !sched.teardownEnd)) return null;
  const setup = sched.setupStart ? fmtTime(sched.setupStart) : "the start";
  const teardown = sched.teardownEnd ? fmtTime(sched.teardownEnd) : "the end";
  return `${setup} to ${teardown}`;
}

/** "Amplified sound · 3 food vendors", or null when no add-on is on. */
export function addOnsSummary(a: EventAnswers): string | null {
  const items: string[] = [];
  const addOns = a.addOns;
  if (addOns.amplifiedSound) items.push("Amplified sound");
  if (addOns.alcohol) items.push("Alcohol");
  if (addOns.foodVending) items.push(plural(addOns.foodVending.vendors, "food vendor"));
  if (addOns.tentsStages) items.push(plural(addOns.tentsStages.count, "tent or stage", "tents or stages"));
  if (addOns.cookingGenerators) items.push("Cooking or generators");
  if (addOns.fireworksDrones) items.push("Fireworks or drones");
  if (addOns.admission) items.push("Admission charged");
  if (addOns.cityServices) {
    const svc = addOns.cityServices;
    const parts: string[] = [];
    if (svc.barricades > 0) parts.push(plural(svc.barricades, "barricade"));
    if (svc.policeOfficers > 0 && svc.policeHours > 0) parts.push(`${svc.policeOfficers} officers × ${svc.policeHours}h`);
    if (svc.trash) parts.push("trash removal");
    if (svc.power) parts.push("power");
    items.push(`City services${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`);
  }
  return items.length > 0 ? items.join(" · ") : null;
}

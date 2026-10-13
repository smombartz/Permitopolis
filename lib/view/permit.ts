/**
 * Pure view-model shared by the permit page (`/events/[id]/permit`) and the public check
 * (`/verify/[id]`): whether a permit is valid and why not, and the session list a series
 * prints with its paid/due/upcoming/skipped marks. No React, no store. Tested against the
 * real seed in permit.test.ts.
 *
 * Owned by workstream 3D (components/permit, app/events/[id]/permit, app/verify/[id]).
 */
import { hasActivePermit } from "@/lib/state";
import { ENDING_LABEL, type EventCase, type ISODate, type Occurrence } from "@/lib/types";
import { routes } from "@/lib/routes";

export interface VerifyResult {
  valid: boolean;
  /** Why not: absent only when valid. */
  reason?: string;
}

/**
 * What an officer scanning the QR code sees (PRD: "a large Valid or Not valid, with the
 * reason: no such permit, cancelled, not yet issued, the event is over"). `c` is undefined for
 * an id with no case at all.
 */
export function verifyStatus(c: EventCase | undefined): VerifyResult {
  if (!c) return { valid: false, reason: "There's no permit with this ID." };
  if (hasActivePermit(c)) return { valid: true };
  if (c.permit === null) return { valid: false, reason: "This permit hasn't been issued yet." };
  if (c.ending === "cancelled") return { valid: false, reason: "This permit was cancelled." };
  if (c.state === "closed") return { valid: false, reason: "This event is over." };
  return { valid: false, reason: "This permit is no longer valid." };
}

export interface PermitPageInfo {
  ready: boolean;
  message?: string;
  href?: string;
  label?: string;
}

/**
 * Whether the permit page has a permit to show. "A case with no permit yet (or an ended one)
 * explains why and links to the board" (PRD); a closed case still shows its permit as a record.
 */
export function permitPageInfo(c: EventCase): PermitPageInfo {
  if (c.ending !== null) {
    return {
      ready: false,
      message: `This case is ${ENDING_LABEL[c.ending].toLowerCase()}, so there is no live permit.`,
      href: routes.event(c.id),
      label: "Back to your board",
    };
  }
  if (c.permit === null) {
    return {
      ready: false,
      message: "No permit has been issued for this event yet.",
      href: routes.event(c.id),
      label: "Back to your board",
    };
  }
  return { ready: true };
}

export interface SessionRow {
  date: ISODate;
  billing: Occurrence["billing"];
}

/**
 * Every session the permit covers, with its paid/due/upcoming/skipped mark. A single event's
 * one session is never marked by the clock (the booking or the quote paid for it), so once a
 * permit exists it always reads "paid".
 */
export function sessionRows(c: EventCase): SessionRow[] {
  if (!c.schedule) return [];
  if (!c.schedule.recurrence) return [{ date: c.schedule.date, billing: "paid" }];
  return c.schedule.occurrences.map((o) => ({ date: o.date, billing: o.billing }));
}

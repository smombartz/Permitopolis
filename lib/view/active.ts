/**
 * Pure view-model for Active permits (workstream 3G): which cases show on the list, how a
 * series' sessions collapse or expand, the calendar and map items, the Today strip's headline,
 * the Closeout tab's rows, and each city role's overlay (work orders for Public Works & Safety,
 * vendor permits for Health & Legal, the day-of contact and compliance log for the Clerk). No
 * React, no store: `ActiveScreen` reads `cases` and `demoToday` off the store and passes them
 * in. Tested against the real seed in `lib/view/active.test.ts`.
 */
import { addDaysISO, weekdayOf } from "@/lib/dates";
import { fmtDateShort, plural } from "@/lib/format";
import { citywideBlackoutOn } from "@/lib/rules";
import { CITY_STAFF_BY_DEPT } from "@/lib/data/people";
import { activePermits, eventDate, holdsDateAtQuote, isOpen, permitSessions, sessionDates, waitingOn } from "@/lib/state";
import { isHoldExpiringTomorrow } from "@/lib/view/caseDetail";
import { PARTY_LABEL, type Dept, type EventCase, type ISODate, type Location, type Party, type Tier } from "@/lib/types";

/* ---------- month/week navigation: string and integer math only, no new Date() ---------- */

/** The first of the month a date falls in, e.g. "2027-06-18" -> "2027-06-01". */
export function monthAnchorOf(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

/** `monthAnchor` moved by `delta` whole months, landing on the 1st. */
export function shiftMonth(monthAnchor: ISODate, delta: number): ISODate {
  const [y, m] = monthAnchor.slice(0, 7).split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** The Sunday on or before `date`. */
export function weekStartOf(date: ISODate): ISODate {
  return addDaysISO(date, -weekdayOf(date));
}

/** `weekStart` moved by `delta` whole weeks. */
export function shiftWeek(weekStart: ISODate, delta: number): ISODate {
  return addDaysISO(weekStart, delta * 7);
}

/** The inclusive range `MonthGrid` draws for this month: full weeks, Sunday to Saturday. */
export function monthGridRange(monthAnchor: ISODate): { from: ISODate; to: ISODate } {
  const lastDayOfMonth = addDaysISO(shiftMonth(monthAnchor, 1), -1);
  return { from: weekStartOf(monthAnchor), to: addDaysISO(weekStartOf(lastDayOfMonth), 6) };
}

/** The inclusive range `WeekGrid` draws: 7 days from `weekStart`. */
export function weekGridRange(weekStart: ISODate): { from: ISODate; to: ISODate } {
  return { from: weekStart, to: addDaysISO(weekStart, 6) };
}

/* ---------- the list ---------- */

export interface ActiveListRow {
  /** The case id, or `${caseId}:${date}` for one row of an expanded series. */
  key: string;
  case: EventCase;
  /** This row's date: the case's next session, or the one session it stands for when expanded. */
  date: ISODate;
  /** Quote sent and holding its date, shown as held rather than permitted. */
  isHeld: boolean;
  /** The hold expires tomorrow: flagged in the list, same test as on the case. */
  holdExpiresTomorrow: boolean;
  /** Further sessions this case has beyond this row, shown as "+N more". 0 once expanded. */
  moreCount: number;
}

export interface ActiveListOptions {
  /** Adds Quote sent cases holding a date, shown as held. */
  includeHolds?: boolean;
  /** One row per held session instead of the default one row per case. */
  expandSessions?: boolean;
}

/**
 * The Active permits list: every live permit, by event date, soonest first. Collapsed (the
 * default) is one row per case, its next session, with the rest counted as "+N more"; expanded
 * is one row per held session, via `permitSessions()`, which already carries that order.
 */
export function activeListRows(cases: EventCase[], today: ISODate, options: ActiveListOptions = {}): ActiveListRow[] {
  const { includeHolds = false, expandSessions = false } = options;

  if (expandSessions) {
    return permitSessions(cases, { includeHolds }).map((s) => ({
      key: `${s.case.id}:${s.date}`,
      case: s.case,
      date: s.date,
      isHeld: holdsDateAtQuote(s.case),
      holdExpiresTomorrow: isHoldExpiringTomorrow(s.case.dateHold, today),
      moreCount: 0,
    }));
  }

  const rows: ActiveListRow[] = [];
  for (const c of activePermits(cases, today, { includeHolds })) {
    const date = eventDate(c, today);
    if (date === null) continue;
    rows.push({
      key: c.id,
      case: c,
      date,
      isHeld: holdsDateAtQuote(c),
      holdExpiresTomorrow: isHoldExpiringTomorrow(c.dateHold, today),
      moreCount: Math.max(0, sessionDates(c).length - 1),
    });
  }
  return rows;
}

/* ---------- calendar ---------- */

export interface ActiveCalendarItem {
  id: string;
  date: ISODate;
  start?: string;
  end?: string;
  label: string;
  tier: Tier;
  status?: string;
  /** A meeting is drawn apart from the events (`components/calendar`'s `CalendarItem.kind`). */
  kind?: "event" | "meeting";
  /** A meeting's tooltip: what it is, which event it is for, who attends. */
  detail?: string;
}

/**
 * Every held session, unbounded: MonthGrid, WeekGrid and DayStrip each group these by date and
 * draw only the days in view, so one list serves all three. A series is never collapsed here.
 */
export function activeCalendarItems(cases: EventCase[], options: { includeHolds?: boolean } = {}): ActiveCalendarItem[] {
  return permitSessions(cases, { includeHolds: options.includeHolds }).map((s) => {
    const held = holdsDateAtQuote(s.case);
    return {
      id: `${s.case.id}:${s.date}`,
      date: s.date,
      start: s.case.schedule?.start,
      end: s.case.schedule?.end,
      label: held ? `${s.case.name} (held)` : s.case.name,
      tier: s.case.tier,
      status: held ? "held" : s.case.state,
    };
  });
}

/** "Mon, May 3: 1 event today" / "Mon, May 3: no events today". */
export function todayLine(cases: EventCase[], today: ISODate, options: { includeHolds?: boolean } = {}): string {
  const count = permitSessions(cases, { from: today, to: today, includeHolds: options.includeHolds }).length;
  const day = fmtDateShort(today);
  return count === 0 ? `${day}: no events today` : `${day}: ${plural(count, "event")} today`;
}

/* ---------- map ---------- */

export interface ActiveMapHighlight {
  id: string;
  location: Location;
  status: "held" | "permitted";
  tier: Tier;
  label: string;
}

/** What the map shows for one day: every held session that has a place, held or permitted. */
export function activeMapHighlights(cases: EventCase[], date: ISODate, options: { includeHolds?: boolean } = {}): ActiveMapHighlight[] {
  const highlights: ActiveMapHighlight[] = [];
  for (const s of permitSessions(cases, { from: date, to: date, includeHolds: options.includeHolds })) {
    if (!s.case.location) continue;
    highlights.push({
      id: `${s.case.id}:${s.date}`,
      location: s.case.location,
      status: holdsDateAtQuote(s.case) ? "held" : "permitted",
      tier: s.case.tier,
      label: s.case.name,
    });
  }
  return highlights;
}

/** The label of a citywide blackout on this date, if any ("Memorial Day: all parks..."). */
export function blackoutLabelOn(date: ISODate): string | null {
  return citywideBlackoutOn(date);
}

/* ---------- closeout ---------- */

export interface CloseoutRow {
  case: EventCase;
  /** The parties up now: who holds it. Empty is a bug the store should never produce. */
  holders: Party[];
  /** Every open task's title, across the parties holding it. */
  remainingSteps: string[];
}

/** Events still being reconciled, by event date, with who holds them and what is left. */
export function closeoutRows(cases: EventCase[], today: ISODate): CloseoutRow[] {
  const rows = cases
    .filter((c) => c.ending === null && c.state === "closeout")
    .map((c) => {
      const upNow = waitingOn(c, today).filter((p) => p.status === "up_now");
      return {
        case: c,
        holders: upNow.map((p) => p.party),
        remainingSteps: upNow.flatMap((p) => p.openTasks.map((t) => t.title)),
      };
    });
  return rows.sort((a, b) => (eventDate(a.case, today) ?? "").localeCompare(eventDate(b.case, today) ?? "") || a.case.id.localeCompare(b.case.id));
}

/* ---------- meetings and walkthroughs ---------- */

export interface MeetingItem {
  /** The task id: unique, and what opens the case (`?task=`, resolved the same way a Who's up row would). */
  id: string;
  caseId: string;
  date: ISODate;
  /** The meeting's own title: "Pre-application meeting", "Coordination meeting", "Site walkthrough". */
  label: string;
  eventName: string;
  /** The tier of the event the meeting is for. */
  tier: Tier;
  /** Who attends, applicant first: the parties the catalogue's own "why" names for this meeting. */
  attendees: Party[];
  /** The same parties by name, in that order: `meetingAttendees()`. */
  attendeeNames: string;
  held: boolean;
}

/** Who attends each kind of meeting (the catalogue's "why", as a list of parties). */
const MEETING_ATTENDEES: Record<string, Party[]> = {
  pre_application_meeting: ["applicant", "clerk", "pws", "hl"],
  coordination_meeting: ["applicant", "clerk", "pws"],
  site_walkthrough: ["applicant", "pws"],
};

/**
 * Who attends a meeting, by its card's catalogue id, as one line: "Applicant, City Clerk, Public
 * Works & Safety". The calendar's tooltip and the panel that schedules the meeting both print
 * this, so they cannot name different people.
 */
export function meetingAttendees(catalogId: string): string {
  return (MEETING_ATTENDEES[catalogId] ?? ["applicant"]).map((p) => PARTY_LABEL[p]).join(", ");
}

/**
 * Every meeting card with a scheduled date, on any open case: the pre-application meeting, the
 * coordination meeting and the site walkthrough, whether or not the card has unlocked yet (a
 * meeting is scheduled while its card is still locked, see "How the engine behaves"). This is
 * the PRD's "appears on all three calendars": one list, shown by every city role, drawn in the
 * calendar's own day cells by `meetingCalendarItems()`.
 */
export function meetingItems(cases: EventCase[], options: { from?: ISODate; to?: ISODate } = {}): MeetingItem[] {
  const items: MeetingItem[] = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    for (const t of c.tasks) {
      if (t.kind !== "meeting") continue;
      const date = t.payload.scheduledFor;
      if (!date) continue;
      if (options.from !== undefined && date < options.from) continue;
      if (options.to !== undefined && date > options.to) continue;
      items.push({
        id: t.id,
        caseId: c.id,
        date,
        label: t.title,
        eventName: c.name,
        tier: c.tier,
        attendees: MEETING_ATTENDEES[t.catalogId] ?? ["applicant"],
        attendeeNames: meetingAttendees(t.catalogId),
        held: t.status === "done",
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/**
 * The same meetings as items for the calendar grid and the day strip: each lands in its own
 * day's cell, as a meeting (an outlined item with a meeting icon, never a tier's color), naming
 * the event it is for. The id is the meeting card's, so a click opens its case like any item's.
 */
export function meetingCalendarItems(meetings: MeetingItem[]): ActiveCalendarItem[] {
  return meetings.map((m) => ({
    id: m.id,
    date: m.date,
    label: `${m.label}${m.held ? " (held)" : ""}: ${m.eventName}`,
    tier: m.tier,
    kind: "meeting" as const,
    detail: `Meeting: ${m.label}${m.held ? " (held)" : ""} · ${m.eventName} · ${m.attendeeNames}`,
  }));
}

/* ---------- role overlays ---------- */

const WORK_ORDER_PREFIX = "work_order:";

export interface PwsOverlay {
  workOrdersOpen: number;
  workOrdersDone: number;
  nextWorkOrderDue: ISODate | null;
  closuresScheduled: number;
  walkthroughsScheduled: number;
}

const EMPTY_PWS_OVERLAY: PwsOverlay = { workOrdersOpen: 0, workOrdersDone: 0, nextWorkOrderDue: null, closuresScheduled: 0, walkthroughsScheduled: 0 };

/** Public Works & Safety's row: its work orders on this case, closures and walkthroughs scheduled. */
export function pwsOverlayForCase(c: EventCase): PwsOverlay {
  const workOrders = c.tasks.filter((t) => t.catalogId.startsWith(WORK_ORDER_PREFIX));
  const open = workOrders.filter((t) => t.status !== "done");
  const nextWorkOrderDue = open
    .map((t) => t.dueDate)
    .filter((d): d is ISODate => d !== null)
    .sort()[0] ?? null;
  return {
    workOrdersOpen: open.length,
    workOrdersDone: workOrders.length - open.length,
    nextWorkOrderDue,
    closuresScheduled: workOrders.filter((t) => t.catalogId === "work_order:closure").length,
    walkthroughsScheduled: c.tasks.filter((t) => t.catalogId === "site_walkthrough" && t.payload.scheduledFor).length,
  };
}

function earliest(a: ISODate | null, b: ISODate | null): ISODate | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

/** The side panel's totals across every case currently shown. */
export function pwsOverlayTotal(cases: EventCase[]): PwsOverlay {
  return cases.reduce((total, c) => {
    const o = pwsOverlayForCase(c);
    return {
      workOrdersOpen: total.workOrdersOpen + o.workOrdersOpen,
      workOrdersDone: total.workOrdersDone + o.workOrdersDone,
      nextWorkOrderDue: earliest(total.nextWorkOrderDue, o.nextWorkOrderDue),
      closuresScheduled: total.closuresScheduled + o.closuresScheduled,
      walkthroughsScheduled: total.walkthroughsScheduled + o.walkthroughsScheduled,
    };
  }, EMPTY_PWS_OVERLAY);
}

export interface HlOverlay {
  vendorsVerified: number;
  vendorsTotal: number;
}

/** Health & Legal's row: this case's vendor health permits, and how many are verified. */
export function hlOverlayForCase(c: EventCase): HlOverlay {
  const vendorCards = c.tasks.filter((t) => t.catalogId === "vendor_health_permit");
  return { vendorsVerified: vendorCards.filter((t) => t.status === "done").length, vendorsTotal: vendorCards.length };
}

/** The side panel's totals across every case currently shown. */
export function hlOverlayTotal(cases: EventCase[]): HlOverlay {
  return cases.reduce(
    (total, c) => {
      const o = hlOverlayForCase(c);
      return { vendorsVerified: total.vendorsVerified + o.vendorsVerified, vendorsTotal: total.vendorsTotal + o.vendorsTotal };
    },
    { vendorsVerified: 0, vendorsTotal: 0 },
  );
}

export interface ClerkOverlay {
  contactName: string;
  contactPhone: string;
  /** A placeholder: the day-of compliance log has no entries recorded yet in this phase. */
  complianceLogCount: number;
}

/** The Clerk's overlay: who the day-of contact is, and the (empty, for now) compliance log. */
export function clerkOverlay(): ClerkOverlay {
  const staff = CITY_STAFF_BY_DEPT.clerk;
  return { contactName: staff.name, contactPhone: staff.phone, complianceLogCount: 0 };
}

export interface DayOfContactRow {
  caseId: string;
  eventName: string;
  contactName: string;
  contactPhone: string;
}

/**
 * The Clerk's day-of contact duty for one day: the events held that day, each with the
 * contact's name and phone (the same contact for every event, PRD "Day-of"). Only events with a
 * place to be reached at count: a quote sent case only holding its date is not "on" that day.
 */
export function dayOfContactRows(cases: EventCase[], date: ISODate): DayOfContactRow[] {
  const staff = CITY_STAFF_BY_DEPT.clerk;
  return permitSessions(cases, { from: date, to: date }).map((s) => ({
    caseId: s.case.id,
    eventName: s.case.name,
    contactName: staff.name,
    contactPhone: staff.phone,
  }));
}

export type RoleOverlay =
  | ({ role: "pws" } & PwsOverlay)
  | ({ role: "hl" } & HlOverlay)
  | ({ role: "clerk" } & ClerkOverlay);

/** This role's overlay for one row of the list. */
export function roleOverlayForCase(role: Dept, c: EventCase): RoleOverlay {
  if (role === "pws") return { role, ...pwsOverlayForCase(c) };
  if (role === "hl") return { role, ...hlOverlayForCase(c) };
  return { role, ...clerkOverlay() };
}

/** This role's overlay side panel, aggregated across every case currently shown. */
export function roleOverlayTotal(role: Dept, cases: EventCase[]): RoleOverlay {
  if (role === "pws") return { role, ...pwsOverlayTotal(cases) };
  if (role === "hl") return { role, ...hlOverlayTotal(cases) };
  return { role, ...clerkOverlay() };
}

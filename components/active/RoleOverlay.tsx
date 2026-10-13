import { DEPT_ICON, DueDate } from "@/components/domain";
import { Stat } from "@/components/ui/stat";
import { fmtDateShort, plural } from "@/lib/format";
import type { Dept, EventCase, ISODate } from "@/lib/types";
import { dayOfContactRows, roleOverlayForCase, roleOverlayTotal, type RoleOverlay as RoleOverlayData } from "@/lib/view/active";

/** The extra list column's header, one per city role (plan 3G: PRD "Role overlays"). */
export const ROLE_OVERLAY_COLUMN_LABEL: Record<Dept, string> = {
  clerk: "Compliance log",
  pws: "Work orders",
  hl: "Vendor permits",
};

function workOrderCellText(overlay: Extract<RoleOverlayData, { role: "pws" }>): string {
  if (overlay.workOrdersOpen === 0 && overlay.workOrdersDone === 0) return "No work orders yet";
  return `${overlay.workOrdersOpen} open, ${overlay.workOrdersDone} done`;
}

function vendorCellText(overlay: Extract<RoleOverlayData, { role: "hl" }>): string {
  if (overlay.vendorsTotal === 0) return "No vendor permits";
  return `${overlay.vendorsVerified} of ${plural(overlay.vendorsTotal, "vendor permit")} verified`;
}

/** This role's extra column for one list row (plan 3G: "shown as an extra column in the list"). */
export function RoleOverlayCell({ role, case: c, today }: { role: Dept; case: EventCase; today: ISODate }) {
  const overlay = roleOverlayForCase(role, c);
  if (overlay.role === "pws") {
    return (
      <div className="flex flex-col gap-0.5 text-xs text-fg-secondary">
        <span>{workOrderCellText(overlay)}</span>
        {overlay.nextWorkOrderDue ? <DueDate date={overlay.nextWorkOrderDue} today={today} relativeOnly className="text-xs" /> : null}
      </div>
    );
  }
  if (overlay.role === "hl") {
    return <span className="text-xs text-fg-secondary">{vendorCellText(overlay)}</span>;
  }
  // The Clerk's own overlay column is the compliance log; the day-of contact already has its
  // own column, shown to every role.
  return <span className="text-xs text-fg-secondary">{overlay.complianceLogCount === 0 ? "No log entries yet" : plural(overlay.complianceLogCount, "entry", "entries")}</span>;
}

/**
 * The role overlay's side panel for the Calendar and Map views, totaled across every case
 * currently shown (plan 3G: "a side panel on the other views"). `date`, when given, adds the
 * Clerk's day-of contact duty for that one day (5B: "for each day, the events for which the
 * Clerk is the day-of contact, with the contact's name and phone").
 */
export function RoleOverlaySidePanel({ role, cases, today, date }: { role: Dept; cases: EventCase[]; today: ISODate; date?: ISODate }) {
  const overlay = roleOverlayTotal(role, cases);
  const Icon = DEPT_ICON[role];
  const dutyRows = role === "clerk" && date !== undefined ? dayOfContactRows(cases, date) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon className="size-4 text-fg-label" aria-hidden="true" />
        {ROLE_OVERLAY_COLUMN_LABEL[role]}
      </div>

      {overlay.role === "pws" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Open" value={overlay.workOrdersOpen} />
            <Stat label="Done" value={overlay.workOrdersDone} />
          </div>
          {overlay.nextWorkOrderDue ? (
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Next due</p>
              <DueDate date={overlay.nextWorkOrderDue} today={today} />
            </div>
          ) : null}
          <p className="text-sm text-fg-secondary">
            {plural(overlay.closuresScheduled, "closure")} and {plural(overlay.walkthroughsScheduled, "walkthrough")} scheduled.
          </p>
        </div>
      ) : null}

      {overlay.role === "hl" ? (
        <div className="flex flex-col gap-4">
          <Stat label="Vendor permits verified" value={`${overlay.vendorsVerified} of ${overlay.vendorsTotal}`} />
        </div>
      ) : null}

      {overlay.role === "clerk" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Day-of contact</p>
            <p className="text-sm text-fg">{overlay.contactName}</p>
            <p className="font-mono text-[13px] text-fg-secondary">{overlay.contactPhone}</p>
          </div>
          {date !== undefined ? (
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Day-of contact duty, {fmtDateShort(date)}</p>
              {dutyRows.length === 0 ? (
                <p className="text-sm text-fg-secondary">No event that day.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {dutyRows.map((row) => (
                    <li key={row.caseId} className="text-sm text-fg-secondary">
                      {row.eventName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Compliance log</p>
            <p className="text-sm text-fg-secondary">{overlay.complianceLogCount === 0 ? "No log entries yet" : plural(overlay.complianceLogCount, "entry", "entries")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

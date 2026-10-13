/**
 * Pure view-model for the app shell: where a role switch lands, and what the
 * city sidebar's own-tools section offers. No React, no store: AppShell and
 * CityShell read the pieces of store state this needs and act on what it
 * returns. Covered by lib/view/shell.test.ts.
 *
 * Owned by workstream 2B (components/shell, lib/data/demoScript.ts).
 */
import { homeFor, routes } from "@/lib/routes";
import type { EventCase, Party } from "@/lib/types";

const EVENT_CASE_PATH = /^\/events\/([^/?]+)(?:\/.*)?$/;
const CITY_CASE_PATH = /^\/city\/cases\/([^/?]+)(?:\/.*)?$/;

/**
 * The case id on screen for `role`'s own case route (`/events/[id]...` for the
 * applicant, `/city/cases/[id]...` for a city role), or null off a case page.
 */
export function caseIdFromPath(pathname: string, role: Party): string | null {
  const pattern = role === "applicant" ? EVENT_CASE_PATH : CITY_CASE_PATH;
  // usePathname() never carries a query string, but strip one anyway: defensive against a
  // full href being passed in.
  const path = pathname.split("?")[0];
  return pattern.exec(path)?.[1] ?? null;
}

/** Where a case shows for a given role: the applicant's board, or the city's case detail. */
export function pathForCase(role: Party, caseId: string): string {
  return role === "applicant" ? routes.event(caseId) : routes.city.case(caseId);
}

export interface RoleSwitchArgs {
  fromRole: Party;
  toRole: Party;
  pathname: string;
  cases: EventCase[];
  lastPathByRole: Partial<Record<Party, string>>;
}

export interface RoleSwitchResult {
  path: string;
  /** Set only when the switch lands on a case and the destination is the Applicant. */
  personaId?: string;
}

/**
 * The PRD's role-switch rule: between two city roles the URL stays, so the presenter keeps
 * looking at the same case through another role's eyes. Between the Applicant and a city
 * role, a case on screen follows to the same case for the new role, and landing on the
 * Applicant also picks up that case's own persona. Off a case page (or the case no longer
 * exists), the switch goes to the role's last remembered path, then its home.
 */
export function resolveRoleSwitch({ fromRole, toRole, pathname, cases, lastPathByRole }: RoleSwitchArgs): RoleSwitchResult {
  if (fromRole === toRole) return { path: pathname };
  if (fromRole !== "applicant" && toRole !== "applicant") return { path: pathname };

  const caseId = caseIdFromPath(pathname, fromRole);
  const found = caseId ? cases.find((c) => c.id === caseId) : undefined;
  if (found) {
    const path = pathForCase(toRole, found.id);
    return toRole === "applicant" ? { path, personaId: found.applicantId } : { path };
  }

  return { path: lastPathByRole[toRole] ?? homeFor(toRole) };
}

export interface SidebarLink {
  label: string;
  href: string;
}

/** My queue, Cases, Active permits: every city role's shared sidebar links, in order. */
export const CITY_CORE_LINKS: SidebarLink[] = [
  { label: "My queue", href: routes.city.queue() },
  { label: "Cases", href: routes.city.cases() },
  { label: "Active permits", href: routes.city.active() },
];

const CITY_TOOL_LINKS: Record<Exclude<Party, "applicant">, SidebarLink[]> = {
  clerk: [
    { label: "Intake", href: routes.city.intake() },
    { label: "Payments", href: routes.city.payments() },
    { label: "Settings", href: routes.city.settings() },
  ],
  pws: [
    { label: "Closures and routes", href: routes.city.map() },
    { label: "Work orders", href: routes.city.workOrders() },
  ],
  hl: [
    { label: "Verifications", href: routes.city.verifications() },
    { label: "Inspections", href: routes.city.inspections() },
  ],
};

/** A city role's own tools, under the shared sidebar links. */
export function cityToolLinks(role: Exclude<Party, "applicant">): SidebarLink[] {
  return CITY_TOOL_LINKS[role];
}

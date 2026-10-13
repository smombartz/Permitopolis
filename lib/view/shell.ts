/**
 * Pure view-model for the app shell: where a role switch or a persona pick lands, and what
 * the city sidebar's own-tools section offers. No React, no store: AppShell and CityShell
 * read the pieces of store state this needs and act on what it returns. Covered by
 * lib/view/shell.test.ts.
 *
 * Owned by workstream 2B (components/shell, lib/data/demoScript.ts).
 */
import { homeFor, routes } from "@/lib/routes";
import { isVisibleToCity } from "@/lib/state/selectors";
import type { Dept, EventCase, Party } from "@/lib/types";

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

/**
 * The case an applicant's page is about, read off a full href: an event page or one of its
 * subpages, or the wizard reopened on a draft (`/apply?case=...`). Null for My events and
 * for a blank wizard.
 */
export function applicantCaseIdFromHref(href: string): string | null {
  const [path, query = ""] = href.split("?");
  const onEventPage = EVENT_CASE_PATH.exec(path)?.[1];
  if (onEventPage) return onEventPage;
  return path === routes.apply() ? new URLSearchParams(query).get("case") : null;
}

/** Where a case shows for a given role: the applicant's board, or the city's case detail. */
export function pathForCase(role: Party, caseId: string): string {
  return role === "applicant" ? routes.event(caseId) : routes.city.case(caseId);
}

export interface RoleSwitchArgs {
  fromRole: Party;
  toRole: Party;
  /** Where the presenter is now, as `usePathname()` gives it (no query string). */
  pathname: string;
  /** The page's query string, with or without its "?". Only read to find the wizard's draft. */
  search?: string;
  cases: EventCase[];
  /** Each role's last page in its own area, query string included. */
  lastPathByRole: Partial<Record<Party, string>>;
}

export interface RoleSwitchResult {
  path: string;
  /** Set only when the destination is the Applicant and the landing page is about a case. */
  personaId?: string;
}

/**
 * The PRD's role-switch rule: between two city roles the URL stays on a page they share (My
 * queue, Cases, a case, Active permits), so the presenter keeps looking at the same case
 * through another role's eyes. A role's own tool page (the Clerk's Intake, say) is not the
 * other role's: from there the switch goes to the new role's last page, then its queue.
 * Between the Applicant and a city role, a case on screen follows to the same case for the new
 * role. A Draft does not follow to the city: it is the applicant's alone until it is submitted
 * or booked. Off a case page (or when the case does not exist), the switch goes to the role's
 * last remembered page, query string included, then its home.
 *
 * A page opened under the wrong role (a typed-in or shared link: the Applicant on a city case,
 * a city role on a quote) shows its shell's "built for" panel. Switching from there to a role
 * the page is built for stays on the page, so the link opens what it was sent to open.
 *
 * Landing on the Applicant also sets the persona to the applicant of the case the landing
 * page is about, so the board never shows one organizer's event under another's name.
 */
export function resolveRoleSwitch({ fromRole, toRole, pathname, search = "", cases, lastPathByRole }: RoleSwitchArgs): RoleSwitchResult {
  if (fromRole === toRole) return { path: pathname };
  if (!pageIsFor(fromRole, pathname) && pageIsFor(toRole, pathname)) {
    if (toRole !== "applicant") return { path: pathname };
    const query = search.replace(/^\?/, "");
    const aboutId = applicantCaseIdFromHref(query ? `${pathname}?${query}` : pathname);
    const about = aboutId ? cases.find((c) => c.id === aboutId) : undefined;
    return about ? { path: pathname, personaId: about.applicantId } : { path: pathname };
  }
  if (fromRole !== "applicant" && toRole !== "applicant") {
    return cityPageIsFor(toRole, pathname) ? { path: pathname } : { path: rememberedCityPage(toRole, lastPathByRole) };
  }

  const caseId = caseIdFromPath(pathname, fromRole);
  const onScreen = caseId ? cases.find((c) => c.id === caseId) : undefined;
  if (onScreen) {
    if (toRole === "applicant") return { path: pathForCase(toRole, onScreen.id), personaId: onScreen.applicantId };
    if (isVisibleToCity(onScreen)) return { path: pathForCase(toRole, onScreen.id) };
  }

  if (toRole !== "applicant") return { path: rememberedCityPage(toRole, lastPathByRole) };
  const remembered = lastPathByRole[toRole];
  if (!remembered) return { path: homeFor(toRole) };

  const rememberedCaseId = applicantCaseIdFromHref(remembered);
  if (!rememberedCaseId) return { path: remembered };
  const owner = cases.find((c) => c.id === rememberedCaseId);
  return owner ? { path: remembered, personaId: owner.applicantId } : { path: homeFor(toRole) };
}

/**
 * Where picking a persona lands. Someone with no event yet starts the wizard ("New applicant
 * for a blank wizard run"). Someone whose only event is still a draft goes back into the wizard
 * where they left it (the PRD's S2: "Persona opens the wizard at step 3"). Everyone else gets
 * My events.
 */
export function pathForPersona(personaId: string, cases: EventCase[]): string {
  const own = cases.filter((c) => c.applicantId === personaId);
  if (own.length === 0) return routes.apply();
  const [only] = own;
  if (own.length === 1 && only.state === "draft" && only.ending === null) {
    return routes.apply({ caseId: only.id, step: only.wizardStep });
  }
  return routes.events();
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

/**
 * The role whose tool page this is (the PRD's route map: Intake, Payments and Settings are the
 * City Clerk's; the map and work orders are Public Works & Safety's; verifications and
 * inspections are Health & Legal's). Null for a page every city role shares, and for any page
 * outside the city area. Takes a pathname or a full href.
 */
export function cityToolOwner(href: string): Dept | null {
  const path = href.split("?")[0];
  for (const dept of ["clerk", "pws", "hl"] as const) {
    if (CITY_TOOL_LINKS[dept].some((link) => path === link.href || path.startsWith(`${link.href}/`))) return dept;
  }
  return null;
}

/** Whether a city page is one this role has: a shared page, or one of its own tools. */
export function cityPageIsFor(role: Party, href: string): boolean {
  const owner = cityToolOwner(href);
  return owner === null || owner === role;
}

/**
 * Whether a page is in this role's own area: the wizard and the event pages for the Applicant;
 * for a city role, a city page it shares or owns. The landing page, the demo guide and the
 * public check are nobody's.
 */
export function pageIsFor(role: Party, href: string): boolean {
  const path = href.split("?")[0];
  if (role === "applicant") return path === routes.apply() || path === routes.events() || path.startsWith(`${routes.events()}/`);
  return path.startsWith("/city/") && cityPageIsFor(role, path);
}

/** The city role's last page, when it is still one of its own; otherwise its queue. */
function rememberedCityPage(role: Party, lastPathByRole: Partial<Record<Party, string>>): string {
  const remembered = lastPathByRole[role];
  return remembered && cityPageIsFor(role, remembered) ? remembered : homeFor(role);
}

/**
 * Every link in the app is built here. Surfaces hand off to each other through
 * these routes and the store, never by importing each other's components.
 */
import type { CaseState, Party, Tier, WizardStep } from "@/lib/types";

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export type CaseTab = "overview" | "reviews" | "documents" | "conditions" | "activity";
export type ActiveView = "list" | "calendar" | "map" | "closeout";
export type CasesView = "board" | "table";

export interface CasesFilters {
  view?: CasesView;
  tier?: Tier;
  state?: CaseState | "off_path" | "closed";
  /** 'me', 'applicant' or another department. */
  waiting?: "me" | Party;
  from?: string;
  to?: string;
  /** '1' or '0'. */
  involves?: "1" | "0";
  q?: string;
}

export const routes = {
  home: () => "/",
  demo: () => "/demo",

  /** The wizard. `caseId` reopens a draft; without it the wizard starts a new one. */
  apply: (options: { caseId?: string; step?: WizardStep } = {}) =>
    withQuery("/apply", { case: options.caseId, step: options.step }),

  events: () => "/events",
  event: (id: string, options: { card?: string } = {}) => withQuery(`/events/${id}`, { card: options.card }),
  /** Quote for Reviewed and Special events; booking and payment for Instant. */
  quote: (id: string) => `/events/${id}/quote`,
  permit: (id: string) => `/events/${id}/permit`,
  amend: (id: string) => `/events/${id}/amend`,
  /** What an officer sees after scanning the permit's QR code. */
  verify: (id: string) => `/verify/${id}`,

  city: {
    queue: () => "/city/queue",
    cases: (filters: CasesFilters = {}) => withQuery("/city/cases", { ...filters }),
    case: (id: string, options: { task?: string; tab?: CaseTab } = {}) =>
      withQuery(`/city/cases/${id}`, { task: options.task, tab: options.tab }),
    active: (options: { view?: ActiveView; date?: string } = {}) =>
      withQuery("/city/active", { view: options.view, date: options.date }),
    intake: (options: { tab?: Tier } = {}) => withQuery("/city/intake", { tab: options.tab }),
    payments: () => "/city/payments",
    settings: () => "/city/settings",
    map: () => "/city/map",
    workOrders: () => "/city/work-orders",
    verifications: () => "/city/verifications",
    inspections: () => "/city/inspections",
  },

  dev: {
    kit: () => "/dev/kit",
    map: () => "/dev/map",
  },
} as const;

/** Where each role lands. */
export function homeFor(role: Party): string {
  return role === "applicant" ? routes.events() : routes.city.queue();
}

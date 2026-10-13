/**
 * Every route, for every role that can reach it, against the seed and inside its real shell:
 * one h1, a main landmark, no unnamed button, link or form control, no duplicate ids, and the
 * rest of what tests/render/a11yAudit.ts checks (heading order, labelled landmarks and tables,
 * ids that aria attributes point at, hidden or named images).
 *
 * A page with tabs is checked on each tab. The applicant's pages and the landing page are
 * checked a second time as a 375px phone renders them (the collapsed top bar, the board's tabs,
 * the compact stepper and fee table): the screens pick those with `useIsNarrow()`, so they are
 * different markup, not the same markup restyled.
 */
import type { ReactElement } from "react";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "@/app/not-found";
import { ActiveScreen } from "@/components/active/ActiveScreen";
import { BoardScreen } from "@/components/board/BoardScreen";
import { MyEventsScreen } from "@/components/board/MyEventsScreen";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { ClosuresMapScreen } from "@/components/city/closures/ClosuresMapScreen";
import { InspectionsScreen } from "@/components/city/inspections/InspectionsScreen";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";
import { QueueScreen } from "@/components/city/lists/QueueScreen";
import { PaymentsScreen } from "@/components/city/payments/PaymentsScreen";
import { SettingsScreen } from "@/components/city/settings/SettingsScreen";
import { VerificationsScreen } from "@/components/city/verifications/VerificationsScreen";
import { WorkOrdersScreen } from "@/components/city/workorders/WorkOrdersScreen";
import { KitScreen } from "@/components/kit/KitScreen";
import { DemoGuideScreen } from "@/components/landing/DemoGuideScreen";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { MapDevScreen } from "@/components/map/MapDevScreen";
import { PermitScreen } from "@/components/permit/PermitScreen";
import { VerifyScreen } from "@/components/permit/VerifyScreen";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { AmendWizardScreen } from "@/components/wizard/amend/AmendWizardScreen";
import { WizardScreen } from "@/components/wizard/WizardScreen";
import { PICKABLE_PERSONA_IDS } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import { buildSeed, isVisibleToCity } from "@/lib/state";
import { PARTY_LABEL, type Dept, type EventCase, type Party } from "@/lib/types";
import { WIZARD_STEPS } from "@/lib/view/wizard";
import { auditPage } from "./a11yAudit";
import { renderScreen, type RenderScreenOptions } from "./harness";

const SEED = buildSeed();
const CITY: Dept[] = ["clerk", "pws", "hl"];
const ALL: Party[] = ["applicant", ...CITY];

interface PageCase {
  name: string;
  ui: ReactElement;
  options: RenderScreenOptions;
  /** A developer's page, not part of the product: checked as it opens, without a pass over each tab. */
  dev?: boolean;
}

const applicant = (screen: ReactElement) => <AppShell>{screen}</AppShell>;
const city = (screen: ReactElement) => <CityShell>{screen}</CityShell>;
const asOwner = (c: EventCase, path: string): RenderScreenOptions => ({ role: "applicant", personaId: c.applicantId, path });

/** The pages with no shell: any role can be current when one opens. */
const PUBLIC_PAGES: PageCase[] = [
  ...ALL.flatMap((role): PageCase[] => [
    { name: `/ as ${PARTY_LABEL[role]}`, ui: <LandingScreen />, options: { role, path: routes.home() } },
    { name: `/demo as ${PARTY_LABEL[role]}`, ui: <DemoGuideScreen />, options: { role, path: routes.demo() } },
  ]),
  ...SEED.map((c): PageCase => ({ name: `/verify/${c.id} (${c.state}${c.ending ? `, ${c.ending}` : ""})`, ui: <VerifyScreen />, options: { path: routes.verify(c.id) } })),
  { name: "/verify for an unknown permit", ui: <VerifyScreen />, options: { path: routes.verify("PMT-27-9999") } },
  { name: "the 404 page", ui: <NotFound />, options: { path: "/nowhere" } },
];

/**
 * The two developer pages. The kit shows every component at once, three page headers among
 * them, so "one h1" is not asked of it; everything else is.
 */
const DEV_PAGES: PageCase[] = [
  { name: "/dev/kit", ui: <KitScreen />, options: { path: routes.dev.kit() }, dev: true },
  { name: "/dev/map", ui: <MapDevScreen />, options: { path: routes.dev.map() }, dev: true },
];

/** The applicant's pages: the wizard on every step, My events for every persona, and each seeded event's four pages as its owner. */
const APPLICANT_PAGES: PageCase[] = [
  { name: "/apply, a blank wizard", ui: applicant(<WizardScreen />), options: { role: "applicant", personaId: "new", path: routes.apply() } },
  ...WIZARD_STEPS.map((step): PageCase => ({ name: `/apply on "${step}" (S2's draft)`, ui: applicant(<WizardScreen />), options: { scenario: "S2", path: routes.apply({ caseId: "PMT-27-0142", step }) } })),
  ...PICKABLE_PERSONA_IDS.map((personaId): PageCase => ({ name: `/events as ${personaId}`, ui: applicant(<MyEventsScreen />), options: { role: "applicant", personaId, path: routes.events() } })),
  ...SEED.flatMap((c): PageCase[] => {
    const label = `${c.id} (${c.tier}, ${c.state}${c.ending ? `, ${c.ending}` : ""})`;
    return [
      { name: `/events/[id] for ${label}`, ui: applicant(<BoardScreen />), options: asOwner(c, routes.event(c.id)) },
      { name: `/events/[id]/quote for ${label}`, ui: applicant(<CheckoutScreen />), options: asOwner(c, routes.quote(c.id)) },
      { name: `/events/[id]/permit for ${label}`, ui: applicant(<PermitScreen />), options: asOwner(c, routes.permit(c.id)) },
      { name: `/events/[id]/amend for ${label}`, ui: applicant(<AmendWizardScreen />), options: asOwner(c, routes.amend(c.id)) },
    ];
  }),
  { name: "/events/[id] for an unknown event", ui: applicant(<BoardScreen />), options: { role: "applicant", personaId: "new", path: routes.event("PMT-27-9999") } },
  ...CITY.map((role): PageCase => ({ name: `/events as ${PARTY_LABEL[role]} (the switch panel)`, ui: applicant(<MyEventsScreen />), options: { role, path: routes.events() } })),
];

/** The pages the three city roles share, each role's own tools, and every seeded case for every role. */
const CITY_PAGES: PageCase[] = [
  ...CITY.flatMap((role): PageCase[] => [
    { name: `/city/queue as ${PARTY_LABEL[role]}`, ui: city(<QueueScreen />), options: { role, path: routes.city.queue() } },
    { name: `/city/cases (board) as ${PARTY_LABEL[role]}`, ui: city(<CasesScreen />), options: { role, path: routes.city.cases() } },
    { name: `/city/cases (table) as ${PARTY_LABEL[role]}`, ui: city(<CasesScreen />), options: { role, path: routes.city.cases({ view: "table" }) } },
    ...(["list", "calendar", "map", "closeout"] as const).map((view): PageCase => ({ name: `/city/active (${view}) as ${PARTY_LABEL[role]}`, ui: city(<ActiveScreen />), options: { role, path: routes.city.active({ view }) } })),
    ...SEED.map((c): PageCase => ({ name: `/city/cases/${c.id} (${c.state}${c.ending ? `, ${c.ending}` : ""}) as ${PARTY_LABEL[role]}`, ui: city(<CaseDetailScreen />), options: { role, path: routes.city.case(c.id) } })),
  ]),
  { name: "/city/intake", ui: city(<IntakeScreen />), options: { role: "clerk", path: routes.city.intake() } },
  { name: "/city/payments", ui: city(<PaymentsScreen />), options: { role: "clerk", path: routes.city.payments() } },
  { name: "/city/settings", ui: city(<SettingsScreen />), options: { role: "clerk", path: routes.city.settings() } },
  { name: "/city/map", ui: city(<ClosuresMapScreen />), options: { role: "pws", path: routes.city.map() } },
  { name: "/city/work-orders", ui: city(<WorkOrdersScreen />), options: { role: "pws", path: routes.city.workOrders() } },
  { name: "/city/verifications", ui: city(<VerificationsScreen />), options: { role: "hl", path: routes.city.verifications() } },
  { name: "/city/inspections", ui: city(<InspectionsScreen />), options: { role: "hl", path: routes.city.inspections() } },
  { name: "/city/cases/[id] for an unknown case", ui: city(<CaseDetailScreen />), options: { role: "clerk", path: routes.city.case("PMT-27-9999") } },
  { name: "/city/queue as the Applicant (the switch panel)", ui: city(<QueueScreen />), options: { role: "applicant", path: routes.city.queue() } },
  { name: "/city/intake as Health & Legal (another role's tool)", ui: city(<IntakeScreen />), options: { role: "hl", path: routes.city.intake() } },
];

/** `matchMedia` as a viewport `width` px wide would answer it. */
function setViewport(width: number): void {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = (max ? width <= Number(max[1]) : true) && (min ? width >= Number(min[1]) : true) && (max !== null || min !== null);
    return { matches, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() } as unknown as MediaQueryList;
  });
}

afterEach(() => {
  setViewport(1280);
});

/** The page as it opens, then each of its other tabs in turn: Radix mounts only the selected tab's panel. */
async function auditEveryTab(): Promise<string[]> {
  const problems = auditPage();
  const tabCount = document.querySelectorAll('[role="tab"]').length;
  for (let index = 0; index < tabCount; index++) {
    const tab = document.querySelectorAll<HTMLElement>('[role="tab"]')[index];
    if (!tab || tab.getAttribute("aria-selected") === "true" || tab.hasAttribute("disabled")) continue;
    const label = tab.textContent?.trim();
    await act(async () => {
      fireEvent.mouseDown(tab, { button: 0 });
      fireEvent.click(tab);
    });
    for (const problem of auditPage()) if (!problems.includes(problem)) problems.push(`[tab "${label}"] ${problem}`);
  }
  return problems;
}

describe.each([
  ["pages with no shell", PUBLIC_PAGES],
  ["the applicant's pages", APPLICANT_PAGES],
  ["the city's pages", CITY_PAGES],
])("accessibility of %s", (_group, pages) => {
  it.each(pages)("$name", async ({ ui, options }) => {
    await renderScreen(ui, options);
    expect(await auditEveryTab()).toEqual([]);
  });
});

describe("accessibility of the developer pages", () => {
  it.each(DEV_PAGES)("$name", async ({ name, ui, options }) => {
    await renderScreen(ui, options);
    const problems = auditPage().filter((problem) => name !== "/dev/kit" || !problem.startsWith("Expected one h1"));
    expect(problems).toEqual([]);
  }, 20_000);
});

describe("accessibility at 375px", () => {
  const phonePages = [...PUBLIC_PAGES.filter((page) => page.name.startsWith("/ as") || page.name.startsWith("/demo as") || page.name.startsWith("/verify")), ...APPLICANT_PAGES];

  it.each(phonePages)("$name", async ({ ui, options }) => {
    setViewport(375);
    await renderScreen(ui, options);
    expect(await auditEveryTab()).toEqual([]);
  });
});

describe("the route list above is the app's", () => {
  it("covers every case the city can see, for every city role", () => {
    expect(SEED.filter(isVisibleToCity).length).toBeGreaterThan(30);
    expect(CITY_PAGES.filter((page) => page.name.startsWith("/city/cases/PMT"))).toHaveLength(SEED.length * CITY.length);
  });
});

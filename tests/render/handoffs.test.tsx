/**
 * The hand-offs between the surfaces (Phase 3's seven, then Phase 4's role tools, then the
 * Phase 5 and 6 pages under "(j)" at the end). Each was built without sight of the others, so
 * each surface's own tests stop at "the router was pushed to X". These go one step further:
 * they mount the app the way the App Router does (the real layouts and pages from `app/`,
 * chosen by the mocked location), act on one surface, and then look at the surface that
 * renders at the URL the router received.
 *
 * `<App />` below is that small router. It remounts a page when the path changes and keeps a
 * layout mounted across the pages under it, as Next.js does; `renderApp()` is `renderScreen()`
 * with it.
 */
import type { ReactElement, ReactNode } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it } from "vitest";
import ApplyLayout from "@/app/apply/layout";
import ApplyPage from "@/app/apply/page";
import ActivePage from "@/app/city/active/page";
import CasePage from "@/app/city/cases/[id]/page";
import CasesPage from "@/app/city/cases/page";
import InspectionsPage from "@/app/city/inspections/page";
import IntakePage from "@/app/city/intake/page";
import CityLayout from "@/app/city/layout";
import MapPage from "@/app/city/map/page";
import PaymentsPage from "@/app/city/payments/page";
import QueuePage from "@/app/city/queue/page";
import SettingsPage from "@/app/city/settings/page";
import VerificationsPage from "@/app/city/verifications/page";
import WorkOrdersPage from "@/app/city/work-orders/page";
import DemoPage from "@/app/demo/page";
import AmendPage from "@/app/events/[id]/amend/page";
import BoardPage from "@/app/events/[id]/page";
import PermitPage from "@/app/events/[id]/permit/page";
import QuotePage from "@/app/events/[id]/quote/page";
import EventsLayout from "@/app/events/layout";
import EventsPage from "@/app/events/page";
import LandingPage from "@/app/page";
import VerifyPage from "@/app/verify/[id]/page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEMO_PATHS } from "@/lib/data/demoScript";
import { routes } from "@/lib/routes";
import { queueFor, useDemo } from "@/lib/state";
import { PARTY_LABEL, type Dept, type Party } from "@/lib/types";
import { queueWaitingOnOthers } from "@/lib/view/cityLists";
import { CITY_CORE_LINKS, cityToolLinks } from "@/lib/view/shell";
import { navState } from "./setup";
import { navigate, renderScreen, storedCase, switchUser, switchUserToRole, type RenderScreenOptions } from "./harness";

/* ------------------------------------------------------------------------ */
/* The app, by URL                                                          */
/* ------------------------------------------------------------------------ */

type Shell = "apply" | "events" | "city" | null;

const ROUTES: { pattern: RegExp; shell: Shell; page: () => ReactElement }[] = [
  { pattern: /^\/$/, shell: null, page: LandingPage },
  { pattern: /^\/demo$/, shell: null, page: DemoPage },
  { pattern: /^\/verify\/[^/]+$/, shell: null, page: VerifyPage },
  { pattern: /^\/apply$/, shell: "apply", page: ApplyPage },
  { pattern: /^\/events$/, shell: "events", page: EventsPage },
  { pattern: /^\/events\/[^/]+$/, shell: "events", page: BoardPage },
  { pattern: /^\/events\/[^/]+\/quote$/, shell: "events", page: QuotePage },
  { pattern: /^\/events\/[^/]+\/permit$/, shell: "events", page: PermitPage },
  { pattern: /^\/events\/[^/]+\/amend$/, shell: "events", page: AmendPage },
  { pattern: /^\/city\/queue$/, shell: "city", page: QueuePage },
  { pattern: /^\/city\/cases$/, shell: "city", page: CasesPage },
  { pattern: /^\/city\/cases\/[^/]+$/, shell: "city", page: CasePage },
  { pattern: /^\/city\/active$/, shell: "city", page: ActivePage },
  { pattern: /^\/city\/intake$/, shell: "city", page: IntakePage },
  { pattern: /^\/city\/payments$/, shell: "city", page: PaymentsPage },
  { pattern: /^\/city\/settings$/, shell: "city", page: SettingsPage },
  { pattern: /^\/city\/map$/, shell: "city", page: MapPage },
  { pattern: /^\/city\/work-orders$/, shell: "city", page: WorkOrdersPage },
  { pattern: /^\/city\/verifications$/, shell: "city", page: VerificationsPage },
  { pattern: /^\/city\/inspections$/, shell: "city", page: InspectionsPage },
];

/** None of the three layouts sits under a dynamic segment, so the App Router hands each no params. */
const NO_PARAMS = Promise.resolve({});

function withShell(shell: Shell, children: ReactNode): ReactElement {
  if (shell === "apply") return <ApplyLayout key="apply" params={NO_PARAMS}>{children}</ApplyLayout>;
  if (shell === "events") return <EventsLayout key="events" params={NO_PARAMS}>{children}</EventsLayout>;
  if (shell === "city") return <CityLayout key="city" params={NO_PARAMS}>{children}</CityLayout>;
  return <>{children}</>;
}

function App() {
  const pathname = usePathname();
  const route = ROUTES.find((r) => r.pattern.test(pathname));
  if (!route) throw new Error(`The app has no page at ${pathname}`);
  const Page = route.page;
  return <TooltipProvider>{withShell(route.shell, <Page key={pathname} />)}</TooltipProvider>;
}

function renderApp(options: RenderScreenOptions) {
  return renderScreen(<App />, options);
}

/** Where the app is now, query string included. */
function here(): string {
  const query = navState.search.toString();
  return query ? `${navState.pathname}?${query}` : navState.pathname;
}

/**
 * An open sheet or dialog is modal: it hides the page behind it from assistive technology, so
 * a query by role sees only the panel. These read the page itself, panel open or not.
 */
const BEHIND_A_PANEL = { hidden: true } as const;

/**
 * A real screen is on show: not a placeholder, not a shell's "built for another role" panel,
 * not "Case not found", and with its one `<h1>`.
 */
function expectRealScreen() {
  expect(screen.queryByText("This screen is being built")).not.toBeInTheDocument();
  expect(screen.queryByText(/This screen is built for/)).not.toBeInTheDocument();
  expect(screen.queryByText("Case not found")).not.toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1, ...BEHIND_A_PANEL })).toHaveLength(1);
}

function h1(): string {
  return screen.getByRole("heading", { level: 1, ...BEHIND_A_PANEL }).textContent ?? "";
}

/** The simulated card form holds the payment for 650 ms before it goes through. */
async function waitForPayment() {
  await new Promise((resolve) => setTimeout(resolve, 750));
}

/** The page's own back link, read past any panel open over it. */
function backLink(): HTMLElement {
  const link = document.querySelector<HTMLElement>('[data-slot="back-link"]');
  if (!link) throw new Error(`No back link on ${here()}`);
  return link;
}

type User = Awaited<ReturnType<typeof renderApp>>["user"];

/**
 * Closes the open sheet. A sheet is modal, so the header (the user menu included) is out
 * of reach until it is shut, and shutting it takes its param out of the URL.
 */
async function closePanel(user: User) {
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
}

function linkTo(href: string): HTMLElement {
  const link = screen.getAllByRole("link").find((a) => a.getAttribute("href") === href);
  if (!link) throw new Error(`No link to ${href} on ${here()}`);
  return link;
}

const S1 = "PMT-27-0109"; // Maya Chen's 40th birthday picnic: Instant, Permitted
const S2 = "PMT-27-0142"; // Sunrise Yoga Club weekly class: Instant series, a Draft
const S3 = "PMT-27-0118"; // Jazz in the Plaza: Reviewed, Needs info
const S4 = "PMT-27-0126"; // Maple Street block party: Reviewed, Submitted
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout
const F1 = "PMT-27-0121"; // Downtown Art Walk: Special, Submitted
const F7 = "PMT-27-0017"; // Brightline Logistics company picnic: Instant, a closeout exception
const TAI_CHI = "PMT-27-0034"; // Riverside Tai Chi Circle: Instant series, on Event day today
const CARNIVAL = "PMT-27-0042"; // Golden Years Senior Center spring carnival: Closed, $50 still owed
const DASH = "PMT-27-0040"; // Summit Ridge Running Club downtown dash: Closed, nothing owed

/* ------------------------------------------------------------------------ */
/* (a) and (b): the wizard's last step                                       */
/* ------------------------------------------------------------------------ */

describe("(a) the wizard's last step, for an Instant event", () => {
  it("goes to checkout in booking mode, which books it, and then the permit page shows the permit", async () => {
    const { user } = await renderApp({ scenario: "S2", path: routes.apply({ caseId: S2, step: "plan" }) });
    expect(h1()).toBe("Sunrise Yoga Club weekly class");

    await user.click(screen.getByRole("button", { name: "Book and pay $20" }));

    // Checkout, booking mode: the plan as a receipt, its fees, and the card form.
    expect(here()).toBe(routes.quote(S2));
    expectRealScreen();
    expect(screen.getByText("Book and pay")).toBeInTheDocument();
    expect(screen.getByText(/13 sessions starting/)).toBeInTheDocument();
    expect(storedCase(S2).state).toBe("draft");
    // The Draft has no board yet, so the way back is the wizard's plan step.
    expect(screen.getByRole("link", { name: "Back to your plan" })).toHaveAttribute("href", routes.apply({ caseId: S2, step: "plan" }));

    await user.click(screen.getByRole("button", { name: "Pay $20" }));
    await waitForPayment();

    // The permit page, with the permit the booking issued.
    expect(storedCase(S2).state).toBe("permitted");
    expect(here()).toBe(routes.permit(S2));
    expectRealScreen();
    expect(screen.getByText("Permitopolis event permit")).toBeInTheDocument();
    expect(screen.getByText(/13 sessions/)).toBeInTheDocument();
  });

  it("checkout's way back from booking is the wizard, where the plan can still change", async () => {
    const { user } = await renderApp({ scenario: "S2", path: routes.quote(S2) });

    await user.click(screen.getByRole("link", { name: "Back to your plan" }));

    expect(navState.pathname).toBe("/apply");
    expectRealScreen();
    expect(screen.getByRole("heading", { level: 2, name: "Your plan at a glance" })).toBeInTheDocument();
  });
});

describe("(b) the wizard's last step, for a Reviewed event", () => {
  it("creates the board, and the board shows its cards; My events and the menu know it is still a Draft", async () => {
    const { user } = await renderApp({ path: routes.apply(), personaId: "new" });

    // A picnic at Shelter 2 for 40 with alcohol: Reviewed, on a date well past its 30 days.
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Summer picnic");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /June 19th, 2027/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText(/Expected attendance/), "40");
    await user.click(screen.getByRole("switch", { name: "Alcohol" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const draft = useDemo.getState().cases.find((c) => c.applicantId === "new")!;
    expect(draft.tier).toBe("reviewed");
    expect(draft.tasks).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Create my to-do board" }));

    // The board, with the plan's cards in their columns.
    expect(here()).toBe(routes.event(draft.id));
    expectRealScreen();
    expect(h1()).toBe("Summer picnic");
    const created = storedCase(draft.id);
    expect(created.state).toBe("draft");
    expect(created.tasks.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Certificate of insurance/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit application/ })).toBeInTheDocument();
    const doNow = screen.getByRole("heading", { level: 3, name: "Do now" }).parentElement!;
    expect(within(doNow).getByText(/^\d+$/).textContent).not.toBe("0");

    // My events opens the board for it now, not the wizard it came out of.
    await user.click(screen.getByRole("link", { name: "Back to My events" }));
    expect(here()).toBe(routes.events());
    await user.click(screen.getByRole("link", { name: /Summer picnic/ }));
    expect(here()).toBe(routes.event(draft.id));

    // Still a Draft: the plan is changed in the wizard, and nothing is amended yet.
    await user.click(screen.getByRole("button", { name: "Board menu" }));
    expect(screen.queryByRole("menuitem", { name: "Amend" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit your plan" }));
    expect(navState.pathname).toBe("/apply");
    expect(navState.search.get("case")).toBe(draft.id);
    expectRealScreen();
    expect(screen.getByRole("button", { name: "Update my to-do board" })).toBeInTheDocument();
  }, 30_000);
});

/* ------------------------------------------------------------------------ */
/* (c): the board's sign-off and payment cards                               */
/* ------------------------------------------------------------------------ */

describe("(c) the board's sign-off and payment cards reach checkout in the right mode", () => {
  it("Accept conditions and sign, and Pay fees and deposit, both open the quote", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "riverfront-running-club", path: routes.event(S5) });

    await user.click(screen.getByRole("button", { name: /Accept conditions and sign/ }));
    expect(here()).toBe(routes.quote(S5));
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");
    expect(screen.getByRole("heading", { level: 2, name: "Conditions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept and sign" })).toBeInTheDocument();
    expect(screen.getByText("Sign first.")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to your board" }));
    expect(here()).toBe(routes.event(S5));

    await user.click(screen.getByRole("button", { name: /Pay fees and deposit/ }));
    expect(here()).toBe(routes.quote(S5));
    expect(screen.getByRole("button", { name: "Pay $6,530" })).toBeInTheDocument();
  });

  it("a series' payment card opens the session schedule, and a session's link pays that session", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "riverside-tai-chi-circle", path: routes.event(TAI_CHI) });
    const due = storedCase(TAI_CHI).schedule!.occurrences.find((o) => o.billing === "due")!.date;

    // An Instant event's payment card is "Pay and book": done at booking, and from then on the
    // way to the sessions still to pay.
    await user.click(screen.getByRole("button", { name: /Pay and book/ }));
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("heading", { name: "Session schedule" })).toBeInTheDocument();
    // Paid and skipped sessions have no link: the checkout would refuse them.
    const owed = storedCase(TAI_CHI).schedule!.occurrences.filter((o) => o.billing === "due" || o.billing === "upcoming");
    expect(sheet.getAllByRole("link", { name: /^Pay this session: / })).toHaveLength(owed.length);

    await user.click(sheet.getAllByRole("link", { name: /^Pay this session: / })[0]);

    // Checkout, session mode, for the session that is due today.
    expect(here()).toBe(routes.quote(TAI_CHI, { pay: "session", date: due }));
    expectRealScreen();
    expect(screen.getByText("Pay a session")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Pay \$/ }));
    await waitForPayment();

    // Paid, and back on the board it came from.
    expect(storedCase(TAI_CHI).schedule!.occurrences.find((o) => o.date === due)!.billing).toBe("paid");
    expect(here()).toBe(routes.event(TAI_CHI));
    expectRealScreen();
  });

  it("Final bill or refund opens the final bill, and paying it finishes the card", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "golden-years-senior-center", path: routes.event(CARNIVAL) });

    await user.click(screen.getByRole("button", { name: /Final bill or refund/ }));

    expect(here()).toBe(routes.quote(CARNIVAL, { pay: "final" }));
    expectRealScreen();
    expect(screen.getByText("Final bill")).toBeInTheDocument();
    // Estimated against actual: one table per department, each with its Actual column.
    expect(screen.getAllByRole("columnheader", { name: "Actual" }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Pay $50" }));
    await waitForPayment();

    expect(storedCase(CARNIVAL).tasks.find((t) => t.catalogId === "final_bill_or_refund")!.status).toBe("done");
    expect(here()).toBe(routes.event(CARNIVAL));
    expectRealScreen();
  });
});

/* ------------------------------------------------------------------------ */
/* (d): the permit, and the public check                                     */
/* ------------------------------------------------------------------------ */

describe("(d) the ways to the permit, and from it to the public check", () => {
  it("Carry your permit opens the permit on the day", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "riverside-tai-chi-circle", path: routes.event(TAI_CHI) });

    await user.click(screen.getByRole("button", { name: /Carry your permit/ }));

    expect(here()).toBe(routes.permit(TAI_CHI));
    expectRealScreen();
    expect(screen.getByText("Permitopolis event permit")).toBeInTheDocument();
  });

  it("My events and the board both link to the permit; its link opens the check, which reads Valid", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "maya-chen", path: routes.events() });

    await user.click(screen.getByRole("link", { name: /View permit/ }));
    expect(here()).toBe(routes.permit(S1));
    expectRealScreen();
    expect(screen.getByText("Scan to verify this permit")).toBeInTheDocument();

    // The permit goes back to the board, and the board back to the permit.
    await user.click(screen.getByRole("link", { name: "Back to your board" }));
    expect(here()).toBe(routes.event(S1));
    await user.click(screen.getByRole("link", { name: /View permit/ }));
    expect(here()).toBe(routes.permit(S1));

    // What the QR code opens.
    await user.click(screen.getByRole("link", { name: "Open the verification page" }));
    expect(here()).toBe(routes.verify(S1));
    expectRealScreen();
    expect(h1()).toBe("Valid");
    expect(screen.getByText("Maya Chen's 40th birthday picnic")).toBeInTheDocument();
    expect(screen.getByText(/Shelter 3/)).toBeInTheDocument();
  });

  it("a board with no live permit offers no link to one", async () => {
    await renderApp({ role: "applicant", personaId: "riverfront-running-club", path: routes.event(S5) });
    expect(screen.queryByRole("link", { name: /View permit/ })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ */
/* (e): the city lists, into a case                                          */
/* ------------------------------------------------------------------------ */

describe("(e) the city lists open the case", () => {
  it.each(["clerk", "pws", "hl"] as const)("every row of %s's queue opens the case with that task's panel open", async (role: Dept) => {
    const { user } = await renderApp({ role, path: routes.city.queue() });
    const rows = queueFor(useDemo.getState().cases, role, useDemo.getState().demoToday);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const href = routes.city.case(row.case.id, { task: row.task.id, from: routes.city.queue() });
      await user.click(linkTo(href));

      expect(here(), row.task.id).toBe(href);
      expectRealScreen();
      expect(h1()).toBe(row.case.name);
      // The task's own panel, in the sheet, with its heading.
      const panel = within(screen.getByRole("dialog"));
      expect(panel.getAllByRole("heading").length, row.task.id).toBeGreaterThan(0);
      expect(backLink()).toHaveTextContent("Back to My queue");
      expect(backLink()).toHaveAttribute("href", routes.city.queue());

      navigate(routes.city.queue());
    }
  }, 30_000);

  it("the Clerk's intake check opens Accept as complete, and a reviewer's insurance check opens Verify", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.queue() });

    await user.click(linkTo(routes.city.case(F1, { task: `${F1}:intake_check`, from: routes.city.queue() })));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Accept as complete" })).toBeInTheDocument();

    // Back to the queue it came from.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("link", { name: "Back to My queue" }));
    expect(here()).toBe(routes.city.queue());
    expectRealScreen();
  });

  it("a queue row acted on from its panel changes the case", async () => {
    const { user } = await renderApp({ role: "hl", path: routes.city.queue() });

    await user.click(linkTo(routes.city.case(S5, { task: `${S5}:verify:insurance_certificate`, from: routes.city.queue() })));
    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Verify" }));

    expect(storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate")!.status).toBe("done");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a case the role is waiting on others for opens from the queue too, with no panel", async () => {
    const { user } = await renderApp({ role: "pws", path: routes.city.queue() });
    const [waiting] = queueWaitingOnOthers(useDemo.getState().cases, "pws", useDemo.getState().demoToday);
    expect(waiting).toBeDefined();

    await user.click(screen.getByText(/^Waiting on others/));
    await user.click(linkTo(routes.city.case(waiting.case.id, { from: routes.city.queue() })));

    expect(navState.pathname).toBe(`/city/cases/${waiting.case.id}`);
    expectRealScreen();
    expect(h1()).toBe(waiting.case.name);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(backLink()).toHaveTextContent("Back to My queue");
  });

  it("a Who's up task on the case opens its panel the same way", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.case(S4) });

    // S4 waits on the applicant's sign-offs: from the Clerk's side that is a reminder to send.
    await user.click(screen.getByRole("button", { name: /Neighbor sign-off/ }));

    expect(navState.search.get("task")).toBe(`${S4}:neighbor_signoff`);
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Send a reminder" })).toBeInTheDocument();
  });

  it("a param that names no task and no action leaves the sheet shut", async () => {
    await renderApp({ role: "clerk", path: routes.city.case(S5, { task: `${S5}:no_such_task` }) });
    expectRealScreen();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a pipeline card opens the case, and the case comes back to the pipeline as it was", async () => {
    const pipeline = routes.city.cases({ tier: "special" });
    const { user } = await renderApp({ role: "clerk", path: pipeline });

    await user.click(screen.getByText("Riverfront Summer 5K"));

    expect(navState.pathname).toBe(`/city/cases/${S5}`);
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to cases" }));
    expect(here()).toBe(pipeline);
    expectRealScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Cases pipeline" })).toBeInTheDocument();
  });

  it("a pipeline table row opens the case, and Back returns to the table", async () => {
    const table = routes.city.cases({ view: "table" });
    const { user } = await renderApp({ role: "clerk", path: table });

    await user.click(screen.getByRole("link", { name: /^Jazz in the Plaza/ }));
    expect(navState.pathname).toBe(`/city/cases/${S3}`);
    expectRealScreen();

    await user.click(screen.getByRole("link", { name: "Back to cases" }));
    expect(here()).toBe(table);
    expect(screen.getByRole("columnheader", { name: "Next action" })).toBeInTheDocument();
  });

  it("an Intake row opens the case; Request information opens that panel; an exception opens Reconcile and close", async () => {
    const intake = routes.city.intake();
    const { user } = await renderApp({ role: "clerk", path: intake });

    // The row's event name is the link to the case.
    await user.click(linkTo(routes.city.case(F1, { from: intake })));
    expectRealScreen();
    expect(h1()).toBe("Downtown Art Walk");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to Intake" }));
    expect(here()).toBe(intake);

    // Request information goes to the case with that panel, not the intake task's Accept panel.
    const row = within(screen.getByText("Downtown Art Walk").closest("tr")!);
    await user.click(row.getByRole("link", { name: /^Request information: / }));
    expect(navState.pathname).toBe(`/city/cases/${F1}`);
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Request information" })).toBeInTheDocument();

    // The Instant exceptions tab: its task opens the action that settles it.
    const exceptions = `${intake}?tab=instant`;
    navigate(exceptions);
    await user.click(linkTo(routes.city.case(F7, { task: `${F7}:instant_exception`, from: exceptions })));
    expectRealScreen();
    expect(h1()).toBe("Brightline Logistics company picnic");
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Reconcile and close" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ */
/* (f): Active permits, into a case                                          */
/* ------------------------------------------------------------------------ */

describe("(f) Active permits opens the case", () => {
  it("a list row opens the case, and the case comes back to the list", async () => {
    const { user } = await renderApp({ role: "pws", path: routes.city.active() });

    // A row names its case as a link, and ends in a chevron that opens the same case.
    const title = screen.getByRole("link", { name: /^Maya Chen's 40th birthday picnic/ });
    expect(screen.getByRole("link", { name: "Open Maya Chen's 40th birthday picnic" })).toHaveAttribute("href", title.getAttribute("href"));
    await user.click(title);

    expect(navState.pathname).toBe(`/city/cases/${S1}`);
    expectRealScreen();
    expect(h1()).toBe("Maya Chen's 40th birthday picnic");

    await user.click(screen.getByRole("link", { name: "Back to Active permits" }));
    expect(here()).toBe(routes.city.active());
    expectRealScreen();
  });

  it("a calendar item opens the case, and the case comes back to that month", async () => {
    const calendar = routes.city.active({ view: "calendar", date: "2027-05-22" });
    const { user } = await renderApp({ role: "clerk", path: calendar });

    await user.click(screen.getAllByRole("button", { name: /Maya Chen's 40th birthday picnic/ })[0]);

    expect(navState.pathname).toBe(`/city/cases/${S1}`);
    expectRealScreen();
    expect(h1()).toBe("Maya Chen's 40th birthday picnic");

    await user.click(screen.getByRole("link", { name: "Back to Active permits" }));
    expect(here()).toBe(calendar);
    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
  });

  it("today's event on the day strip opens the case", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.active() });

    const strip = within(screen.getByRole("list", { name: "Today and the next 7 days" }));
    await user.click(strip.getAllByRole("button", { name: /Tai Chi/ })[0]);

    expect(navState.pathname).toBe(`/city/cases/${TAI_CHI}`);
    expectRealScreen();
  });

  it("a booking on the map opens the case, and the case comes back to that day's map", async () => {
    // Jul 11, with held dates on: the 5K's route is held for that day.
    const map = `${routes.city.active({ view: "map", date: "2027-07-11" })}&holds=1`;
    const { user } = await renderApp({ role: "pws", path: map });

    const bookings = within(screen.getByRole("list", { name: "Highlighted bookings and closures" }));
    await user.click(bookings.getByRole("button", { name: /Riverfront Summer 5K/ }));

    expect(navState.pathname).toBe(`/city/cases/${S5}`);
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");

    await user.click(screen.getByRole("link", { name: "Back to Active permits" }));
    expect(here()).toBe(map);
    expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("switch", { name: "Include held dates" })).toBeChecked();
  });

  it("a Closeout row opens the case", async () => {
    const closeout = routes.city.active({ view: "closeout" });
    const { user } = await renderApp({ role: "pws", path: closeout });

    await user.click(screen.getByRole("link", { name: /^Main Street Food Truck Festival/ }));

    expect(navState.pathname).toBe(`/city/cases/${S6}`);
    expectRealScreen();
    expect(screen.getByRole("link", { name: "Back to Active permits" })).toHaveAttribute("href", closeout);
  });
});

/* ------------------------------------------------------------------------ */
/* (g): the landing page's doors and the demo guide                          */
/* ------------------------------------------------------------------------ */

describe("(g) the landing page's two doors and the demo guide's paths land on real screens", () => {
  it("Plan an event opens a blank wizard, as the Applicant", async () => {
    const { user } = await renderApp({ path: routes.home(), role: "clerk" });

    await user.click(screen.getAllByRole("link", { name: /Plan an event/ })[0]);

    expect(here()).toBe(routes.apply());
    expect(useDemo.getState().role).toBe("applicant");
    expectRealScreen();
    expect(h1()).toBe("New event");
    expect(screen.getByRole("radio", { name: /^Picnic or party/ })).toBeInTheDocument();
  });

  it("Plan an event is the wizard for somebody who already has an event too, not My events", async () => {
    const { user } = await renderApp({ path: routes.home(), personaId: "maya-chen" });

    await user.click(screen.getAllByRole("link", { name: /Plan an event/ })[0]);

    expect(here()).toBe(routes.apply());
    expect(useDemo.getState().personaId).toBe("maya-chen");
    expectRealScreen();
  });

  it("City staff opens My queue as the City Clerk", async () => {
    const { user } = await renderApp({ path: routes.home() });

    await user.click(screen.getAllByRole("link", { name: "City staff" })[0]);

    expect(here()).toBe(routes.city.queue());
    expect(useDemo.getState().role).toBe("clerk");
    expectRealScreen();
    expect(h1()).toMatch(/need you|needs you/);
  });

  it("City staff opens My queue for a city role that is already current, instead of doing nothing", async () => {
    const { user } = await renderApp({ path: routes.home(), role: "hl" });

    await user.click(screen.getAllByRole("link", { name: "City staff" })[0]);

    expect(here()).toBe(routes.city.queue());
    expect(useDemo.getState().role).toBe("hl");
    expectRealScreen();
  });

  it("the footer's staff door opens the workspace too", async () => {
    const { user } = await renderApp({ path: routes.home() });

    await user.click(screen.getByRole("link", { name: "Open the staff workspace" }));

    expect(here()).toBe(routes.city.queue());
    expectRealScreen();
  });

  it.each(DEMO_PATHS.map((p) => [p.id, p.title] as const))("demo path %i, %s: Start this path lands on a real screen", async (id, title) => {
    const { user } = await renderApp({ path: routes.demo() });

    const card = screen.getByRole("heading", { name: title }).closest('[data-slot="panel"]') as HTMLElement;
    await user.click(within(card).getByRole("button", { name: /^Start this path: / }));

    expect(navState.pathname, `path ${id}`).not.toBe(routes.demo());
    expectRealScreen();
    // The page is the role's own: the user menu agrees with the area the path opened in.
    const role = useDemo.getState().role;
    expect(navState.pathname.startsWith("/city")).toBe(role !== "applicant");
  });

  it("the landing page and the Demo menu both open the guide, and the guide goes back to the landing page", async () => {
    const { user } = await renderApp({ path: routes.home() });

    await user.click(screen.getByRole("link", { name: /demo guide/i }));
    expect(here()).toBe(routes.demo());
    expectRealScreen();
    expect(h1()).toBe("Presenting Permitopolis");

    await user.click(screen.getByRole("link", { name: "Back to Permitopolis" }));
    expect(here()).toBe(routes.home());
    expectRealScreen();

    // From inside the app: the Demo menu's own link.
    navigate(routes.events());
    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Demo guide" }));
    expect(here()).toBe(routes.demo());
    expectRealScreen();
  });

  it("the guide's scenario table jumps to real screens as well", async () => {
    const { user } = await renderApp({ path: routes.demo() });
    const count = screen.getAllByRole("button", { name: /^Jump to / }).length;
    expect(count).toBe(6);

    for (let i = 0; i < count; i++) {
      await user.click(screen.getAllByRole("button", { name: /^Jump to / })[i]);
      expect(navState.pathname).not.toBe(routes.demo());
      expectRealScreen();
      navigate(routes.demo());
    }
  });
});

/* ------------------------------------------------------------------------ */
/* Demo paths 3 to 6, clicked through every surface they cross               */
/* ------------------------------------------------------------------------ */

/** The open sheet's own button, apart from a button of the same name on the page behind it. */
function panelButton(name: string | RegExp): HTMLElement {
  return within(screen.getByRole("dialog")).getByRole("button", { name });
}

describe("the demo paths that cross surfaces have a control for every step", () => {
  it("path 3: the applicant answers, Health & Legal verifies and approves, the Clerk quotes, the applicant signs and pays, the Clerk issues", async () => {
    const { user } = await renderApp({ scenario: "S3" });
    expect(here()).toBe(routes.event(S3));

    // The applicant, on the board: the pinned card, the sample file, send.
    await user.click(screen.getByRole("button", { name: /Health permit: Rolling Dumpling Co\./ }));
    await user.click(panelButton("Use sample file"));
    await user.click(panelButton("Reply and attach"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCase(S3).state).toBe("in_review");
    // The three days Health & Legal waited for this answer are given back: due Thu, May 6.
    expect(screen.getByText("0 days with Health & Legal · expected by Thu, May 6")).toBeInTheDocument();

    // Health & Legal: the switch follows the case. Its queue has the review back, and the row
    // opens the decision; the answer itself is verified on the Documents tab first.
    await switchTo(user, "hl");
    expect(here()).toBe(routes.city.case(S3));
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    const review = queueFor(useDemo.getState().cases, "hl", useDemo.getState().demoToday).find((row) => row.case.id === S3)!;
    // The row's parts agree: why it is back, since when, due when, and where the clock stands.
    const reviewRow = within(linkTo(routes.city.case(S3, { task: review.task.id, from: routes.city.queue() })));
    expect(reviewRow.getByText("Answer received May 3")).toBeInTheDocument();
    expect(reviewRow.getByText("0 days waiting")).toBeInTheDocument();
    expect(reviewRow.getByText(/Thu, May 6/)).toBeInTheDocument();
    expect(reviewRow.getByText(/Day 11 of 14 · paused 3 days/)).toBeInTheDocument();
    expect(reviewRow.queryByText(/Due today|Routed May 3|14 days waiting/)).not.toBeInTheDocument();
    await user.click(linkTo(routes.city.case(S3, { task: review.task.id, from: routes.city.queue() })));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Decide your review" })).toBeInTheDocument();
    await user.click(panelButton("Cancel"));

    await user.click(screen.getByRole("tab", { name: "Documents" }));
    await user.click(within(screen.getByTestId(`document-card-${S3}:vendor_health_permit:1`)).getByRole("button", { name: /^Verify / }));
    await user.click(panelButton("Verify"));
    expect(storedCase(S3).tasks.find((t) => t.id === `${S3}:vendor_health_permit:1`)!.status).toBe("done");

    // The Reviews tab's own button; "Your actions" beside it has the same one.
    await user.click(screen.getByRole("tab", { name: "Reviews" }));
    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    await user.click(panelButton("Approve"));
    expect(storedCase(S3).reviews.find((r) => r.dept === "hl")!.status).toBe("approved");

    // The Clerk, on the same page: Public Works & Safety's conditions carry over into the $715 quote.
    await switchTo(user, "clerk");
    expect(navState.pathname).toBe(`/city/cases/${S3}`);
    await user.click(screen.getByRole("button", { name: "Send quote" }));
    await user.click(panelButton("Send quote"));
    expect(storedCase(S3).state).toBe("quote_sent");
    expect(storedCase(S3).feeLines.reduce((sum, line) => sum + line.estimate, 0)).toBe(715);

    // The applicant again: the board's card opens the quote; accept, sign, pay.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S3));
    expect(useDemo.getState().personaId).toBe("downtown-arts-collective");
    await user.click(screen.getByRole("button", { name: /Accept conditions and sign/ }));
    expect(here()).toBe(routes.quote(S3));
    for (const box of screen.getAllByRole("checkbox", { name: /^I accept:/ })) await user.click(box);
    await user.type(screen.getByLabelText(/Type your full legal name/), "Dana Whitfield");
    await user.click(screen.getByRole("checkbox", { name: /I have read and accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept and sign" }));
    expect(storedCase(S3).flags.signed).toBe(true);
    await user.click(screen.getByRole("button", { name: "Pay $715" }));
    await waitForPayment();
    expect(screen.getByText("Paid. The City Clerk will issue your permit.")).toBeInTheDocument();

    // The Clerk issues the permit, and Active permits lists it.
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.case(S3));
    // "Your actions" has the button; Who's up lists the same task.
    await user.click(within(screen.getByRole("complementary", { name: "Your actions" })).getByRole("button", { name: "Issue permit" }));
    await user.click(panelButton("Issue permit"));
    expect(storedCase(S3).state).toBe("permitted");

    await user.click(screen.getByRole("link", { name: "Active permits" }));
    expectRealScreen();
    expect(screen.getByRole("link", { name: /^Jazz in the Plaza/ })).toBeInTheDocument();

    // The applicant comes back to the page they left, the quote. It has nothing left to pay,
    // says so, and points at the permit.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.quote(S3));
    expectRealScreen();
    expect(screen.getByText("This event already has its permit.")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "View permit" }));
    expect(here()).toBe(routes.permit(S3));
    expectRealScreen();
    expect(screen.getByText("Permitopolis event permit")).toBeInTheDocument();
  }, 30_000);

  it("path 4: three sign-offs, the Clerk accepts from Intake and routes from the case, and Public Works & Safety's queue has the block party", async () => {
    const { user } = await renderApp({ scenario: "S4" });
    expect(here()).toBe(routes.event(S4));
    // Submitted Apr 13: 20 days at intake, the figure the Clerk's Intake row has two clicks on.
    expect(screen.getByText("20 days at intake with the City Clerk, then Health & Legal · no expected date yet")).toBeInTheDocument();

    // The block captain: the last three neighbors.
    await user.click(screen.getByRole("button", { name: /Neighbor sign-off/ }));
    for (let i = 0; i < 3; i++) await user.click(panelButton(/Simulate a sign-off/));
    expect(storedCase(S4).tasks.find((t) => t.catalogId === "neighbor_signoff")!.status).toBe("done");
    await closePanel(user);

    // The Clerk: the switch follows the case, but Accept is on Intake's own row too.
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.case(S4));
    await user.click(screen.getByRole("link", { name: "Intake" }));
    await user.click(screen.getByRole("tab", { name: /^Reviewed/ }));
    const row = within(screen.getByText("Maple Street block party").closest("tr")!);
    expect(row.getByText("20 days")).toBeInTheDocument();
    await user.click(row.getByRole("button", { name: /^Accept as complete: / }));
    expect(storedCase(S4).dateHold.status).toBe("held");

    // Routing is the Clerk's next step, and accepting goes straight on to it: the case, with
    // its date now held and Confirm routing open, and Intake to go back to.
    expect(here()).toBe(routes.city.case(S4, { task: "confirm_routing", from: `${routes.city.intake()}?tab=reviewed` }));
    expectRealScreen();
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Confirm routing" })).toBeInTheDocument();
    // The same step is in My queue too, for a Clerk who comes back to it later.
    const routing = queueFor(useDemo.getState().cases, "clerk", useDemo.getState().demoToday).find((r) => r.case.id === S4)!;
    expect(routing.task.catalogId).toBe("confirm_routing");
    await user.click(panelButton("Confirm routing"));
    expect(storedCase(S4).state).toBe("in_review");
    expect(screen.getByText("Date held")).toBeInTheDocument();

    // Public Works & Safety: the case is in its queue.
    await switchTo(user, "pws");
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    expectRealScreen();
    expect(queueFor(useDemo.getState().cases, "pws", useDemo.getState().demoToday).some((r) => r.case.id === S4)).toBe(true);
    expect(screen.getByText("Maple Street block party")).toBeInTheDocument();
    const queueRow = within(screen.getByText("Maple Street block party").closest("a")!);
    expect(queueRow.getByText("0 days waiting")).toBeInTheDocument();

    // The block captain again: each card says the same of the department that has it since today.
    await user.click(queueRow.getByText("Maple Street block party"));
    await closePanel(user);
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S4));
    expect(screen.getByText("0 days with Public Works & Safety · expected by Mon, May 17")).toBeInTheDocument();
    expect(screen.getByText("0 days with Health & Legal · expected by Mon, May 17")).toBeInTheDocument();
  }, 30_000);

  it("path 5: the Clerk sees two parties up and why Issue permit waits, Health & Legal verifies from its queue, the applicant signs and pays, the Clerk issues, Public Works & Safety has its work orders and the route on its map, and a new plaza event that day is warned", async () => {
    const { user } = await renderApp({ scenario: "S5" });
    expect(here()).toBe(routes.city.case(S5));
    expectRealScreen();

    // The Clerk: Who's up has two parties up, the applicant and Health & Legal, and Issue
    // permit is off with the three things it waits for.
    const whoIsUp = screen.getByRole("list", { name: "Who's up" });
    const upNow = [...whoIsUp.querySelectorAll('[data-status="up_now"]')].map((row) => row.getAttribute("data-party"));
    expect(upNow).toEqual(["applicant", "hl"]);
    const clerkActions = within(screen.getByRole("complementary", { name: "Your actions" }));
    expect(clerkActions.getByRole("button", { name: "Issue permit" })).toBeDisabled();
    expect(clerkActions.getByText("Needs: signature (applicant), payment (applicant), insurance (Health & Legal)")).toBeInTheDocument();

    // What the applicant is told about the same card: who has it and by when. The date is the
    // one on Health & Legal's own task (tests/both-sides.test.ts holds that for every case).
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S5));
    expect(useDemo.getState().personaId).toBe("riverfront-running-club");
    expect(screen.getByText("1 card with Health & Legal, expected by Fri, May 7")).toBeInTheDocument();

    // Health & Legal: the switch follows the case; its queue has the certificate, due that
    // same Friday, and the row opens the check itself.
    await switchTo(user, "hl");
    expect(here()).toBe(routes.city.case(S5));
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    expectRealScreen();
    const verify = queueFor(useDemo.getState().cases, "hl", useDemo.getState().demoToday).find((row) => row.case.id === S5)!;
    expect([verify.task.catalogId, verify.task.dueDate]).toEqual(["verify:insurance_certificate", "2027-05-07"]);
    await user.click(linkTo(routes.city.case(S5, { task: verify.task.id, from: routes.city.queue() })));
    expectRealScreen();
    const check = within(screen.getByRole("dialog"));
    expect(check.getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    expect(check.getAllByText("Passes")).toHaveLength(4);
    await user.click(panelButton("Verify"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate")!.status).toBe("done");
    // The case, back from the queue: the Documents tab has it as verified.
    await user.click(screen.getByRole("tab", { name: "Documents" }));
    expect(within(screen.getByTestId(`document-card-${S5}:insurance_certificate`)).getByText("Verified")).toBeInTheDocument();
    expect(backLink()).toHaveAttribute("href", routes.city.queue());

    // The applicant: nothing is with the city any more; sign and pay $6,530.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S5));
    expect(screen.queryByText(/with Health & Legal/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Accept conditions and sign/ }));
    expect(here()).toBe(routes.quote(S5));
    for (const box of screen.getAllByRole("checkbox", { name: /^I accept:/ })) await user.click(box);
    await user.type(screen.getByLabelText(/Type your full legal name/), "Simone Dubois");
    await user.click(screen.getByRole("checkbox", { name: /I have read and accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept and sign" }));
    expect(storedCase(S5).flags.signed).toBe(true);
    await user.click(screen.getByRole("button", { name: "Pay $6,530" }));
    await waitForPayment();
    expect(screen.getByText("Paid. The City Clerk will issue your permit.")).toBeInTheDocument();

    // The Clerk: the checklist is all done, and issuing goes through.
    await switchTo(user, "clerk");
    expect(navState.pathname).toBe(`/city/cases/${S5}`);
    await user.click(within(screen.getByRole("complementary", { name: "Your actions" })).getByRole("button", { name: "Issue permit" }));
    expect(within(screen.getByRole("dialog")).getByText("Everything this needs is in place.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByText("Done")).toHaveLength(3);
    await user.click(panelButton("Issue permit"));
    expect(storedCase(S5).state).toBe("permitted");

    // Public Works & Safety: its queue has the three work orders, and one opens with its detail.
    await switchTo(user, "pws");
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    expectRealScreen();
    const orders = queueFor(useDemo.getState().cases, "pws", useDemo.getState().demoToday).filter((row) => row.case.id === S5);
    expect(orders.map((row) => row.task.title)).toEqual(["Deliver barricades", "Staff police officers", "Close the street"]);
    await user.click(linkTo(routes.city.case(S5, { task: orders[0].task.id, from: routes.city.queue() })));
    expectRealScreen();
    const order = within(screen.getByRole("dialog"));
    expect(order.getByRole("heading", { name: "Deliver barricades" })).toBeInTheDocument();
    expect(order.getByText("40 barricades")).toBeInTheDocument();
    expect(order.getByRole("button", { name: "Mark done" })).toBeEnabled();
    await closePanel(user);

    // ...and the route is on its map for Jul 11: a permit now, with no "held dates" needed.
    await user.click(screen.getByRole("link", { name: "Active permits" }));
    await user.click(screen.getByRole("tab", { name: "Map" }));
    fireEvent.change(screen.getByLabelText("Go to a date"), { target: { value: "2027-07-11" } });
    expect(here()).toBe(routes.city.active({ view: "map", date: "2027-07-11" }));
    expectRealScreen();
    const bookings = within(screen.getByRole("list", { name: "Highlighted bookings and closures" }));
    expect(bookings.getByRole("button", { name: /Riverfront Summer 5K/ })).toBeInTheDocument();

    // A new applicant starting a City Hall Plaza event on Jul 11 is warned, not blocked.
    await switchUser(user, "New applicant");
    expect(here()).toBe("/apply");
    expectRealScreen();
    await user.click(screen.getByRole("radio", { name: /^Market or festival/ }));
    await user.type(screen.getByLabelText(/Event name/), "Plaza brass band");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.clear(screen.getByLabelText("Width (ft)"));
    await user.type(screen.getByLabelText("Width (ft)"), "80");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /July 11th, 2027/ }));
    expect(screen.getAllByText("Impacted").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Riverfront Summer 5K closes Main Street 6 to 11:30 am that day/).length).toBeGreaterThan(0);
  }, 60_000);

  it("path 6: Public Works & Safety logs the closeout from its queue, the Clerk reconciles $750 over and refunds $250, and the applicant's board shows the refund, takes feedback and books again for Sat, Apr 22, 2028", async () => {
    const { user } = await renderApp({ scenario: "S6" });
    expect(here()).toBe(routes.city.case(S6));
    expectRealScreen();

    // The applicant's board, before anyone acts, says who has the case.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S6));
    expect(useDemo.getState().personaId).toBe("main-street-business-alliance");
    expect(screen.getByText("Public Works & Safety is checking cleanup; the City Clerk then reconciles costs.")).toBeInTheDocument();

    // Public Works & Safety: the queue's cleanup row opens the closeout log.
    await switchTo(user, "pws");
    expect(here()).toBe(routes.city.case(S6));
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    const cleanup = queueFor(useDemo.getState().cases, "pws", useDemo.getState().demoToday).find((row) => row.case.id === S6)!;
    expect(cleanup.task.catalogId).toBe("cleanup_inspection");
    await user.click(linkTo(routes.city.case(S6, { task: cleanup.task.id, from: routes.city.queue() })));
    expectRealScreen();
    const log = within(screen.getByRole("dialog"));
    expect(log.getByRole("heading", { name: "Log closeout" })).toBeInTheDocument();
    expect(log.getByRole("radio", { name: "Pass" })).toBeChecked();
    const police = log.getByRole("spinbutton", { name: "Actual: Police" });
    await user.clear(police);
    await user.type(police, "72");
    await user.type(log.getByRole("spinbutton", { name: /Cleanup crew hours/ }), "4");
    expect(log.getByText("$750 over")).toBeInTheDocument();
    await user.click(panelButton("Log closeout"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCase(S6).closeout.hoursLoggedOn).toBe("2027-05-03");

    // The applicant again: the line has moved on with the case.
    await switchTo(user, "applicant");
    expect(screen.getByText("Public Works & Safety logged the cleanup; the City Clerk is reconciling costs.")).toBeInTheDocument();

    // The Clerk: the reconcile task is in its queue, and its panel reads $750 over, $250 back.
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.case(S6));
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    const reconcile = queueFor(useDemo.getState().cases, "clerk", useDemo.getState().demoToday).find((row) => row.case.id === S6)!;
    expect(reconcile.task.catalogId).toBe("reconcile");
    await user.click(linkTo(routes.city.case(S6, { task: reconcile.task.id, from: routes.city.queue() })));
    expectRealScreen();
    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByRole("heading", { name: "Reconcile and close" })).toBeInTheDocument();
    expect(panel.getByText("Over estimate").nextElementSibling).toHaveTextContent("$750");
    expect(panel.getByText("Refund").nextElementSibling).toHaveTextContent("$250");
    await user.click(panelButton("Reconcile and close"));
    expect(storedCase(S6)).toMatchObject({ state: "closed", closeout: { balance: 750, refund: 250 } });
    // Closed: it has left Active permits' Closeout tab.
    await user.click(screen.getByRole("link", { name: "Active permits" }));
    await user.click(screen.getByRole("tab", { name: /^Closeout/ }));
    expectRealScreen();
    expect(screen.queryByRole("link", { name: /^Main Street Food Truck Festival/ })).not.toBeInTheDocument();

    // The applicant: the board shows the refund in the Clerk's figures, the feedback form and
    // "Book again next year".
    // Off a case, the switch goes back to the applicant's last page: this event's board.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S6));
    expectRealScreen();
    expect(screen.queryByText(/reconciling costs/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Final bill or refund/ }));
    const bill = within(screen.getByRole("dialog"));
    expect(bill.getByText("Your event ran $750 over the estimate, kept from your $1,000 deposit; $250 was refunded.")).toBeInTheDocument();
    expect(bill.getAllByRole("columnheader", { name: "Actual" }).length).toBeGreaterThan(0);
    expect(bill.queryByRole("link", { name: "Pay the final bill" })).not.toBeInTheDocument();
    await closePanel(user);

    await user.click(screen.getByRole("button", { name: /Tell us how it went/ }));
    await user.click(within(screen.getByRole("dialog")).getAllByRole("radio")[4]);
    await user.click(panelButton("Send feedback"));
    expect(storedCase(S6).closeout.feedback).toMatchObject({ rating: 5 });

    await user.click(screen.getByRole("button", { name: /Book again next year/ }));
    expect(within(screen.getByRole("dialog")).getByText(/drafted for Sat, Apr 22, 2028/)).toBeInTheDocument();
    await user.click(panelButton("Book again next year"));
    const draft = useDemo.getState().cases.find((c) => c.clonedFrom === S6)!;
    expect(draft).toMatchObject({ state: "draft", applicantId: "main-street-business-alliance", schedule: { date: "2028-04-22" } });
    expect(navState.pathname).toBe("/apply");
    expect(navState.search.get("case")).toBe(draft.id);
    expectRealScreen();
    expect(h1()).toBe("Main Street Food Truck Festival");
    // The last screen of the path: the plan for Apr 22, 2028, with who reviews what. Twenty-five
    // vendors' permits read as one thing Health & Legal checks, never the catalogue's "{vendor}".
    expect(navState.search.get("step")).toBe("plan");
    expect(screen.getAllByText("Health & Legal checks your certificate of insurance, vendor list, vendor health permits and accessibility plan.").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\{vendor\}/);
    expect(document.body.textContent).not.toMatch(/checks your[^.]*(Submit application|Pay fees and deposit|Coordination meeting)/);
  }, 60_000);
});

/* ------------------------------------------------------------------------ */
/* (h): Book again next year                                                 */
/* ------------------------------------------------------------------------ */

describe("(h) Book again next year", () => {
  it("lands in the wizard on the new draft", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "summit-ridge-running-club", path: routes.event(DASH) });
    const before = useDemo.getState().cases.length;

    await user.click(screen.getByRole("button", { name: /Book again next year/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Book again next year" }));

    const cases = useDemo.getState().cases;
    expect(cases).toHaveLength(before + 1);
    const draft = cases.find((c) => c.clonedFrom === DASH)!;
    expect(draft.state).toBe("draft");
    expect(draft.applicantId).toBe("summit-ridge-running-club");

    expect(navState.pathname).toBe("/apply");
    expect(navState.search.get("case")).toBe(draft.id);
    expectRealScreen();
    expect(h1()).toBe(draft.name);
    // The wizard, on the new draft's own answers: next year's date, a year on.
    expect(draft.schedule!.date.startsWith("2028-")).toBe(true);
    expect(screen.getByRole("button", { name: "Save and finish later" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ */
/* (i): switching role                                                       */
/* ------------------------------------------------------------------------ */

const CITY_ROLES: Dept[] = ["clerk", "pws", "hl"];

/** Through the header's user menu. To the Applicant, it picks the applicant that switch lands as. */
async function switchTo(user: User, role: Party) {
  await switchUserToRole(user, role);
  expect(useDemo.getState().role).toBe(role);
}

describe("(i) every role switch lands on a real screen", () => {
  const SHARED_CITY_PAGES: [name: string, path: string][] = [
    ["My queue", routes.city.queue()],
    ["Cases, as a board", routes.city.cases()],
    ["Cases, as a filtered table", routes.city.cases({ view: "table", tier: "special" })],
    ["a case", routes.city.case(S5)],
    ["a case on one of its tabs, opened from a list", routes.city.case(S5, { tab: "reviews", from: routes.city.cases({ tier: "special" }) })],
    ["a case nobody has routed yet", routes.city.case(S4)],
    ["a case in closeout", routes.city.case(S6)],
    ["Active permits", routes.city.active()],
    ["Active permits, calendar", routes.city.active({ view: "calendar", date: "2027-06-07" })],
    ["Active permits, map", routes.city.active({ view: "map", date: "2027-07-11" })],
    ["Active permits, closeout", routes.city.active({ view: "closeout" })],
  ];

  it.each(SHARED_CITY_PAGES)("%s keeps its URL through all three city roles", async (_name, path) => {
    const { user } = await renderApp({ role: "clerk", path });
    expectRealScreen();

    for (const role of ["pws", "hl", "clerk"] as const) {
      await switchTo(user, role);
      expect(here()).toBe(path);
      expectRealScreen();
    }
  });

  it("a case with a panel open: the panel is closed first, and the case and its tab stay through all three roles", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.case(S5, { tab: "reviews", task: "add_note" }) });
    expectRealScreen();
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Add a note" })).toBeInTheDocument();

    await closePanel(user);
    const onTheTab = routes.city.case(S5, { tab: "reviews" });
    expect(here()).toBe(onTheTab);

    for (const role of ["pws", "hl", "clerk"] as const) {
      await switchTo(user, role);
      expect(here()).toBe(onTheTab);
      expectRealScreen();
      expect(screen.getByRole("tab", { name: "Reviews" })).toHaveAttribute("aria-selected", "true");
    }
  });

  it.each(CITY_ROLES)("a link to a case with a panel open opens that panel for %s", async (role) => {
    await renderApp({ role, path: routes.city.case(S5, { tab: "reviews", task: "add_note" }) });
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Add a note" })).toBeInTheDocument();
  });

  it("a city role's own tool page sends another city role to its queue", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.intake() });
    expectRealScreen();

    await switchTo(user, "pws");
    expect(here()).toBe(routes.city.queue());
    expectRealScreen();

    // My queue is a page the two share, so the switch back keeps it (the rule in lib/view/shell.ts).
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.queue());
    expectRealScreen();

    // Intake is still the Clerk's last page of its own: from the Applicant's side it comes back.
    await user.click(screen.getByRole("link", { name: "Intake" }));
    // The last applicant used is New applicant, with no page to come back to: a blank wizard.
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.apply());
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.intake());
    expectRealScreen();
  });

  const APPLICANT_CASE_PAGES: [name: string, persona: string, path: string, caseId: string][] = [
    ["the board (S3)", "downtown-arts-collective", routes.event(S3), S3],
    ["the board (S4)", "maple-street-block-captain", routes.event(S4), S4],
    ["the board with a card open", "downtown-arts-collective", routes.event(S3, { card: `${S3}:vendor_health_permit:1` }), S3],
    ["the quote (S5)", "riverfront-running-club", routes.quote(S5), S5],
    ["a quote that is not ready (S3)", "downtown-arts-collective", routes.quote(S3), S3],
    ["the permit (S1)", "maya-chen", routes.permit(S1), S1],
    ["the board of a closed event", "golden-years-senior-center", routes.event(CARNIVAL), CARNIVAL],
  ];

  it.each(APPLICANT_CASE_PAGES)("from %s, each city role lands on that case, and the way back is its board", async (_name, personaId, path, caseId) => {
    for (const role of CITY_ROLES) {
      const { user, unmount } = await renderApp({ role: "applicant", personaId, path });
      expectRealScreen();
      const name = storedCase(caseId).name;
      // A card's sheet is closed before the user menu can be reached.
      if (screen.queryByRole("dialog")) await closePanel(user);

      await switchTo(user, role);
      expect(here()).toBe(routes.city.case(caseId));
      expectRealScreen();
      expect(h1()).toBe(name);

      await switchTo(user, "applicant");
      expect(here()).toBe(routes.event(caseId));
      expectRealScreen();
      expect(h1()).toBe(name);
      expect(useDemo.getState().personaId).toBe(personaId);
      unmount();
    }
  });

  it("from a case, the Applicant lands on its board as that case's own applicant, whoever was picked before", async () => {
    const { user } = await renderApp({ role: "hl", personaId: "maya-chen", path: routes.city.case(S6, { tab: "documents" }) });

    await switchTo(user, "applicant");

    expect(here()).toBe(routes.event(S6));
    expect(useDemo.getState().personaId).toBe("main-street-business-alliance");
    expectRealScreen();
    expect(h1()).toBe("Main Street Food Truck Festival");
  });

  it("a Draft does not follow to the city: the switch goes to the role's queue, and comes back to the wizard", async () => {
    const wizard = routes.apply({ caseId: S2, step: "when" });
    const { user } = await renderApp({ scenario: "S2" });
    expect(here()).toBe(wizard);
    expectRealScreen();

    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.queue());
    expectRealScreen();

    await switchTo(user, "applicant");
    expect(here()).toBe(wizard);
    expectRealScreen();
    expect(h1()).toBe("Sunrise Yoga Club weekly class");
  });

  it("off a case, each side lands on the other's home or last page", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "maya-chen", path: routes.events() });
    expectRealScreen();

    await switchTo(user, "pws");
    expect(here()).toBe(routes.city.queue());
    expectRealScreen();

    await user.click(screen.getByRole("link", { name: "Active permits" }));
    expect(here()).toBe(routes.city.active());
    expectRealScreen();

    await switchTo(user, "applicant");
    expect(here()).toBe(routes.events());
    expectRealScreen();
    expect(h1()).toBe("My events");

    // Public Works & Safety comes back to the page it left.
    await switchTo(user, "pws");
    expect(here()).toBe(routes.city.active());
    expectRealScreen();
  });

  it("a page opened under the wrong role offers the switch, and the switch lands on a real screen", async () => {
    const { user } = await renderApp({ role: "applicant", personaId: "maya-chen", path: routes.city.case(S5) });
    expect(screen.getByText("This screen is built for a city role.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to Health & Legal" }));

    expect(here()).toBe(routes.city.case(S5));
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");
  });
});

/* ------------------------------------------------------------------------ */
/* (j) Phases 5 and 6: each role's tool pages, the coach, the palette,       */
/*     Settings, and demo path 7                                             */
/* ------------------------------------------------------------------------ */

const ULTRA = "PMT-27-0030"; // Four Bridges Ultra: Special, Permitted, three open work orders
const PARISH = "PMT-27-0012"; // St. Agnes Parish's festival: In review, food vendors, May 13

/** Each role's own tools, as the city tabs name them, and the `<h1>` the page opens with. */
const TOOL_PAGES: [role: Dept, label: string, href: string, title: string][] = [
  ["clerk", "Intake", routes.city.intake(), "Intake queue"],
  ["clerk", "Payments", routes.city.payments(), "Payments"],
  ["clerk", "Settings", routes.city.settings(), "Settings"],
  ["pws", "Closures and routes", routes.city.map(), "Closures and routes"],
  ["pws", "Work orders", routes.city.workOrders(), "Work orders"],
  ["hl", "Verifications", routes.city.verifications(), "Verifications"],
  ["hl", "Inspections", routes.city.inspections(), "Inspections"],
];

describe("(j) no page is a placeholder any more: every tool link reaches a built page, for the role it belongs to", () => {
  it("the city tabs offer each role exactly its own tools", () => {
    for (const role of CITY_ROLES) {
      expect(cityToolLinks(role).map((link) => [link.label, link.href])).toEqual(TOOL_PAGES.filter(([owner]) => owner === role).map(([, label, href]) => [label, href]));
    }
  });

  it.each(TOOL_PAGES)("%s: the city tabs' %s link opens the page", async (role, label, href, title) => {
    const { user } = await renderApp({ role, path: routes.city.queue() });
    const tabs = within(screen.getByRole("navigation", { name: "City" }));

    await user.click(tabs.getByRole("link", { name: label }));

    expect(here()).toBe(href);
    expectRealScreen();
    expect(h1()).toBe(title);
    expect(tabs.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });

  it.each(TOOL_PAGES)("%s's %s, typed in by another city role, offers the switch and then opens", async (role, _label, href, title) => {
    const other = CITY_ROLES.find((r) => r !== role)!;
    const { user } = await renderApp({ role: other, path: href });
    expect(screen.getByText(`This screen is built for ${role === "clerk" ? "the City Clerk" : PARTY_LABEL[role]}.`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Switch to ${PARTY_LABEL[role]}` }));

    expect(here()).toBe(href);
    expectRealScreen();
    expect(h1()).toBe(title);
  });

  it("the amendment page is the wizard reopened on the record, for the applicant", async () => {
    await renderApp({ scenario: "S1", path: routes.amend(S1) });
    expectRealScreen();
    expect(h1()).toBe("Maya Chen's 40th birthday picnic");
    expect(screen.getByText("Change your event")).toBeInTheDocument();
  });
});

describe("(j) every new list opens the case, and the case comes back to that list as it was", () => {
  it("Payments: a row opens the case, Record payment opens the payment panel, and Back returns to the tab and its filters", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.payments() });

    // Due: the 5K's quote.
    const dueRow = within(screen.getByText("Riverfront Summer 5K").closest("tr") as HTMLElement);
    await user.click(dueRow.getByRole("link", { name: /^Record payment: / }));
    expect(here()).toBe(routes.city.case(S5, { task: "pay", from: routes.city.payments() }));
    expectRealScreen();
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Record an in-person payment" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText(/Quote balance/)).toBeInTheDocument();
    expect(backLink()).toHaveTextContent("Back to Payments");
    await closePanel(user);
    await user.click(backLink());
    expect(here()).toBe(routes.city.payments());
    expectRealScreen();

    // Received, filtered to card payments: the festival's row opens its case, and Back keeps the tab and the filter.
    await user.click(screen.getByRole("tab", { name: /^Received/ }));
    await user.selectOptions(screen.getByLabelText("Method"), "card");
    const received = `${routes.city.payments()}?tab=received&method=card`;
    expect(here()).toBe(received);
    await user.click(within(screen.getByText("Main Street Food Truck Festival").closest("tr") as HTMLElement).getByRole("link"));
    expect(navState.pathname).toBe(`/city/cases/${S6}`);
    expectRealScreen();
    expect(backLink()).toHaveTextContent("Back to Payments");
    await user.click(backLink());
    expect(here()).toBe(received);
    expect(screen.getByRole("tab", { name: /^Received/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Method")).toHaveValue("card");

    // Clear filters takes every filter off in one go.
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2027-01-01" } });
    expect(here()).toBe(`${routes.city.payments()}?tab=received&method=card&start=2027-01-01`);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(here()).toBe(`${routes.city.payments()}?tab=received`);
  });

  it("Closures and routes: an event on the map's list opens its case, and Back returns to that day's map", async () => {
    const jul11 = `${routes.city.map()}?mode=day&from=2027-07-11`;
    const { user } = await renderApp({ role: "pws", path: jul11 });
    expectRealScreen();

    const list = within(screen.getByRole("list", { name: "What is on the map" }));
    const row = list.getByRole("link", { name: /Riverfront Summer 5K/ });
    expect(within(row).getByText("Date held")).toBeInTheDocument();
    await user.click(row);

    expect(navState.pathname).toBe(`/city/cases/${S5}`);
    expectRealScreen();
    expect(h1()).toBe("Riverfront Summer 5K");
    expect(backLink()).toHaveTextContent("Back to Closures and routes");
    await user.click(backLink());
    expect(navState.pathname).toBe(routes.city.map());
    // The day is back in the URL (Day is the default range, so it is not spelled out), and so is the event.
    expect(here()).toBe(`${routes.city.map()}?from=2027-07-11`);
    expectRealScreen();
    expect(within(screen.getByRole("list", { name: "What is on the map" })).getByRole("link", { name: /Riverfront Summer 5K/ })).toBeInTheDocument();
  });

  it("Work orders: Mark done opens the work order on its case, and the list has it done on the way back; a meeting's Reschedule opens its panel", async () => {
    const { user } = await renderApp({ role: "pws", path: routes.city.workOrders() });
    const barricades = storedCase(ULTRA).tasks.find((t) => t.catalogId === "work_order:barricades")!;

    const group = within(screen.getByRole("list", { name: "Four Bridges Ultra's work orders" }));
    await user.click(group.getAllByRole("link", { name: /^Mark done: / })[0]);
    expect(here()).toBe(routes.city.case(ULTRA, { task: barricades.id, from: routes.city.workOrders() }));
    expectRealScreen();
    const order = within(screen.getByRole("dialog"));
    expect(order.getByRole("heading", { name: "Deliver barricades" })).toBeInTheDocument();
    expect(order.getByText("30 barricades")).toBeInTheDocument();
    await user.click(panelButton("Mark done"));
    expect(storedCase(ULTRA).tasks.find((t) => t.id === barricades.id)!.status).toBe("done");

    expect(backLink()).toHaveTextContent("Back to Work orders");
    await user.click(backLink());
    expect(here()).toBe(routes.city.workOrders());
    expectRealScreen();
    const after = within(screen.getByRole("list", { name: "Four Bridges Ultra's work orders" }));
    expect(after.getAllByRole("link", { name: /^Mark done: / })).toHaveLength(2);
    expect(after.getByText("Done")).toBeInTheDocument();

    // The other tab: a walkthrough's Reschedule opens the Schedule panel on the case, and Back keeps the tab.
    await user.click(screen.getByRole("tab", { name: /^Walkthroughs and meetings/ }));
    const meetings = `${routes.city.workOrders()}?tab=meetings`;
    expect(here()).toBe(meetings);
    const walkthrough = screen.getByText("Site walkthrough · Scheduled for Fri, Aug 6, 2027").closest("li") as HTMLElement;
    await user.click(within(walkthrough).getByRole("link", { name: /^Reschedule: / }));
    expect(navState.pathname).toBe(`/city/cases/${ULTRA}`);
    expectRealScreen();
    expect(within(screen.getByRole("dialog")).getByLabelText(/Date/)).toHaveValue("2027-08-06");
    await closePanel(user);
    await user.click(backLink());
    expect(here()).toBe(meetings);
  });

  it("Verifications: a row opens that document's check on its case; verified, it leaves the queue and joins Recently decided", async () => {
    const byEvent = `${routes.city.verifications()}?group=event`;
    const { user } = await renderApp({ role: "hl", path: byEvent });
    expectRealScreen();

    await user.click(screen.getByText("Riverfront Summer 5K", { selector: "a *" }).closest("a") as HTMLElement);
    expect(here()).toBe(routes.city.case(S5, { tab: "documents", task: `verify_document:${S5}:insurance_certificate`, from: byEvent }));
    expectRealScreen();
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    await user.click(panelButton("Verify"));
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate")!.status).toBe("done");

    expect(backLink()).toHaveTextContent("Back to Verifications");
    await user.click(backLink());
    expect(here()).toBe(byEvent);
    expectRealScreen();
    expect(screen.queryByRole("heading", { level: 2, name: /^Riverfront Summer 5K/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Recently decided" }));
    const decided = screen.getAllByRole("link").find((a) => a.getAttribute("href")?.startsWith(`/city/cases/${S5}?`))!;
    expect(within(decided).getByText("Verified")).toBeInTheDocument();
    await user.click(decided);
    expect(navState.pathname).toBe(`/city/cases/${S5}`);
    expect(navState.search.get("tab")).toBe("documents");
    expectRealScreen();
    expect(backLink()).toHaveTextContent("Back to Verifications");
  });

  it("Inspections: an event opens its case, and Back returns to Inspections", async () => {
    const { user } = await renderApp({ role: "hl", path: routes.city.inspections() });
    expectRealScreen();
    // The list is of permitted events. St. Agnes Parish's festival, in the window on the seed, is
    // still In review; give it its permit, as the Clerk's Issue permit would.
    expect(screen.queryByRole("link", { name: /St\. Agnes Parish/ })).not.toBeInTheDocument();
    act(() => {
      useDemo.setState((state) => ({ cases: state.cases.map((c) => (c.id === PARISH ? { ...c, state: "permitted" as const, permit: { issuedOn: state.demoToday, signature: "St. Agnes Parish" } } : c)) }));
    });

    await user.click(screen.getByRole("link", { name: /St\. Agnes Parish/ }));
    expect(here()).toBe(routes.city.case(PARISH, { from: routes.city.inspections() }));
    expectRealScreen();
    expect(backLink()).toHaveTextContent("Back to Inspections");
    await user.click(backLink());
    expect(here()).toBe(routes.city.inspections());
    expectRealScreen();
  });

  it("Settings names the open Drafts an edit would move without linking to them: the city has no page for a Draft", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.settings() });
    const reviewedAt = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(reviewedAt);
    await user.type(reviewedAt, "15");

    const panel = within(screen.getByRole("heading", { name: "What this changes" }).closest("aside") as HTMLElement);
    // Sunrise Yoga Club's draft is 20 people: Reviewed from 15.
    expect(panel.getByText("Sunrise Yoga Club weekly class")).toBeInTheDocument();
    expect(panel.getByText(S2)).toBeInTheDocument();
    expect(panel.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("(j) Settings reach the wizard: a threshold the Clerk edits is the one a new draft is classified with", () => {
  it("with Reviewed moved down to 30 people, a new applicant's picnic for 40 reads Reviewed in the live panel, and Instant again after Restore defaults", async () => {
    const { user } = await renderApp({ role: "clerk", path: routes.city.settings() });
    const reviewedAt = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(reviewedAt);
    await user.type(reviewedAt, "30");
    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(30);

    // A new applicant plans a picnic for 40: the demo script's own Instant example.
    await switchUser(user, "New applicant");
    expect(here()).toBe("/apply");
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Summer picnic");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /June 19th, 2027/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText(/Expected attendance/), "40");

    const livePanel = () => within(document.querySelector('[data-slot="wizard-result-panel"]') as HTMLElement);
    expect(livePanel().getByText(/This is a Reviewed event/)).toBeInTheDocument();
    expect(livePanel().getByText("40 people")).toBeInTheDocument();
    const draftId = navState.search.get("case")!;
    expect(storedCase(draftId)).toMatchObject({ state: "draft", tier: "reviewed" });

    // The Clerk restores the defaults: the open draft is Instant again without being touched,
    // in the store and in the wizard it is still open in.
    await switchTo(user, "clerk");
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restore defaults" }));
    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(100);
    expect(storedCase(draftId).tier).toBe("instant");

    await switchTo(user, "applicant");
    expect(navState.search.get("case")).toBe(draftId);
    expect(livePanel().getByText(/This is an Instant event/)).toBeInTheDocument();
  }, 30_000);
});

describe("(j) the demo coach and the command palette land on real screens", () => {
  const STEPS = DEMO_PATHS.flatMap((p) => p.steps.map((step) => [p.id, step.id, step] as const));

  it.each(STEPS)("path %i, %s: the page the coach sends this step's role to is a built page for that role", async (_pathId, _stepId, step) => {
    await renderApp({ role: step.role, personaId: step.persona, path: step.page });
    expectRealScreen();
    expect(navState.pathname.startsWith("/city")).toBe(step.role !== "applicant");
  });

  it("the strip follows a path across pages and roles: path 6 from the guide, its switch to the Clerk, and its end on the applicant's board", async () => {
    const { user } = await renderApp({ path: routes.demo() });
    const card = screen.getByRole("heading", { name: "Closeout" }).closest('[data-slot="panel"]') as HTMLElement;
    await user.click(within(card).getByRole("button", { name: /^Start this path: / }));
    expect(here()).toBe(routes.city.case(S6));
    expect(screen.getByText("Path 6 · Step 1 of 3")).toBeInTheDocument();

    // Public Works & Safety logs the closeout from the case, as the path says.
    await user.click(within(screen.getByRole("complementary", { name: "Your actions" })).getByRole("button", { name: "Log closeout" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Pass" }));
    await user.click(panelButton("Log closeout"));
    expect(storedCase(S6).closeout.hoursLoggedOn).toBe("2027-05-03");

    // The coach is on the next step and offers the switch it needs.
    expect(screen.getByText("Path 6 · Step 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch to City Clerk" }));
    expect(useDemo.getState().role).toBe("clerk");
    expect(here()).toBe(routes.city.case(S6));
    expectRealScreen();

    // It stays with the presenter on a page that names no case.
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    expect(screen.getByText("Path 6 · Step 2 of 3")).toBeInTheDocument();

    // Reconciled from the queue's row: the last step is the applicant's, on their board.
    const reconcile = queueFor(useDemo.getState().cases, "clerk", useDemo.getState().demoToday).find((row) => row.case.id === S6)!;
    await user.click(linkTo(routes.city.case(S6, { task: reconcile.task.id, from: routes.city.queue() })));
    await user.click(panelButton("Reconcile and close"));
    expect(storedCase(S6).state).toBe("closed");
    expect(screen.getByText("Path 6 · Step 3 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch to Applicant" }));
    expect(here()).toBe(routes.event(S6));
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "main-street-business-alliance" });
    expectRealScreen();
    expect(screen.getByText("Path 6 · Done")).toBeInTheDocument();

    // Dismissed, it stays dismissed when the other shell mounts.
    await user.click(screen.getByRole("button", { name: "Dismiss the demo coach" }));
    await switchTo(user, "clerk");
    expect(screen.queryByText(/^Path 6/)).not.toBeInTheDocument();
  }, 30_000);

  it.each(CITY_ROLES)("%s: the palette's Go to reaches every page of the role, shared pages and its own tools", async (role) => {
    const pages = [...CITY_CORE_LINKS, ...cityToolLinks(role)];
    const { user } = await renderApp({ role, path: routes.city.queue() });

    for (const page of pages) {
      await user.keyboard("{Control>}k{/Control}");
      const palette = within(screen.getByRole("dialog"));
      await user.type(palette.getByRole("combobox"), page.label);
      await user.click(within(palette.getByRole("group", { name: "Go to" })).getByRole("option", { name: page.label }));
      expect(here(), page.label).toBe(page.href);
      expectRealScreen();
    }
  }, 30_000);

  it("the Applicant's palette reaches My events and the wizard, and a case by name", async () => {
    const { user } = await renderApp({ scenario: "S1" });
    for (const [label, href] of [["My events", routes.events()], ["Plan an event", routes.apply()]] as const) {
      await user.keyboard("{Control>}k{/Control}");
      await user.click(within(screen.getByRole("dialog")).getByRole("option", { name: label }));
      expect(here()).toBe(href);
      expectRealScreen();
    }
    await user.keyboard("{Control>}k{/Control}");
    await user.type(within(screen.getByRole("dialog")).getByRole("combobox"), "birthday");
    await user.click(within(screen.getByRole("dialog")).getByRole("option", { name: /Maya Chen's 40th birthday picnic/ }));
    expect(here()).toBe(routes.event(S1));
    expectRealScreen();
  });
});

describe("(j) demo path 7, clicked from first step to last, and then on through the city", () => {
  it("Maya adds a DJ from her permit, takes the late fee, and the new cards appear tagged Amendment with the permit as it was; the departments check them, the Clerk approves, she signs and pays, and the permit covers the amended plan", async () => {
    const { user } = await renderApp({ scenario: "S1" });
    expect(here()).toBe(routes.permit(S1));
    expectRealScreen();
    // The scenario jump put the coach on path 7.
    expect(screen.getByText("Path 7 · Step 1 of 2")).toBeInTheDocument();
    const permit = () => within(document.getElementById("permit-print-area") as HTMLElement);
    expect(permit().getByText("Instant")).toBeInTheDocument();
    expect(permit().queryByText(/Amplified sound approval/)).not.toBeInTheDocument();

    // Step 1: add a DJ. The permit links to the wizard reopened on the same record.
    await user.click(screen.getByRole("link", { name: "Change your event" }));
    expect(here()).toBe(routes.amend(S1));
    expectRealScreen();
    await user.click(screen.getByRole("button", { name: "Next" })); // what -> where
    await user.click(screen.getByRole("button", { name: "Next" })); // where -> when
    await user.click(screen.getByRole("button", { name: "Next" })); // when -> size
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    const diff = () => within(document.querySelector('[data-slot="amend-result-panel"]') as HTMLElement);
    expect(diff().getByText(/This change makes your event Reviewed\. Everything you entered is kept; 4 new cards will be added\./)).toBeInTheDocument();
    // Nothing has been sent yet: the record is as it was, and so is the coach.
    expect(storedCase(S1)).toMatchObject({ tier: "instant", flags: { amendmentPending: false } });
    expect(screen.getByText("Path 7 · Step 1 of 2")).toBeInTheDocument();

    // Still step 1: the date gate fires (19 days left, 30 needed); she takes the late fee.
    await user.click(screen.getByRole("button", { name: "Next" })); // size -> review
    // (The coach's own line names the same gate, so the words are on screen twice.)
    expect(within(screen.getByRole("heading", { level: 2, name: "Review your change" }).closest("div")!.parentElement as HTMLElement).getByText(/19 days left, 30 needed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm change" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Pay a \$53\.75 late fee/ }));
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    // Step 2: the board has the new cards tagged Amendment, and the permit is as it was.
    expect(here()).toBe(routes.event(S1));
    expectRealScreen();
    // The coach is on the path's last step, which says what to point at here.
    expect(screen.getByText("Path 7 · Step 2 of 2")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Demo coach" })).getByText("New cards tagged Amendment appear, and the current permit stays valid for the original plan.")).toBeInTheDocument();
    expect(storedCase(S1)).toMatchObject({ tier: "reviewed", state: "permitted", flags: { amendmentPending: true, lateFee: true } });
    expect(document.querySelector('[data-slot="amendment-pending"]')).toHaveTextContent("An amendment is pending. Finish the new cards below, then submit it; your current permit stays valid for the original plan until it is decided.");
    const cardButton = (name: RegExp) => screen.getByRole("button", { name });
    // The amendment's own Submit card is named for what it sends, as its sheet's button is.
    expect(screen.queryByRole("button", { name: /Submit application/ })).not.toBeInTheDocument();
    for (const name of [/Certificate of insurance/, /Sound details/, /Submit amendment/, /Accept conditions and sign/]) {
      expect(within(cardButton(name)).getByText("Amendment")).toBeInTheDocument();
    }
    expect(within(cardButton(/Pay and book/)).queryByText("Amendment")).not.toBeInTheDocument();
    // The board's menu says why the plan cannot be changed again yet.
    await user.click(screen.getByRole("button", { name: "Board menu" }));
    expect(screen.getByRole("menuitem", { name: "Change your event" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("link", { name: /View permit/ }));
    expect(here()).toBe(routes.permit(S1));
    expect(permit().getByText("An amendment is pending. This permit covers the original plan until it’s approved.")).toBeInTheDocument();
    // The original plan, to the letter: Instant, with no sound approval on it.
    expect(permit().getByText("Instant")).toBeInTheDocument();
    expect(permit().queryByText("Reviewed")).not.toBeInTheDocument();
    expect(permit().queryByText(/Amplified sound approval/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Change your event" })).not.toBeInTheDocument();
    await user.click(permit().getByRole("link", { name: "Open the verification page" }));
    expect(screen.getByRole("heading", { level: 1, name: "Valid" })).toBeInTheDocument();
    expect(screen.getByText("A change to this event is pending. Until it is approved, the permit covers only what is shown here.")).toBeInTheDocument();

    // Past the PRD's path: she finishes the two cards and submits the amendment.
    navigate(routes.event(S1));
    await user.click(cardButton(/Sound details/));
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Sound equipment"), "One DJ booth, two speakers");
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Sound check time"), { target: { value: "10:30" } });
    await user.click(panelButton("Send"));
    await user.click(cardButton(/Certificate of insurance/));
    await user.click(panelButton("Use sample file"));
    await user.click(panelButton("Send"));
    await user.click(cardButton(/Submit amendment/));
    expect(within(screen.getByRole("dialog")).getByText(/This sends your amendment to the City Clerk for a decision/)).toBeInTheDocument();
    await user.click(panelButton("Submit amendment"));
    expect(document.querySelector('[data-slot="amendment-pending"]')).toHaveTextContent("An amendment is pending. Health & Legal and Public Works & Safety are checking its cards, then the City Clerk decides. Your current permit stays valid for the original plan until it is decided.");

    // The city side. The Clerk's case says where the amendment stands; the decision waits.
    await switchTo(user, "clerk");
    expect(here()).toBe(routes.city.case(S1));
    expectRealScreen();
    const caseBanner = () => document.querySelector('[data-slot="amendment-pending"]') as HTMLElement;
    expect(caseBanner()).toHaveTextContent("Amendment pending: Instant to Reviewed, 4 new cards. Health & Legal and Public Works & Safety are checking its cards, then the City Clerk decides.");
    const whoIsUp = () => [...screen.getByRole("list", { name: "Who's up" }).querySelectorAll('[data-status="up_now"]')].map((row) => row.getAttribute("data-party"));
    expect(whoIsUp()).toEqual(["pws", "hl"]);
    const clerkActions = () => within(screen.getByRole("complementary", { name: "Your actions" }));
    await user.click(clerkActions().getByRole("button", { name: "Decide amendment" }));
    const waiting = within(screen.getByRole("dialog"));
    expect(waiting.getByText("Amplified sound: added")).toBeInTheDocument();
    expect(waiting.getByText('Health & Legal is still checking "Certificate of insurance", and 1 more card.')).toBeInTheDocument();
    expect(panelButton("Approve amendment")).toBeDisabled();
    await closePanel(user);
    // Not in the Clerk's queue yet: the task is waiting on the two checks.
    expect(queueFor(useDemo.getState().cases, "clerk", "2027-05-03").filter((row) => row.case.id === S1)).toEqual([]);

    // Public Works & Safety checks the sound details, from its queue.
    await switchTo(user, "pws");
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    const sound = queueFor(useDemo.getState().cases, "pws", "2027-05-03").find((row) => row.case.id === S1)!;
    await user.click(linkTo(routes.city.case(S1, { task: sound.task.id, from: routes.city.queue() })));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Verify: Sound details" })).toBeInTheDocument();
    await user.click(panelButton("Verify"));
    // On the Documents tab the card carries the same chip the applicant's board gives it.
    await user.click(screen.getByRole("tab", { name: "Documents" }));
    expect(within(screen.getByTestId(`document-card-${S1}:sound_details`)).getByText("Amendment")).toBeInTheDocument();

    // Health & Legal checks the certificate, from its Verifications page.
    await switchTo(user, "hl");
    await user.click(screen.getByRole("link", { name: "Verifications" }));
    await user.click(screen.getByText("Maya Chen's 40th birthday picnic", { selector: "a *" }).closest("a") as HTMLElement);
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    await user.click(panelButton("Verify"));
    expect(storedCase(S1).tasks.find((t) => t.catalogId === "decide_amendment")).toMatchObject({ status: "todo" });

    // The Clerk: the decision is in the queue now, and its row opens the panel.
    await switchTo(user, "clerk");
    await user.click(screen.getByRole("link", { name: /^My queue/ }));
    const decision = queueFor(useDemo.getState().cases, "clerk", "2027-05-03").find((row) => row.case.id === S1)!;
    const decisionRow = linkTo(routes.city.case(S1, { task: decision.task.id, from: routes.city.queue() }));
    expect(within(decisionRow).getByText("Decide amendment: approve or decline the change")).toBeInTheDocument();
    expect(within(decisionRow).getByText("The amendment's cards are checked")).toBeInTheDocument();
    await user.click(decisionRow);
    expectRealScreen();
    expect(caseBanner()).toHaveTextContent("Its cards are checked: the City Clerk decides.");
    const decide = within(screen.getByRole("dialog"));
    expect(decide.getByRole("heading", { name: "Decide amendment" })).toBeInTheDocument();
    // Both of the amendment's documents are checked; its Submit card is in, and the signature waits for the decision.
    expect(decide.getAllByText("Checked")).toHaveLength(2);
    expect(decide.getByText("Submitted")).toBeInTheDocument();
    expect(decide.getByText("Not open yet")).toBeInTheDocument();
    expect(decide.getByText("$393.75")).toBeInTheDocument();
    expect(decide.getByText("The applicant then signs and pays $393.75; the amended plan takes effect when they have. Nothing is charged now.")).toBeInTheDocument();
    await user.click(panelButton("Approve amendment"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(caseBanner()).toHaveTextContent("Approved. Waiting on the applicant to sign and pay $393.75.");
    expect(whoIsUp()).toEqual(["applicant"]);
    expect(storedCase(S1).payments).toHaveLength(1);

    // The Clerk's Payments page has the difference as due, and its row is the case's own panel.
    await user.click(screen.getByRole("link", { name: "Payments" }));
    const due = within(screen.getByText("Maya Chen's 40th birthday picnic").closest("tr") as HTMLElement);
    expect(due.getByText("Amendment balance")).toBeInTheDocument();
    expect(due.getByText("$393.75")).toBeInTheDocument();

    // Maya: the board's card opens the amendment's quote; she signs and pays the difference.
    await switchTo(user, "applicant");
    navigate(routes.event(S1));
    expect(useDemo.getState().personaId).toBe("maya-chen");
    expect(document.querySelector('[data-slot="amendment-pending"]')).toHaveTextContent("The City Clerk approved your amendment. Accept and sign, then pay $393.75, to put it into effect");
    await user.click(cardButton(/Accept conditions and sign/));
    expect(here()).toBe(routes.quote(S1));
    expectRealScreen();
    expect(document.querySelector('[data-slot="amendment-quote"]')).toHaveTextContent("The City Clerk approved your amendment.");
    await user.type(screen.getByLabelText(/Type your full legal name/), "Maya Chen");
    await user.click(screen.getByRole("checkbox", { name: /I have read and accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept and sign" }));
    expect(storedCase(S1).flags).toMatchObject({ signed: true, amendmentPending: true });
    await user.click(screen.getByRole("button", { name: "Pay $393.75" }));
    await waitForPayment();

    // In effect: the page says so and goes back to the board, and the permit now covers the amended plan.
    expect(storedCase(S1).flags.amendmentPending).toBe(false);
    expect(storedCase(S1).payments.at(-1)).toMatchObject({ amount: 393.75, kind: "quote", amendment: true });
    expect(here()).toBe(routes.event(S1));
    expectRealScreen();
    expect(document.querySelector('[data-slot="amendment-pending"]')).toBeNull();
    await user.click(screen.getByRole("link", { name: /View permit/ }));
    expect(permit().getByText("Reviewed")).toBeInTheDocument();
    expect(permit().getByText(/Amplified sound approval/)).toBeInTheDocument();
    expect(permit().queryByText(/An amendment is pending/)).not.toBeInTheDocument();
    // And it can be changed again.
    expect(screen.getByRole("link", { name: "Change your event" })).toHaveAttribute("href", routes.amend(S1));
  }, 90_000);

  it("declined instead: the Clerk gives a reason, and the applicant's board and permit are as they were", async () => {
    const { user } = await renderApp({ scenario: "S1", path: routes.event(S1) });
    // The amendment, proposed and submitted, as the test above clicks it.
    act(() => {
      const store = useDemo.getState();
      const s1 = storedCase(S1);
      expect(store.dispatch(S1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true }).ok).toBe(true);
      expect(store.dispatch(S1, { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth" } }).ok).toBe(true);
      expect(store.dispatch(S1, { type: "complete_task", taskId: `${S1}:insurance_certificate`, files: [{ name: "coi.pdf", size: 1000, type: "application/pdf" }] }).ok).toBe(true);
      expect(store.dispatch(S1, { type: "submit" }).ok).toBe(true);
    });

    await switchTo(user, "clerk");
    await user.click(within(screen.getByRole("complementary", { name: "Your actions" })).getByRole("button", { name: "Decide amendment" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Decline" }));
    // Declining does not wait for the departments, but it needs a reason.
    expect(panelButton("Decline amendment")).toBeDisabled();
    await user.type(within(screen.getByRole("dialog")).getByLabelText(/Reason/), "No amplified sound at Shelter 3");
    await user.click(panelButton("Decline amendment"));
    expect(document.querySelector('[data-slot="amendment-pending"]')).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText("Declined the amendment: No amplified sound at Shelter 3. The original plan stands.")).toBeInTheDocument();
    // Nothing of it is left in any queue.
    for (const role of CITY_ROLES) expect(queueFor(useDemo.getState().cases, role, "2027-05-03").filter((row) => row.case.id === S1)).toEqual([]);

    await switchTo(user, "applicant");
    expect(here()).toBe(routes.event(S1));
    expect(document.querySelector('[data-slot="amendment-pending"]')).toBeNull();
    expect(screen.queryByText("Amendment")).not.toBeInTheDocument();
    expect(storedCase(S1)).toMatchObject({ tier: "instant", addOns: { amplifiedSound: false }, flags: { amendmentPending: false, lateFee: false } });
  }, 30_000);
});

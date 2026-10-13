/**
 * The hand-offs between the Phase 3 surfaces. Each was built without sight of the others, so
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
import { screen, within } from "@testing-library/react";
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
import { navState } from "./setup";
import { navigate, renderScreen, storedCase, type RenderScreenOptions } from "./harness";

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
 * Closes the open sheet. A sheet is modal, so the top bar (the role switcher included) is out
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
    await user.click(screen.getByRole("button", { name: "Event date" }));
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
    expect(sheet.getAllByRole("link", { name: "Pay this session" })).toHaveLength(owed.length);

    await user.click(sheet.getAllByRole("link", { name: "Pay this session" })[0]);

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
    await user.click(row.getByRole("link", { name: "Request information" }));
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

  it("the staff section's own door opens the workspace too", async () => {
    const { user } = await renderApp({ path: routes.home() });

    await user.click(screen.getByRole("link", { name: "Open the staff workspace" }));

    expect(here()).toBe(routes.city.queue());
    expectRealScreen();
  });

  it.each(DEMO_PATHS.map((p) => [p.id, p.title] as const))("demo path %i, %s: Start this path lands on a real screen", async (id, title) => {
    const { user } = await renderApp({ path: routes.demo() });

    const card = screen.getByRole("heading", { name: title }).closest('[data-slot="panel"]') as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Start this path" }));

    expect(navState.pathname, `path ${id}`).not.toBe(routes.demo());
    expectRealScreen();
    // The page is the role's own: the role switcher agrees with the area the path opened in.
    const role = useDemo.getState().role;
    expect(navState.pathname.startsWith("/city")).toBe(role !== "applicant");
  });

  it("the guide's scenario table jumps to real screens as well", async () => {
    const { user } = await renderApp({ path: routes.demo() });
    const count = screen.getAllByRole("button", { name: "Jump" }).length;
    expect(count).toBe(6);

    for (let i = 0; i < count; i++) {
      await user.click(screen.getAllByRole("button", { name: "Jump" })[i]);
      expect(navState.pathname).not.toBe(routes.demo());
      expectRealScreen();
      navigate(routes.demo());
    }
  });
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

async function switchTo(user: User, role: Party) {
  await user.click(screen.getByRole("radio", { name: PARTY_LABEL[role] }));
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
    await switchTo(user, "applicant");
    expect(here()).toBe(routes.events());
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
      // A card's sheet is closed before the role switcher can be reached.
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

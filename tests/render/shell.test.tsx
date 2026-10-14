import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CaseNotFound } from "@/components/shell/CaseNotFound";
import { CityShell } from "@/components/shell/CityShell";
import { PlaceholderScreen } from "@/components/shell/PlaceholderScreen";
import { DEMO_PATHS, SCENARIO_JUMPS } from "@/lib/data/demoScript";
import { PERSONA_BY_ID, PICKABLE_PERSONA_IDS } from "@/lib/data/people";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { buildSeed, queueFor, useDemo } from "@/lib/state";
import { navState } from "./setup";
import { lastPush, renderScreen, storedCase, switchUser } from "./harness";

const TODAY = DEFAULT_DEMO_TODAY;

const OFFICIALS = ["City Clerk", "Public Works & Safety", "Health & Legal"];

/** The open user menu's applicants, under its three city officials, by accessible name: an avatar's initials are not part of it. */
function expectApplicantOptions(names: string[]) {
  const all = [...OFFICIALS, ...names];
  const options = screen.getAllByRole("menuitemradio");
  expect(options).toHaveLength(all.length);
  all.forEach((name, index) => expect(options[index]).toHaveAccessibleName(name));
  const applicants = within(screen.getByRole("group", { name: "Applicants" })).getAllByRole("menuitemradio");
  expect(applicants).toHaveLength(names.length);
}

describe("the render harness", () => {
  it("mounts against the real seed when no cases are passed", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });

    expect(useDemo.getState().cases).toEqual(buildSeed());
    expect(useDemo.getState().cases).toHaveLength(38);
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "new", demoToday: TODAY });
  });

  it("uses hand-built cases instead when they are passed", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events", cases: [makeCase({ id: "PMT-27-0001" })] });
    expect(useDemo.getState().cases.map((c) => c.id)).toEqual(["PMT-27-0001"]);
  });

  it("opens a scenario the way its Demo menu jump does", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5" });

    expect(useDemo.getState()).toMatchObject({ role: "clerk", personaId: "riverfront-running-club" });
    expect(navState.pathname).toBe("/city/cases/PMT-27-0097");
    expect(navState.params).toEqual({ id: "PMT-27-0097" });
    expect(storedCase("PMT-27-0097").state).toBe("quote_sent");
    expect(screen.getByText("case detail")).toBeInTheDocument();
  });

  it("splits a query string in the path into search params", async () => {
    await renderScreen(<AppShell>wizard</AppShell>, { scenario: "S2", search: { from: "landing" } });

    expect(navState.pathname).toBe("/apply");
    expect(navState.params).toEqual({});
    expect(Object.fromEntries(navState.search)).toEqual({ case: "PMT-27-0142", step: "when", from: "landing" });
  });

  it("returns a user-event session", async () => {
    const { user } = await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    await switchUser(user, "City Clerk");
    expect(useDemo.getState().role).toBe("clerk");
  });
});

describe("the app header", () => {
  it("is the site header: the city's seal and name, linking home, with today's demo date", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });

    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-slot", "site-header");
    expect(header).toHaveAttribute("data-pinned");
    const home = within(header).getByRole("link", { name: /^City of Permitopolis\s*Office of the City Clerk$/ });
    expect(home).toHaveAttribute("href", "/");
    expect(within(header).getByText("Demo today: Mon, May 3, 2027")).toBeInTheDocument();
  });

  it("has no role switcher: one user button, after Search and just before the Demo menu", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });

    expect(screen.queryByRole("radiogroup", { name: "Switch role" })).not.toBeInTheDocument();
    const buttons = within(screen.getByRole("banner")).getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(buttons).toEqual(["Search", "Switch user: New applicant", "Demo menu"]);
  });

  it("the user button names who is acting: the city role, or the applicant", async () => {
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "pws" });
    const button = screen.getByRole("button", { name: "Switch user: Public Works & Safety" });
    expect(button).toHaveTextContent("Public Works & Safety");

    await switchUser(userEvent.setup(), "Maya Chen");
    expect(screen.getByRole("button", { name: "Switch user: Maya Chen" })).toHaveTextContent("Maya Chen");
    expect(screen.getByText("Acting as Maya Chen")).toHaveAttribute("aria-live", "polite");
  });

  it("the user menu lists the three city officials, then the applicants, with the current one checked", async () => {
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "hl" });

    await userEvent.click(screen.getByRole("button", { name: "Switch user: Health & Legal" }));

    const officials = within(screen.getByRole("group", { name: "City officials" })).getAllByRole("menuitemradio");
    expect(officials.map((option) => option.textContent)).toEqual(OFFICIALS);
    expectApplicantOptions(PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id].name));
    expect(screen.getAllByRole("menuitemradio", { checked: true })).toHaveLength(1);
    expect(screen.getByRole("menuitemradio", { name: "Health & Legal" })).toBeChecked();
    // My events and Plan an event are the Applicant's pages: a city official is not offered them.
    expect(screen.queryByRole("menuitem", { name: "My events" })).not.toBeInTheDocument();
  });

  it("renders the page once hydrated, for the Applicant", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });
    expect(screen.getByText("applicant content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

describe("switching role", () => {
  it("follows a seeded case from the applicant's board to the matching city role", async () => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    await switchUser(userEvent.setup(), "City Clerk");

    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
    expect(useDemo.getState().role).toBe("clerk");
  });

  it("follows a case back to its own applicant, whoever was picked before", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S6", personaId: "maya-chen" });

    await switchUser(userEvent.setup(), "Main Street Business Alliance");

    expect(lastPush()).toBe("/events/PMT-27-0031");
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "main-street-business-alliance" });
  });

  it("picking another applicant from a case opens that applicant's own page, not the case", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S6", personaId: "maya-chen" });

    await switchUser(userEvent.setup(), "Maya Chen");

    expect(lastPush()).toBe("/events");
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "maya-chen" });
  });

  it("offers the organizer of the case on screen when the menu's seven do not include them, and follows the case", async () => {
    // F1, the Downtown Art Walk: its organizer is not one of the six scenario personas.
    await renderScreen(<CityShell>case detail</CityShell>, { path: "/city/cases/PMT-27-0121", role: "clerk" });

    await userEvent.click(screen.getByRole("button", { name: "Switch user: City Clerk" }));
    expectApplicantOptions(["Downtown Art Walk Committee", ...PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id].name)]);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Downtown Art Walk Committee" }));

    expect(lastPush()).toBe("/events/PMT-27-0121");
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "downtown-art-walk-committee" });
  });

  it("shows an applicant the menu does not offer, once their case has been followed", async () => {
    await renderScreen(<AppShell>board</AppShell>, {
      path: "/events/PMT-27-0121",
      personaId: "downtown-art-walk-committee",
    });

    await userEvent.click(screen.getByRole("button", { name: "Switch user: Downtown Art Walk Committee" }));

    expectApplicantOptions(["Downtown Art Walk Committee", ...PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id].name)]);
    expect(screen.getByRole("menuitemradio", { name: "Downtown Art Walk Committee" })).toBeChecked();
  });

  it("keeps the URL, query string included, when switching between two city roles", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5", search: { tab: "reviews" } });

    await switchUser(userEvent.setup(), "Public Works & Safety");

    expect(navState.pushCalls).toEqual([]); // nothing navigated: the page re-renders for the new role
    expect(useDemo.getState().role).toBe("pws");
    expect(screen.getByText("case detail")).toBeInTheDocument();
  });

  it("leaves the Clerk's Intake for the new role's queue: Intake is not Public Works & Safety's page (path 4)", async () => {
    await renderScreen(<CityShell>intake</CityShell>, { path: "/city/intake", search: { tab: "reviewed" }, role: "clerk" });
    expect(screen.getByText("intake")).toBeInTheDocument();
    expect(useDemo.getState().lastPathByRole.clerk).toBe("/city/intake?tab=reviewed");

    await switchUser(userEvent.setup(), "Public Works & Safety");

    expect(useDemo.getState().role).toBe("pws");
    expect(lastPush()).toBe("/city/queue");
    expect(navState.pathname).toBe("/city/queue");
    expect(screen.getByRole("link", { name: /My queue/ })).toHaveAttribute("aria-current", "page");
    // Intake was the Clerk's page and stays the Clerk's: the new role remembers its own.
    expect(useDemo.getState().lastPathByRole).toMatchObject({ clerk: "/city/intake?tab=reviewed", pws: "/city/queue" });

    // Back to the Clerk from the shared queue: the URL stays, as between any two city roles there.
    await switchUser(userEvent.setup(), "City Clerk");
    expect(navState.pathname).toBe("/city/queue");
    expect(navState.pushCalls).toEqual(["/city/queue"]);
  });

  it("a tool page typed in under another city role shows who it is built for, and is not remembered", async () => {
    await renderScreen(<CityShell>work orders</CityShell>, { path: "/city/work-orders", role: "hl" });

    expect(screen.getByText("This screen is built for Public Works & Safety.")).toBeInTheDocument();
    expect(screen.queryByText("work orders")).not.toBeInTheDocument();
    // The role keeps its own sidebar, with nothing marked current.
    expect(screen.getByRole("link", { name: "Verifications" })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
    expect(useDemo.getState().lastPathByRole).toEqual({});

    await userEvent.click(screen.getByRole("button", { name: "Switch to Public Works & Safety" }));
    expect(useDemo.getState().role).toBe("pws");
    expect(navState.pushCalls).toEqual([]); // already on its page
    expect(screen.getByText("work orders")).toBeInTheDocument();
    expect(useDemo.getState().lastPathByRole).toEqual({ pws: "/city/work-orders" });
  });

  it("the Clerk's tool pages name the Clerk", async () => {
    await renderScreen(<CityShell>payments</CityShell>, { path: "/city/payments", role: "pws" });
    expect(screen.getByText("This screen is built for the City Clerk.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to City Clerk" })).toBeInTheDocument();
  });

  it("does not follow a Draft to the city", async () => {
    // B02, a Draft with a board: no city role can see it yet.
    await renderScreen(<AppShell>board</AppShell>, { path: "/events/PMT-27-0004", personaId: "riverside-garden-society" });
    expect(storedCase("PMT-27-0004").state).toBe("draft");

    await switchUser(userEvent.setup(), "City Clerk");

    expect(lastPush()).toBe("/city/queue");
  });

  it("falls back to the role's home off a case page", async () => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events", role: "applicant" });

    await switchUser(userEvent.setup(), "Health & Legal");

    expect(lastPush()).toBe("/city/queue");
  });

  it("remembers each role's last page with its query string, and comes back to it", async () => {
    await renderScreen(<CityShell>pipeline</CityShell>, { path: "/city/cases", search: { tier: "special" }, role: "clerk" });
    expect(useDemo.getState().lastPathByRole.clerk).toBe("/city/cases?tier=special");

    // The Applicant has no page to come back to yet: New applicant starts a blank wizard.
    await switchUser(userEvent.setup(), "New applicant");
    expect(lastPush()).toBe("/apply");
    expect(useDemo.getState().role).toBe("applicant");

    // The mismatch panel on the city page offers the way back; it lands on the filtered list.
    await userEvent.click(screen.getByRole("button", { name: "Switch to City Clerk" }));
    expect(lastPush()).toBe("/city/cases?tier=special");
  });
});

describe("the user menu's applicants", () => {
  it("offers the six scenario organizers and New applicant", async () => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    await userEvent.click(screen.getByRole("button", { name: "Switch user: New applicant" }));

    expectApplicantOptions([
      "Maya Chen",
      "Sunrise Yoga Club",
      "Downtown Arts Collective",
      "Maple Street block captain",
      "Riverfront Running Club",
      "Main Street Business Alliance",
      "New applicant",
    ]);
    expect(screen.getByRole("menuitemradio", { name: "New applicant" })).toBeChecked();
    // The applicant area's two pages, under the applicants.
    expect(screen.getByRole("menuitem", { name: "My events" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("menuitem", { name: "Plan an event" })).toHaveAttribute("href", "/apply");
  });

  it.each([
    ["Maya Chen", "maya-chen", "/events"],
    ["Sunrise Yoga Club", "sunrise-yoga-club", "/apply?case=PMT-27-0142&step=when"],
    ["Riverfront Running Club", "riverfront-running-club", "/events"],
  ])("picking %s sets the persona and opens their page", async (name, personaId, path) => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    await switchUser(userEvent.setup(), name);

    expect(useDemo.getState().personaId).toBe(personaId);
    expect(lastPush()).toBe(path);
  });

  it("picking New applicant opens a blank wizard", async () => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    await switchUser(userEvent.setup(), "New applicant");

    expect(useDemo.getState().personaId).toBe("new");
    expect(lastPush()).toBe("/apply");
  });
});

describe("Demo menu", () => {
  it.each(SCENARIO_JUMPS)("$id jumps to its role, persona and page", async (jump) => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    await userEvent.click(screen.getByRole("button", { name: "Demo menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: jump.label }));

    expect(useDemo.getState()).toMatchObject({ role: jump.role, personaId: jump.personaId });
    expect(lastPush()).toBe(jump.path);
    expect(storedCase(jump.caseId).applicantId).toBe(jump.personaId);
    // The demo coach is now on the path built on this scenario, and its first step is this jump's role.
    const path = DEMO_PATHS.find((p) => p.scenario === jump.id)!;
    expect(useDemo.getState().activeDemoPath).toBe(path.id);
    expect(path.steps[0].role).toBe(jump.role);
  });

  it.each(SCENARIO_JUMPS)("$id lands inside the shell built for its role, with no switch-role panel", async (jump) => {
    const Shell = jump.role === "applicant" ? AppShell : CityShell;
    await renderScreen(<Shell>the page</Shell>, { scenario: jump.id });

    expect(screen.getByText("the page")).toBeInTheDocument();
    expect(screen.queryByText(/This screen is built for/)).not.toBeInTheDocument();
    expect(useDemo.getState().lastPathByRole[jump.role]).toBe(jump.path);
  });

  it("Set demo date opens the date picker and it stays open, by mouse and by keyboard", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Set demo date/ }));
    expect(await screen.findByRole("button", { name: /Fri, Jun 18, 2027/ })).toBeInTheDocument();
    // Closing the menu hands focus back to its trigger; the picker must not take that for a click away.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("button", { name: /Fri, Jun 18, 2027/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mon, May 3, 2027/ })).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /Fri, Jun 18, 2027/ })).not.toBeInTheDocument();

    // The same from the keyboard: open the menu, arrow to the item, Enter.
    screen.getByRole("button", { name: "Demo menu" }).focus();
    await user.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: /Set demo date/ });
    item.focus();
    await user.keyboard("{Enter}");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("button", { name: /Fri, Jun 18, 2027/ })).toBeInTheDocument();
  });

  it("jumping to Fri, Jun 18 moves the demo date and puts a permitted Jazz in the Plaza on Event day (path 3)", async () => {
    const S3 = "PMT-27-0118";
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });
    // Path 3, up to the permit.
    const { dispatch } = useDemo.getState();
    const steps: [Parameters<typeof dispatch>[1], Parameters<typeof dispatch>[2]][] = [
      [{ type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "sample-health-permit.pdf", size: 248_000, type: "application/pdf" }] }, "applicant"],
      [{ type: "verify_document", taskId: `${S3}:vendor_health_permit:1` }, "hl"],
      [{ type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl"],
      [{ type: "send_quote", conditions: [], feeLines: [] }, "clerk"],
      [{ type: "accept_and_sign", signature: "Jordan Alvarez" }, "applicant"],
      [{ type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant"],
      [{ type: "issue_permit" }, "clerk"],
    ];
    act(() => {
      for (const [action, actor] of steps) expect(dispatch(S3, action, actor)).toMatchObject({ ok: true });
    });
    expect(storedCase(S3).state).toBe("permitted");

    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Set demo date/ }));
    await user.click(await screen.findByRole("button", { name: /Fri, Jun 18, 2027/ }));

    expect(useDemo.getState().demoToday).toBe("2027-06-18");
    expect(storedCase(S3).state).toBe("event_day");
    expect(screen.getByText("Demo today: Fri, Jun 18, 2027")).toBeInTheDocument();
    // Picking a date closes the picker.
    expect(screen.queryByRole("button", { name: /Sun, Jul 11, 2027/ })).not.toBeInTheDocument();
  });

  it("asks for confirmation before resetting, then restores the seed and goes to the Applicant's home", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5" });
    useDemo.getState().dispatch("PMT-27-0097", { type: "add_note", text: "Called the organizer." });
    useDemo.setState({ demoToday: "2027-06-18" });
    expect(useDemo.getState().cases).not.toEqual(buildSeed());

    await userEvent.click(screen.getByRole("button", { name: "Demo menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Reset demo data/ }));

    const dialog = await screen.findByRole("dialog", { name: "Reset the demo?" });
    expect(within(dialog).getByText(/as it was on Mon, May 3, 2027/)).toBeInTheDocument();
    expect(useDemo.getState().role).toBe("clerk"); // not reset yet: confirmation is still open
    expect(navState.pushCalls).toEqual([]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Reset demo data" }));

    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "new", demoToday: TODAY, lastPathByRole: {} });
    expect(useDemo.getState().cases).toEqual(buildSeed());
    expect(lastPush()).toBe("/events");
  });

  it("cancelling the reset changes nothing", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5" });

    await userEvent.click(screen.getByRole("button", { name: "Demo menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Reset demo data/ }));
    const dialog = await screen.findByRole("dialog", { name: "Reset the demo?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(useDemo.getState().role).toBe("clerk");
    expect(navState.pushCalls).toEqual([]);
  });
});

describe("CityShell sidebar", () => {
  it.each(["clerk", "pws", "hl"] as const)("shows %s's own queue count from the seed on My queue", async (role) => {
    const count = queueFor(buildSeed(), role, TODAY).length;
    expect(count).toBeGreaterThan(0);

    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role });

    const queueLink = screen.getByRole("link", { name: /My queue/ });
    expect(within(queueLink).getByText(String(count))).toBeInTheDocument();
    expect(queueLink).toHaveAccessibleName(`My queue, ${count} tasks to do`);
    expect(queueLink).toHaveAttribute("aria-current", "page");
  });

  it("counts every task the role can act on, and follows the store", async () => {
    const theCase = makeCase({
      id: "PMT-27-0001",
      state: "submitted",
      tasks: [makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", status: "todo" })],
    });
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "clerk", cases: [theCase] });

    const queueLink = screen.getByRole("link", { name: /My queue/ });
    expect(within(queueLink).getByText("1")).toBeInTheDocument();
    expect(queueLink).toHaveAccessibleName("My queue, 1 task to do");
  });

  it("shows no count when the queue is empty", async () => {
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "clerk", cases: [] });
    expect(screen.getByRole("link", { name: /My queue/ })).toHaveAccessibleName("My queue");
  });

  it("keeps Cases current on a case's own page, and lists the role's tools", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S6" });

    expect(screen.getByRole("link", { name: "Cases" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /My queue/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Closures and routes" })).toHaveAttribute("href", "/city/map");
    expect(screen.getByRole("link", { name: "Work orders" })).toHaveAttribute("href", "/city/work-orders");
  });
});

describe("storage banner", () => {
  it("appears when storageOk is false, and can be dismissed", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    useDemo.setState({ storageOk: false });

    const message = await screen.findByText(/Your browser is blocking storage/);
    expect(message).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss the storage warning" }));
    expect(screen.queryByText(/Your browser is blocking storage/)).not.toBeInTheDocument();
  });

  it("does not appear when storage is fine", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    expect(screen.queryByText(/Your browser is blocking storage/)).not.toBeInTheDocument();
  });
});

describe("area mismatch", () => {
  it("offers to switch to a city role when the Applicant is on a /city route", async () => {
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "applicant" });

    expect(screen.getByText("This screen is built for a city role.")).toBeInTheDocument();
    expect(screen.queryByText("queue")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to City Clerk" }));
    expect(useDemo.getState().role).toBe("clerk");
    // Already on the Clerk's home, so the page stays and now shows its content.
    expect(navState.pushCalls).toEqual([]);
    expect(screen.getByText("queue")).toBeInTheDocument();
  });

  it("offers to switch to the Applicant when a city role is on /events or /apply", async () => {
    await renderScreen(<AppShell>board</AppShell>, { path: "/events", role: "pws" });

    expect(screen.getByText("This screen is built for the Applicant.")).toBeInTheDocument();
    expect(screen.queryByText("board")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Applicant" }));
    expect(useDemo.getState().role).toBe("applicant");
  });

  it("does not remember a page for a role it was not built for", async () => {
    await renderScreen(<AppShell>board</AppShell>, { path: "/events", role: "pws" });
    expect(useDemo.getState().lastPathByRole).toEqual({});
  });
});

describe("placeholder and not-found states", () => {
  it("a placeholder page has a heading, names its route and links to the role's home", async () => {
    await renderScreen(
      <CityShell>
        <PlaceholderScreen route="/city/work-orders" />
      </CityShell>,
      { path: "/city/work-orders", role: "pws" },
    );

    expect(screen.getByRole("heading", { level: 1, name: "This screen is being built" })).toBeInTheDocument();
    expect(screen.getByText("/city/work-orders isn't wired up yet in this prototype.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/city/queue");
  });

  it("a placeholder with no shell around it brings its own main landmark", async () => {
    await renderScreen(<PlaceholderScreen route="/demo" standalone />, { path: "/demo" });

    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/events");
  });

  it("an unknown case id says so and offers the way back", async () => {
    await renderScreen(
      <AppShell>
        <CaseNotFound id="PMT-27-9999" backHref="/events" backLabel="Back to my events" />
      </AppShell>,
      { path: "/events/PMT-27-9999" },
    );

    expect(screen.getByText("There's no case PMT-27-9999 in this demo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my events" })).toHaveAttribute("href", "/events");
  });
});

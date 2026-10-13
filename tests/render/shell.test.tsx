import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CaseNotFound } from "@/components/shell/CaseNotFound";
import { CityShell } from "@/components/shell/CityShell";
import { PlaceholderScreen } from "@/components/shell/PlaceholderScreen";
import { SCENARIO_JUMPS } from "@/lib/data/demoScript";
import { PERSONA_BY_ID, PICKABLE_PERSONA_IDS } from "@/lib/data/people";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { buildSeed, queueFor, useDemo } from "@/lib/state";
import { navState } from "./setup";
import { lastPush, renderScreen, storedCase } from "./harness";

const TODAY = DEFAULT_DEMO_TODAY;

/** The open persona menu's options, by accessible name: the avatar's initials are not part of it. */
function expectPersonaOptions(names: string[]) {
  const options = screen.getAllByRole("menuitemradio");
  expect(options).toHaveLength(names.length);
  names.forEach((name, index) => expect(options[index]).toHaveAccessibleName(name));
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
    await user.click(screen.getByRole("radio", { name: "City Clerk" }));
    expect(useDemo.getState().role).toBe("clerk");
  });
});

describe("AppShell top bar", () => {
  it("shows the four roles and today's demo date", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });

    expect(screen.getByRole("radio", { name: "Applicant" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "City Clerk" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Public Works & Safety" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Health & Legal" })).toBeInTheDocument();
    expect(screen.getByText("Demo today: Mon, May 3, 2027")).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("radio", { name: "City Clerk" }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
    expect(useDemo.getState().role).toBe("clerk");
  });

  it("follows a case back to the applicant and takes on that case's own applicant", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S6", personaId: "maya-chen" });

    await userEvent.click(screen.getByRole("radio", { name: "Applicant" }));

    expect(lastPush()).toBe("/events/PMT-27-0031");
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "main-street-business-alliance" });
  });

  it("shows an applicant the picker does not offer, once their case has been followed", async () => {
    // F1, the Downtown Art Walk: its organizer is not one of the six scenario personas.
    await renderScreen(<AppShell>board</AppShell>, {
      path: "/events/PMT-27-0121",
      personaId: "downtown-art-walk-committee",
    });

    await userEvent.click(screen.getByRole("button", { name: "Switch applicant" }));

    expectPersonaOptions(["Downtown Art Walk Committee", ...PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id].name)]);
    expect(screen.getByRole("menuitemradio", { name: "Downtown Art Walk Committee" })).toBeChecked();
  });

  it("keeps the URL, query string included, when switching between two city roles", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5", search: { tab: "reviews" } });

    await userEvent.click(screen.getByRole("radio", { name: "Public Works & Safety" }));

    expect(navState.pushCalls).toEqual([]); // nothing navigated: the page re-renders for the new role
    expect(useDemo.getState().role).toBe("pws");
    expect(screen.getByText("case detail")).toBeInTheDocument();
  });

  it("does not follow a Draft to the city", async () => {
    // B02, a Draft with a board: no city role can see it yet.
    await renderScreen(<AppShell>board</AppShell>, { path: "/events/PMT-27-0004", personaId: "riverside-garden-society" });
    expect(storedCase("PMT-27-0004").state).toBe("draft");

    await userEvent.click(screen.getByRole("radio", { name: "City Clerk" }));

    expect(lastPush()).toBe("/city/queue");
  });

  it("falls back to the role's home off a case page", async () => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events", role: "applicant" });

    await userEvent.click(screen.getByRole("radio", { name: "Health & Legal" }));

    expect(lastPush()).toBe("/city/queue");
  });

  it("remembers each role's last page with its query string, and comes back to it", async () => {
    await renderScreen(<CityShell>pipeline</CityShell>, { path: "/city/cases", search: { tier: "special" }, role: "clerk" });
    expect(useDemo.getState().lastPathByRole.clerk).toBe("/city/cases?tier=special");

    await userEvent.click(screen.getByRole("radio", { name: "Applicant" }));
    expect(lastPush()).toBe("/events");

    // The mismatch panel on the city page offers the way back; it lands on the filtered list.
    await userEvent.click(screen.getByRole("button", { name: "Switch to City Clerk" }));
    expect(lastPush()).toBe("/city/cases?tier=special");
  });
});

describe("persona picker", () => {
  it("offers the six scenario organizers and New applicant", async () => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    await userEvent.click(screen.getByRole("button", { name: "Switch applicant" }));

    expectPersonaOptions([
      "Maya Chen",
      "Sunrise Yoga Club",
      "Downtown Arts Collective",
      "Maple Street block captain",
      "Riverfront Running Club",
      "Main Street Business Alliance",
      "New applicant",
    ]);
    expect(screen.getByRole("menuitemradio", { name: "New applicant" })).toBeChecked();
  });

  it.each([
    ["Maya Chen", "maya-chen", "/events"],
    ["Sunrise Yoga Club", "sunrise-yoga-club", "/apply?case=PMT-27-0142&step=when"],
    ["Riverfront Running Club", "riverfront-running-club", "/events"],
  ])("picking %s sets the persona and opens their page", async (name, personaId, path) => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    await userEvent.click(screen.getByRole("button", { name: "Switch applicant" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name }));

    expect(useDemo.getState().personaId).toBe(personaId);
    expect(lastPush()).toBe(path);
  });

  it("picking New applicant opens a blank wizard", async () => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    await userEvent.click(screen.getByRole("button", { name: "Switch applicant" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "New applicant" }));

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
  });

  it.each(SCENARIO_JUMPS)("$id lands inside the shell built for its role, with no switch-role panel", async (jump) => {
    const Shell = jump.role === "applicant" ? AppShell : CityShell;
    await renderScreen(<Shell>the page</Shell>, { scenario: jump.id });

    expect(screen.getByText("the page")).toBeInTheDocument();
    expect(screen.queryByText(/This screen is built for/)).not.toBeInTheDocument();
    expect(useDemo.getState().lastPathByRole[jump.role]).toBe(jump.path);
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

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
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

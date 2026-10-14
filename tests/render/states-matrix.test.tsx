/**
 * Workstream 4F's states matrix (plan 8, Phase 4; docs/plans/2026-10-12-permitopolis-prototype.md
 * section 8): every EMPTY, ERROR and EDGE cell the brief names, each with its own render test,
 * across My queue, the Cases board and table, Intake, the case detail and Active permits.
 *
 * Several cells are already covered where the screen was built (tests/render/city-lists.test.tsx,
 * case-detail.test.tsx, active.test.tsx); this file is the one place every cell in the brief's
 * matrix has a test of its own, so the matrix itself can be read off the describe blocks below.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CityShell } from "@/components/shell";
import { QueueScreen } from "@/components/city/lists/QueueScreen";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { ActiveScreen } from "@/components/active/ActiveScreen";
import { BoardScreen } from "@/components/board/BoardScreen";
import { addDaysISO } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY, STORAGE_KEY } from "@/lib/rules";
import { buildSeed, isStalled, sessionDates, useDemo } from "@/lib/state";
import { seedFingerprint } from "@/lib/state/seed";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import type { EventCase } from "@/lib/types";
import { flushHydration, lastPush, prepareScreen, renderScreen, storedCase } from "./harness";

const TODAY = DEFAULT_DEMO_TODAY; // Mon, May 3, 2027

// Real seeded cases used as edge/error fixtures throughout (lib/state/seed/background, scenarios).
const S2_DRAFT = "PMT-27-0142"; // Sunrise Yoga Club: Instant series, still a Draft
const S4 = "PMT-27-0126"; // Maple Street block party: Submitted, three sign-offs short
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: holds its date, Health & Legal re-verifying
const B05_LONG_NAME = "PMT-27-0012"; // St. Agnes Parish...: 90+ char name, lead-time risk
const B06_COMMISSION = "PMT-27-0014"; // Permitopolis Rotary Club charity gala: sent to commission
const B16_SERIES = "PMT-27-0034"; // Riverside Tai Chi Circle: weekly, 20+ sessions, Event day
const DENIED = "PMT-27-0046"; // Redline Motorsports Expo
const WITHDRAWN = "PMT-27-0048"; // Sunnyvale Block Association summer kickoff
const CANCELLED = "PMT-27-0050"; // Evergreen Wedding Planners reception
const HOLD_EXPIRED = "PMT-27-0052"; // North Permitopolis Chamber mixer

function longOrgCase(overrides: Partial<EventCase> = {}): EventCase {
  // The 90-character name the seed's own stress row carries (B05's LONG_NAME), reused here so
  // every surface's long-name handling is checked against a name actually this long, not an
  // approximation.
  return makeCase({
    id: "PMT-27-0600",
    name: "St. Agnes Parish Annual Multicultural Heritage Festival, Craft Fair and Community Potluck Celebration",
    applicantId: "permitopolis-metro-interfaith-council", // the seed's 60+ char organization name
    state: "in_review",
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

/* ========================================================================== */
/* EMPTY                                                                      */
/* ========================================================================== */

describe("EMPTY: a role with nothing in its queue", () => {
  it("My queue shows 'Nothing is waiting on you', not a blank list", async () => {
    await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue(), cases: [] });
    expect(screen.getByText("Nothing is waiting on you")).toBeInTheDocument();
    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
  });

  it("names the cases waiting on other parties instead of saying nothing at all", async () => {
    // One case, and the move on it is the applicant's: the Clerk has nothing, and is told who has.
    const theirs = makeCase({
      id: "PMT-27-0608",
      name: "Somebody else's move fair",
      state: "in_review",
      tasks: [makeTask({ id: "PMT-27-0608:insurance_certificate", catalogId: "insurance_certificate", title: "Certificate of insurance" })],
    });
    const { user } = await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue(), cases: [theirs] });

    expect(screen.getByText("Nothing is waiting on you. 1 case is with other parties.")).toBeInTheDocument();
    await user.click(screen.getByText("Waiting on others (1)"));
    // Who has it, and for how long: the applicant, since today.
    const chips = screen.getByRole("link", { name: /Somebody else's move fair/ }).querySelector('[data-slot="waiting-on-chips"]');
    expect(chips).toHaveTextContent(/Applicant/);
    expect(chips).toHaveTextContent("0d");
    // It opens the case, with the queue to come back to.
    expect(screen.getByRole("link", { name: /Somebody else's move fair/ })).toHaveAttribute("href", routes.city.case(theirs.id, { from: routes.city.queue() }));
  });
});

describe("EMPTY: filters with no result, and Clear filters", () => {
  it("the Cases board and table both show it, and Clear filters restores the list", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ tier: "instant" }) });
    await user.type(screen.getByRole("searchbox", { name: "Search cases" }), "no such event");
    const emptyState = screen.getByText("No cases match").closest('[data-slot="empty-state"]') as HTMLElement;
    expect(emptyState).toBeInTheDocument();
    await user.click(within(emptyState).getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("No cases match")).not.toBeInTheDocument();
  });
});

describe("EMPTY: an empty pipeline column", () => {
  it("a state with no case still shows its column, with 'Nothing here'", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ waiting: "hl" }) });
    // At load, no case is waiting on Health & Legal in every one of the seven columns; at
    // least one of them is empty and still drawn.
    expect(screen.getAllByText("Nothing here").length).toBeGreaterThan(0);
  });
});

describe("EMPTY: an empty Intake tab", () => {
  it("every tab (Special, Standard, Instant exceptions) has its own empty message", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake(), cases: [] });
    expect(screen.getByText("Nothing waiting")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Standard/ }));
    expect(screen.getByText("Nothing waiting")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Instant exceptions/ }));
    expect(screen.getByText("Nothing to resolve")).toBeInTheDocument();
  });
});

describe("EMPTY: a case with nothing in Documents, Conditions and fees, or Activity beyond its start", () => {
  const bare = makeCase({
    id: "PMT-27-0601",
    name: "Bare-bones draft",
    state: "submitted",
    activity: [{ at: `${TODAY}T09:00`, actor: "applicant", text: "Started a draft." }],
  });

  it("Documents reads 'No documents yet'", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(bare.id, { tab: "documents" }), cases: [bare] });
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });

  it("Conditions and fees reads 'No conditions or fees yet'", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(bare.id, { tab: "conditions" }), cases: [bare] });
    expect(screen.getByText("No conditions or fees yet")).toBeInTheDocument();
  });

  it("Activity shows only the one entry the case was born with", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(bare.id, { tab: "activity" }), cases: [bare] });
    expect(screen.getByText("Started a draft.")).toBeInTheDocument();
    expect(screen.getByText("1 of 1 entries")).toBeInTheDocument();
  });
});

describe("EMPTY: a day with no active permits", () => {
  it("the list says so, and offers to include held dates", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), cases: [] });
    expect(screen.getByText("No active permits")).toBeInTheDocument();
    expect(screen.getByText(/Try including held dates/)).toBeInTheDocument();
  });
});

/* ========================================================================== */
/* ERROR                                                                      */
/* ========================================================================== */

describe("ERROR: an unknown case id", () => {
  it("the case detail shows Case not found, not a crash", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: "/city/cases/PMT-27-9999" });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("ERROR: a Draft's id opened by a city role", () => {
  it("explains that drafts are not visible to the city, with no action panel", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(S2_DRAFT) });
    expect(screen.getByText("This application is still a draft")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Your actions" })).not.toBeInTheDocument();
  });
});

describe("ERROR: localStorage blocked", () => {
  it("shows the banner, and the screen still works entirely in memory", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });

    const { user } = await renderScreen(
      <CityShell>
        <QueueScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.queue() },
    );

    expect(screen.getByText(/Your browser is blocking storage/)).toBeInTheDocument();
    // The queue still renders and still works entirely in memory: clicking a row does not
    // throw, and still navigates as it would with storage available.
    const link = screen.getAllByRole("link").find((a) => a.hasAttribute("data-row-nav"));
    expect(link).toBeDefined();
    await user.click(link!);
    expect(lastPush()).toMatch(/^\/city\/cases\//);
  });
});

describe("ERROR: localStorage holding a demo from an older build", () => {
  it("is dropped quietly: the fresh seed loads, no crash, and the mismatch is replaced", async () => {
    prepareScreen({ role: "clerk", path: routes.city.queue() });
    // What an earlier build's engine would have saved: a different seed fingerprint, and a
    // shape this build's state may not even recognize.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { role: "clerk", demoToday: "2027-01-01", cases: [{ id: "not-a-real-case" }] }, version: seedFingerprint() + 1 }),
    );

    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(<QueueScreen />);
    });
    await flushHydration();

    expect(useDemo.getState().cases).toHaveLength(38);
    expect(useDemo.getState().demoToday).toBe(TODAY);
    result?.unmount();
  });
});

describe("ERROR: localStorage holding a hand-corrupted value", () => {
  it("is dropped quietly: the fresh seed loads, no crash", async () => {
    prepareScreen({ role: "clerk", path: routes.city.queue() });
    window.localStorage.setItem(STORAGE_KEY, "{this is not valid json at all");

    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(<QueueScreen />);
    });
    await flushHydration();

    expect(useDemo.getState().cases).toHaveLength(38);
    expect(screen.getByText("Downtown Art Walk")).toBeInTheDocument(); // the Clerk's queue, as the real seed opens it
    result?.unmount();
  });
});

describe("ERROR: an action refused by the engine", () => {
  it("shows the engine's own reason in the panel, and nothing is lost", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: "issue_permit" }), role: "clerk" });
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Issue permit" })).toBeDisabled();
    expect(dialog.getByText(/Needs:/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    // Nothing lost: the case is exactly as it was.
    expect(storedCase(S5).state).toBe("quote_sent");
  });

  it("a choice made in an open panel that the engine refuses: routing without the department a card names", async () => {
    // S4 with its last three sign-offs in and accepted: Confirm routing is open to the Clerk.
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4), role: "clerk" });
    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      for (let i = 0; i < 3; i++) dispatch(S4, { type: "simulate_signoff" }, "neighbor");
      dispatch(S4, { type: "accept_complete" }, "clerk");
    });
    await user.click(within(screen.getByLabelText("Your actions")).getByRole("button", { name: "Confirm routing" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Confirm routing" })).toBeEnabled();
    const before = storedCase(S4);

    // An enabled control, used: Health & Legal is taken off the list. The engine refuses that list.
    await user.click(dialog.getByRole("checkbox", { name: "Route to Health & Legal" }));
    expect(dialog.getByText('Route Health & Legal too: it checks "Certificate of insurance".')).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Confirm routing" })).toBeDisabled();
    // The panel's reason is the one a dispatch of that list gets, and the case is untouched by either.
    let refused: ReturnType<ReturnType<typeof useDemo.getState>["dispatch"]> | undefined;
    await act(async () => {
      refused = useDemo.getState().dispatch(S4, { type: "confirm_routing", reviewers: [{ dept: "pws", sections: ["City services request"], dueDate: "2027-05-17" }] }, "clerk");
    });
    expect(refused).toEqual({ ok: false, reason: 'Route Health & Legal too: it checks "Certificate of insurance".' });
    expect(storedCase(S4)).toEqual(before);

    // Put back, the same button goes through.
    await user.click(dialog.getByRole("checkbox", { name: "Route to Health & Legal" }));
    await user.click(dialog.getByRole("button", { name: "Confirm routing" }));
    expect(storedCase(S4).state).toBe("in_review");
  });

  it("a date typed into an open panel that the engine refuses: a walkthrough on Memorial Day", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: `schedule_meeting:${S5}:site_walkthrough` }), role: "pws" });
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Schedule" })).toBeEnabled();

    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2027-05-31" } });
    expect(dialog.getByText("That date is a citywide blackout.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Schedule" })).toBeDisabled();
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "site_walkthrough")?.payload.scheduledFor).toBe("2027-07-02");
  });
});

describe("ERROR: a deep link ?task= naming a task that no longer exists", () => {
  it("the sheet stays shut; the rest of the page renders normally", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: "PMT-27-0097:no-such-task" }), role: "clerk" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Riverfront Summer 5K" })).toBeInTheDocument();
  });
});

describe("ERROR: a deep link ?task= for a task that belongs to another role", () => {
  it("opens a reminder addressed to whoever actually holds it, not a crash or a blank sheet", async () => {
    // S5's insurance verify task belongs to Health & Legal; opened as the Clerk it resolves to
    // a reminder, exactly as a My queue row from another role's task would.
    const seedCase = buildSeed().find((c) => c.id === S5)!;
    const hlTask = seedCase.tasks.find((t) => t.catalogId === "verify:insurance_certificate");
    expect(hlTask).toBeDefined();
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: hlTask!.id }), role: "clerk" });
    expect(screen.getByRole("heading", { level: 2, name: "Send a reminder" })).toBeInTheDocument();
  });
});

/* ========================================================================== */
/* EDGE                                                                       */
/* ========================================================================== */

describe("EDGE: a 90-character event name and a 60-character organization name", () => {
  it("on a My queue row", async () => {
    const task = makeTask({ id: `${B05_LONG_NAME}:review:pws`, catalogId: "review:pws", owner: "pws", kind: "review" });
    const c = longOrgCase({ id: B05_LONG_NAME, tasks: [task] });
    await renderScreen(<QueueScreen />, { role: "pws", path: routes.city.queue(), cases: [c] });
    const truncated = screen.getAllByText(c.name)[0];
    expect(truncated).toHaveAttribute("title", c.name);
  });

  it("on a Cases board card, full text on hover and focus", async () => {
    const c = longOrgCase();
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases(), cases: [...buildSeed(), c] });
    const card = screen.getAllByText(c.name)[0];
    expect(card).toHaveAttribute("title", c.name);
  });

  it("on a table row, full text on hover and focus", async () => {
    const c = longOrgCase();
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }), cases: [c] });
    const nameCell = screen.getByText(c.name);
    expect(nameCell).toHaveAttribute("title", c.name);
    // The applicant name under it is truncated with its own title tooltip.
    const org = screen.getAllByTitle(/Interfaith Council/)[0];
    expect(org).toBeInTheDocument();
  });

  it("in full on the case header, not cut off", async () => {
    const c = longOrgCase();
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(c.id), cases: [c] });
    expect(screen.getByRole("heading", { level: 1, name: c.name })).toBeInTheDocument();
    expect(screen.getAllByText(/Interfaith Council/).length).toBeGreaterThan(0);
  });
});

describe("EDGE: missing fields read 'Not provided', or are left out when not applicable", () => {
  it("the Overview tab: a blank description and place read 'Not provided'; add-ons with none reads 'None', not 'Not provided'", async () => {
    const draft = makeCase({ id: "PMT-27-0602", description: "", location: null, schedule: null, attendance: null, state: "submitted" });
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(draft.id), cases: [draft] });
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("Active permits: a case with no location reads 'Not provided' in the Place column", async () => {
    const noPlace = makeCase({
      id: "PMT-27-0603",
      state: "permitted",
      location: null,
      schedule: { date: addDaysISO(TODAY, 5), start: "09:00", end: "11:00", occurrences: [] },
    });
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), cases: [noPlace] });
    expect(screen.getByText("Not provided")).toBeInTheDocument();
  });
});

describe("EDGE: a task overdue for each of the four parties", () => {
  it("the Clerk, Public Works & Safety and Health & Legal each have an overdue row in their own queue (the seed's own overdue rows)", async () => {
    for (const role of ["clerk", "pws", "hl"] as const) {
      const result = await renderScreen(<QueueScreen />, { role, path: routes.city.queue() });
      expect(screen.getByText("Overdue")).toBeInTheDocument();
      expect(document.querySelector('[data-overdue="true"]')).not.toBeNull();
      result.unmount();
    }
  });

  it("the applicant's own overdue card (B08's insurance, due Thu, Apr 29) is marked overdue on their board", async () => {
    const B08 = "PMT-27-0018"; // Westside Youth Soccer League spring tournament
    const b08 = buildSeed().find((c) => c.id === B08)!;
    const overdue = b08.tasks.find((t) => t.owner === "applicant" && t.dueDate !== null && t.dueDate < TODAY && (t.status === "todo" || t.status === "changes_requested"))!;
    expect(overdue).toMatchObject({ title: "Certificate of insurance", dueDate: "2027-04-29" });

    await renderScreen(<BoardScreen />, { role: "applicant", personaId: b08.applicantId, path: routes.event(B08) });
    const card = screen.getByRole("button", { name: /Certificate of insurance/ });
    const chip = card.querySelector('[data-overdue="true"]');
    expect(chip).not.toBeNull();
    expect(chip).toHaveTextContent(/Overdue/);
  });
});

describe("EDGE: a hold expiring tomorrow", () => {
  function expiringCase(): EventCase {
    return makeCase({
      id: "PMT-27-0604",
      name: "Expiring hold festival",
      state: "quote_sent",
      schedule: { date: addDaysISO(TODAY, 20), start: "09:00", end: "11:00", occurrences: [] },
      dateHold: { status: "held", placedOn: TODAY, expiresOn: addDaysISO(TODAY, 1) },
    });
  }

  it("flagged in the Active permits list", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), search: { holds: "1" }, cases: [expiringCase()] });
    expect(screen.getByText("Expires tomorrow")).toBeInTheDocument();
  });

  it("flagged on the case itself", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case("PMT-27-0604"), cases: [expiringCase()] });
    expect(screen.getByText(/date hold expires tomorrow/)).toBeInTheDocument();
  });
});

describe("EDGE: each off-path ending shows its reason banner and no actions but a note", () => {
  it.each([
    ["Denied", DENIED],
    ["Withdrawn", WITHDRAWN],
    ["Cancelled", CANCELLED],
    ["Hold expired", HOLD_EXPIRED],
  ])("%s", async (_label, id) => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(id) });
    const c = storedCase(id);
    expect(c.endingReason).not.toBeNull();
    expect(screen.getByText(c.endingReason!)).toBeInTheDocument();
    const actions = within(screen.getByRole("complementary", { name: "Your actions" }));
    expect(actions.getByRole("button", { name: "Add a note" })).toBeInTheDocument();
    expect(actions.queryAllByRole("button")).toHaveLength(1);
  });
});

describe("EDGE: a series of 20 or more sessions, collapsed with a count", () => {
  it("B16 (Riverside Tai Chi Circle) collapses to one row with '+N more'", async () => {
    const total = sessionDates(storedCase(B16_SERIES)).length;
    expect(total).toBeGreaterThanOrEqual(20);
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });
    expect(screen.getAllByText(`+${total - 1} more`).length).toBeGreaterThan(0);
  });
});

describe("EDGE: two applications competing for one space and date", () => {
  it("names both: the later row names the one that is complete first", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    await user.click(screen.getByRole("tab", { name: /Standard/ }));
    const row = within(screen.getByText("Plaza wedding photos").closest("tr")!);
    expect(row.getAllByText(/Jazz in the Plaza/).length).toBeGreaterThan(0);
    expect(row.getByText(/complete first/)).toBeInTheDocument();
  });
});

describe("EDGE: a case sent to commission", () => {
  it("a marker on its pipeline board card", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    expect(screen.getByLabelText("Sent to commission")).toBeInTheDocument();
  });

  it("a marker on its pipeline table row", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }) });
    expect(screen.getByLabelText("Sent to commission")).toBeInTheDocument();
  });

  it("a banner on the case itself", async () => {
    await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(B06_COMMISSION) });
    expect(screen.getByText("This case has been sent to the commission.")).toBeInTheDocument();
  });
});

describe("EDGE: lead-time risk", () => {
  it("the red flag shows on the pipeline table for a case running short on time (B05)", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }) });
    const row = screen.getAllByText(/St\. Agnes/)[0].closest("tr") as HTMLElement;
    expect(within(row).getByText("Lead-time risk")).toBeInTheDocument();
  });
});

describe("EDGE: a case nobody is up on after Permitted", () => {
  it("is quiet, not an error: no Stalled chip, no red styling, once the case is past Permitted", async () => {
    const permitted = makeCase({ id: "PMT-27-0605", state: "permitted", schedule: { date: addDaysISO(TODAY, 10), start: "09:00", end: "11:00", occurrences: [] } });
    expect(isStalled(permitted, TODAY)).toBe(false); // isStalled only ever flags before Permitted
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), cases: [permitted] });
    expect(screen.queryByText("Stalled")).not.toBeInTheDocument();
  });
});

/* ========================================================================== */
/* The Stalled chip itself (development builds only)                         */
/* ========================================================================== */

describe("the Stalled chip", () => {
  it("the real seed shows none: every case before Permitted has somebody up", () => {
    const seed = buildSeed();
    const stalled = seed.filter((c) => isStalled(c, TODAY));
    expect(stalled).toEqual([]);
  });

  it("a hand-built stalled case (before Permitted, nobody up) is flagged on the case and in the queue's 'Waiting on others' list", async () => {
    const stalledCase = makeCase({ id: "PMT-27-0606", name: "Nobody is up event", state: "in_review", reviews: [] });
    expect(isStalled(stalledCase, TODAY)).toBe(true);

    const onCase = await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(stalledCase.id), cases: [stalledCase] });
    expect(screen.getByText("Stalled")).toBeInTheDocument();
    onCase.unmount();

    // The queue: nobody is up on it, and it is still listed, because that is the bug the chip is for.
    const { user } = await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue(), cases: [stalledCase] });
    await user.click(screen.getByText("Waiting on others (1)"));
    expect(within(screen.getByRole("link", { name: /Nobody is up event/ })).getByText("Stalled")).toBeInTheDocument();
  });

  it("never shown in a production build", async () => {
    const stalledCase = makeCase({ id: "PMT-27-0607", state: "in_review", reviews: [] });
    const original = process.env.NODE_ENV;
    // @ts-expect-error -- test-only override of a readonly-in-types env var.
    process.env.NODE_ENV = "production";
    try {
      await renderScreen(<CaseDetailScreen />, { role: "clerk", path: routes.city.case(stalledCase.id), cases: [stalledCase] });
      expect(screen.queryByText("Stalled")).not.toBeInTheDocument();
    } finally {
      // @ts-expect-error -- see above.
      process.env.NODE_ENV = original;
    }
  });
});

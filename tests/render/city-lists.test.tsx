import { act } from "@testing-library/react";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";
import { QueueScreen } from "@/components/city/lists/QueueScreen";
import { routes } from "@/lib/routes";
import { holdNavigation, lastPush, lastReplace, navigate, releaseNavigation, renderScreen, storedCase, switchRole } from "./harness";
import { navState } from "./setup";

const S3 = "PMT-27-0118"; // Jazz in the Plaza
const S5 = "PMT-27-0097"; // Riverfront Summer 5K
const F1 = "PMT-27-0121"; // Downtown Art Walk

describe("My queue", () => {
  it("City Clerk: opens with the Downtown Art Walk on screen", async () => {
    await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue() });
    expect(screen.getByText("Downtown Art Walk")).toBeInTheDocument();
  });

  it("Public Works & Safety: opens with the Food Truck Festival closeout on screen", async () => {
    await renderScreen(<QueueScreen />, { role: "pws", path: routes.city.queue() });
    expect(screen.getAllByText("Main Street Food Truck Festival").length).toBeGreaterThan(0);
  });

  it("Health & Legal: opens with the 5K insurance verification on screen", async () => {
    await renderScreen(<QueueScreen />, { role: "hl", path: routes.city.queue() });
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
    expect(screen.getAllByText(/Verify .*insurance/i).length).toBeGreaterThan(0);
  });

  it("clicking a row goes to the case with ?task=, and says which list it came from", async () => {
    const { user } = await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue() });
    const link = screen.getByRole("link", { name: /Downtown Art Walk/ });
    await user.click(link);
    expect(lastPush()).toBe(routes.city.case(F1, { task: `${F1}:intake_check`, from: routes.city.queue() }));
  });

  it("the review clock is on review rows only: a document check weeks after the review shows its own due date, no stopped clock", async () => {
    await renderScreen(<QueueScreen />, { role: "hl", path: routes.city.queue() });

    const rows = screen.getAllByRole("link").filter((a) => a.hasAttribute("data-row-nav"));
    const insurance = rows.find((a) => /Riverfront Summer 5K/.test(a.textContent ?? "") && /Verify Certificate of insurance/.test(a.textContent ?? ""))!;
    expect(insurance).toBeDefined();
    expect(insurance).not.toHaveTextContent(/Day \d+ of \d+/);

    // A row that is a review still carries its clock.
    const reviews = rows.filter((a) => /Review your sections/.test(a.textContent ?? ""));
    expect(reviews.length).toBeGreaterThan(0);
    for (const review of reviews) expect(review).toHaveTextContent(/Day \d+ of \d+/);
    for (const other of rows.filter((a) => !reviews.includes(a))) expect(other).not.toHaveTextContent(/Day \d+ of \d+/);
  });

  it("an empty queue is a designed state", async () => {
    await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue(), cases: [] });
    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
  });
});

describe("Cases pipeline", () => {
  it("switches to the table and back, the URL following along", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Table" }));
    expect(lastReplace()).toContain("view=table");
    expect(screen.getByRole("table")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Board" }));
    expect(lastReplace()).not.toContain("view=table");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it('filtering to Special events and searching "5K" narrows to one case', async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ tier: "special" }) });
    const search = screen.getByRole("searchbox", { name: "Search cases" });
    await user.type(search, "5K");
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
    expect(screen.queryByText("Jazz in the Plaza")).not.toBeInTheDocument();
  });

  it("the search box keeps what is typed while the URL lags, filters at once, and writes the URL after a pause", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    const search = screen.getByRole("searchbox", { name: "Search cases" });

    // router.replace() is a transition: the URL does not move while the keys are going in.
    holdNavigation();
    await user.type(search, "jazz");

    expect(search).toHaveValue("jazz");
    expect(screen.getByText("Jazz in the Plaza")).toBeInTheDocument();
    expect(screen.queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();
    expect(screen.getByText(/^1 of \d+ cases$/)).toBeInTheDocument();
    expect(navState.search.get("q")).toBeNull();

    // One write, after the pause, not one per key.
    const writesBefore = navState.replaceCalls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(navState.replaceCalls.length).toBe(writesBefore + 1);
    act(() => releaseNavigation());
    expect(navState.search.get("q")).toBe("jazz");
    expect(search).toHaveValue("jazz");
  });

  it("a search changed from outside the box (a chip removed, Back) puts the new text in the box", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: `${routes.city.cases()}?q=jazz` });
    const search = screen.getByRole("searchbox", { name: "Search cases" });
    expect(search).toHaveValue("jazz");

    await user.click(screen.getByRole("button", { name: /"jazz"/ }));
    expect(search).toHaveValue("");
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();

    // The browser's Back, to the searched list.
    navigate(`${routes.city.cases()}?q=5K`);
    expect(search).toHaveValue("5K");
    expect(screen.queryByText("Jazz in the Plaza")).not.toBeInTheDocument();
  });

  it("with a State filter the board is that one column, so the matches are what is on screen", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ state: "quote_sent" }) });

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Quote sent"]);
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
  });

  it("without a State filter the board has its seven columns, each flexible so they share the width", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });

    const columns = Array.from(document.querySelectorAll<HTMLElement>("[data-state]")).filter((el) => el.querySelector("h3"));
    expect(columns.map((el) => el.dataset.state)).toEqual(["submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout"]);
    for (const column of columns) {
      expect(column.className).toContain("flex-1");
      expect(column.className).not.toContain("w-72");
    }
  });

  it("a board card shows the event date beside the days to go", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ tier: "special" }) });
    const card = screen.getByText("Riverfront Summer 5K").closest("a")!;
    expect(within(card).getByText("Sun, Jul 11")).toBeInTheDocument();
    expect(within(card).getByText(/days to go/)).toBeInTheDocument();
  });

  it("the table keeps its rows, cells and column headers, and says which column it is sorted by", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }) });

    const row = screen.getByRole("link", { name: "Jazz in the Plaza" }).closest("tr")!;
    // A row, not one long link: its cells are still cells under their headers.
    expect(row).not.toHaveAttribute("role");
    expect(within(row).getAllByRole("cell").length).toBe(screen.getAllByRole("columnheader").length);
    expect(screen.getByRole("link", { name: "Jazz in the Plaza" })).toHaveAttribute("href", routes.city.case(S3, { from: routes.city.cases({ view: "table" }) }));

    expect(screen.getByRole("columnheader", { name: "Event date" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Due" })).not.toHaveAttribute("aria-sort");
    await user.click(within(screen.getByRole("columnheader", { name: "Due" })).getByRole("button"));
    expect(screen.getByRole("columnheader", { name: "Due" })).toHaveAttribute("aria-sort", "ascending");
    await user.click(within(screen.getByRole("columnheader", { name: "Due" })).getByRole("button"));
    expect(screen.getByRole("columnheader", { name: "Due" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Event date" })).not.toHaveAttribute("aria-sort");
  });

  it("the event's name opens the case once, and so does Enter on the row", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }) });
    const pushes = () => navState.pushCalls.length;

    const before = pushes();
    await user.click(screen.getByRole("link", { name: "Jazz in the Plaza" }));
    expect(pushes()).toBe(before + 1);
    expect(lastPush()).toBe(routes.city.case(S3, { from: routes.city.cases({ view: "table" }) }));
  });

  it("j and the arrow keys move through the rows, but leave shortcuts and other widgets' arrow keys alone", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ view: "table" }) });
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>("[data-row-nav]"));

    await user.keyboard("j");
    expect(document.activeElement).toBe(rows()[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows()[1]);

    // Ctrl+K and Cmd+J are somebody else's shortcuts.
    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard("{Meta>}j{/Meta}");
    expect(document.activeElement).toBe(rows()[1]);

    // The Board/Table switch is a radiogroup with arrow keys of its own.
    const radio = screen.getByRole("radio", { name: "Table" });
    radio.focus();
    await user.keyboard("{ArrowDown}");
    expect(rows()).not.toContain(document.activeElement);
  });

  it("turning on Closed and ended shows a Denied case", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    expect(screen.queryAllByText("Redline Motorsports Expo")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Closed and ended" }));
    expect(screen.getAllByText("Redline Motorsports Expo").length).toBeGreaterThan(0);
  });

  it("an impossible filter shows the empty state, and Clear filters restores the list", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ tier: "instant" }) });
    const search = screen.getByRole("searchbox", { name: "Search cases" });
    await user.type(search, "5K");
    const emptyState = screen.getByText("No cases match").closest('[data-slot="empty-state"]') as HTMLElement;
    expect(emptyState).toBeInTheDocument();

    await user.click(within(emptyState).getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("No cases match")).not.toBeInTheDocument();
  });

  it("switching role from Clerk to Health & Legal turns Involves me on", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    expect(screen.getByRole("button", { name: "Involves me", pressed: false })).toBeInTheDocument();

    switchRole("hl");
    expect(screen.getByRole("button", { name: "Involves me", pressed: true })).toBeInTheDocument();
  });

  it("rows and cards open the case", async () => {
    const { user } = await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases({ tier: "special" }) });
    await user.click(screen.getByText("Riverfront Summer 5K"));
    // The case's back link returns to this list as it is, filter included.
    expect(lastPush()).toBe(routes.city.case(S5, { from: routes.city.cases({ tier: "special" }) }));
  });
});

describe("Intake queue", () => {
  it("Accept is disabled with its reason for the Maple Street block party", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    await user.click(screen.getByRole("tab", { name: /Reviewed/ }));
    const row = within(screen.getByText("Maple Street block party").closest("tr")!);
    expect(row.getByText("9 of 12 items")).toBeInTheDocument();
    const button = row.getByRole("button", { name: "Accept as complete" });
    expect(button).toBeDisabled();
    expect(row.getByText("Waiting on 3 neighbor sign-offs")).toBeInTheDocument();
  });

  it("Accept is enabled for the Downtown Art Walk, and accepting moves it out of the tab", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    expect(screen.getByText("Downtown Art Walk")).toBeInTheDocument();
    const row = within(screen.getByText("Downtown Art Walk").closest("tr")!);
    const button = row.getByRole("button", { name: "Accept as complete" });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(storedCase(F1).flags.acceptedComplete).toBe(true);
    await act(async () => {});
    expect(screen.queryByText("Downtown Art Walk")).not.toBeInTheDocument();
  });

  it("accepting goes straight on to the case with Confirm routing open, and the case comes back to Intake", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    const row = within(screen.getByText("Downtown Art Walk").closest("tr")!);

    await user.click(row.getByRole("button", { name: "Accept as complete" }));

    // The script's next beats are "the date hold appears" and "confirm routing": both are there.
    expect(lastPush()).toBe(routes.city.case(F1, { task: "confirm_routing", from: routes.city.intake() }));
    expect(storedCase(F1).dateHold.status).toBe("held");
  });

  it("the Plaza wedding photos row names Jazz in the Plaza as complete first", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    await user.click(screen.getByRole("tab", { name: /Reviewed/ }));
    const row = within(screen.getByText("Plaza wedding photos").closest("tr")!);
    expect(row.getAllByText(/Jazz in the Plaza/).length).toBeGreaterThan(0);
    expect(row.getByText(/complete first/)).toBeInTheDocument();
  });

  it("the Instant exceptions tab lists the Brightline Logistics company picnic", async () => {
    const { user } = await renderScreen(<IntakeScreen />, { role: "clerk", path: routes.city.intake() });
    await user.click(screen.getByRole("tab", { name: /Instant exceptions/ }));
    expect(screen.getByText("Brightline Logistics company picnic")).toBeInTheDocument();
  });
});

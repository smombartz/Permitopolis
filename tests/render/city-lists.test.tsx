import { act } from "@testing-library/react";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";
import { QueueScreen } from "@/components/city/lists/QueueScreen";
import { routes } from "@/lib/routes";
import { lastPush, lastReplace, renderScreen, storedCase, switchRole } from "./harness";

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

  it("clicking a row goes to the case with ?task=", async () => {
    const { user } = await renderScreen(<QueueScreen />, { role: "clerk", path: routes.city.queue() });
    const link = screen.getByRole("link", { name: /Downtown Art Walk/ });
    await user.click(link);
    expect(lastPush()).toBe(routes.city.case(F1, { task: `${F1}:intake_check` }));
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
    expect(lastPush()).toBe(routes.city.case(S5));
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

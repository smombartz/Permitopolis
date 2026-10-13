/**
 * Render tests for /city/map (workstream 5C), owned here along with lib/view/closures.ts.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityShell } from "@/components/shell/CityShell";
import { ClosuresMapScreen } from "@/components/city/closures/ClosuresMapScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { renderScreen, storedCase } from "./harness";

const S5 = "PMT-27-0097"; // Riverfront Summer 5K: held, Jul 11
const F5 = "PMT-27-0115"; // Plaza wedding photos: pending, Jun 18

/** The side list: a dense list of what is on the map, scoped to avoid the map's own SVG labels and its own built-in list. */
function sideList() {
  return within(screen.getByRole("list", { name: "What is on the map" }));
}

describe("/city/map", () => {
  it("Jul 11 lists the 5K route as held, from the seed", async () => {
    await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=day&from=2027-07-11` });

    expect(screen.getByRole("heading", { name: "Closures and routes" })).toBeInTheDocument();
    const row = sideList().getByText("Riverfront Summer 5K").closest("a");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Date held")).toBeInTheDocument();
  });

  it("reads permitted once the case is, through the store", async () => {
    await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=day&from=2027-07-11` });

    act(() => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S5, { type: "verify_document", taskId: `${S5}:insurance_certificate` }, "hl");
      dispatch(S5, { type: "accept_and_sign", signature: "Simone Dubois" }, "applicant");
      dispatch(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant");
      dispatch(S5, { type: "issue_permit" }, "clerk");
    });

    const row = sideList().getByText("Riverfront Summer 5K").closest("a");
    expect(within(row as HTMLElement).getByText("Permitted")).toBeInTheDocument();
  });

  it("the week of Jun 14 shows the Plaza overlap first, naming both events and the shared space", async () => {
    await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=week&from=2027-06-14` });

    const overlaps = within(screen.getByRole("region", { name: "Overlaps" }));
    expect(overlaps.getByText(/City Hall Plaza: .+ and .+\./)).toBeInTheDocument();
    expect(sideList().getByText("Plaza wedding photos")).toBeInTheDocument();
    expect(sideList().getByText("Jazz in the Plaza")).toBeInTheDocument();
    // Both overlapping rows are flagged in the main list too.
    expect(sideList().getAllByText("Overlap")).toHaveLength(2);
  });

  it("clicking a day on the calendar strip narrows the map to it", async () => {
    const { user } = await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=week&from=2027-06-14` });

    const days = within(screen.getByRole("list", { name: "Days in range" }));
    await user.click(days.getByRole("button", { name: /Jun 18/ }));
    expect(sideList().queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();
    expect(sideList().getByText("Plaza wedding photos")).toBeInTheDocument();
  });

  it("'Street closures only' drops the Plaza's occupied space, leaving nothing that week", async () => {
    const { user } = await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=week&from=2027-06-14` });

    await user.click(screen.getByRole("button", { name: "Street closures only" }));
    expect(screen.queryByText(F5)).not.toBeInTheDocument();
    expect(screen.queryByText("Plaza wedding photos")).not.toBeInTheDocument();
    expect(screen.queryByText("Jazz in the Plaza")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing on the map")).toBeInTheDocument();
  });

  it("a status filter narrows the list to one status", async () => {
    const { user } = await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=week&from=2027-06-14` });

    await user.click(screen.getByRole("button", { name: "Pending review" }));
    expect(sideList().queryByText("Jazz in the Plaza")).not.toBeInTheDocument();
    expect(sideList().getByText("Plaza wedding photos")).toBeInTheDocument();
  });

  it("is empty for a range with nothing booked, held or pending", async () => {
    await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=day&from=2028-01-01` });

    expect(screen.getByText("Nothing in this range")).toBeInTheDocument();
    expect(screen.getByText("Nothing on the map")).toBeInTheDocument();
  });

  it("a row opens its case", async () => {
    const { user } = await renderScreen(<ClosuresMapScreen />, { role: "pws", path: `${routes.city.map()}?mode=day&from=2027-07-11` });

    await user.click(sideList().getByRole("link", { name: /Riverfront Summer 5K/ }));
    expect(storedCase(S5).id).toBe(S5);
  });

  it("another city role sees the shell's built-for panel, not the screen", async () => {
    await renderScreen(
      <CityShell>
        <ClosuresMapScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.map() },
    );

    expect(screen.getByText("This screen is built for Public Works & Safety.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Closures and routes" })).not.toBeInTheDocument();
  });
});

/**
 * Render tests for /city/active (workstream 3G), owned here along with lib/view/active.ts.
 * Mounted directly, as CityShell would show it to each of the three city roles.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActiveScreen } from "@/components/active/ActiveScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { navigate, renderScreen, storedCase, switchRole } from "./harness";

const S2 = "PMT-27-0142"; // Sunrise Yoga Club: Instant series, Draft until booked (demo path 1)
const S5_NAME = "Riverfront Summer 5K";
const S6_NAME = "Main Street Food Truck Festival";

describe("Active permits: the shared list", () => {
  it("shows Maya Chen's picnic and Little League, and names today's tai chi session on the day strip", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });

    expect(screen.getByRole("heading", { name: "Active permits" })).toBeInTheDocument();
    expect(screen.getByText("Maya Chen's 40th birthday picnic")).toBeInTheDocument();
    expect(screen.getByText("Little League Opening Day")).toBeInTheDocument();
    expect(screen.getByText("Mon, May 3: 1 event today")).toBeInTheDocument();
    expect(screen.getAllByText(/Tai Chi/).length).toBeGreaterThan(0);

    // Riverfront Summer 5K only holds its date so far; it stays off the list by default.
    expect(screen.queryByText(S5_NAME)).not.toBeInTheDocument();
  });

  it("demo path 1: booking the S2 series through the store puts every June Sunday on the calendar", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({ view: "calendar", date: "2027-06-07" }) });

    expect(screen.queryByText("Sunrise Yoga Club weekly class")).not.toBeInTheDocument();

    act(() => {
      useDemo.getState().dispatch(S2, { type: "book_and_pay", method: "card" }, "applicant");
    });

    const sundays = screen.getAllByText("Sunrise Yoga Club weekly class");
    // Jun 6, 13, 20 and 27 are the four Sundays the June grid shows.
    expect(sundays.length).toBe(4);
    expect(storedCase(S2).state).toBe("permitted");
  });

  it('"Include held dates" adds the 5K as held, and the Map then lists its route on Jul 11', async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });

    expect(screen.queryByText(S5_NAME)).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Include held dates" }));

    const row = screen.getByText(S5_NAME).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(/Date held/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Map" }));
    navigate(`${routes.city.active({ view: "map", date: "2027-07-11" })}&holds=1`);

    expect(screen.getAllByText(S5_NAME).length).toBeGreaterThan(0);
  });

  it("a day with nothing booked or held shows the empty state on the Map", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({ view: "map", date: "2027-05-20" }) });

    expect(screen.getByText("Nothing booked or held")).toBeInTheDocument();
  });

  it("the Closeout tab lists the Food Truck Festival, held by Public Works & Safety", async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });

    await user.click(screen.getByRole("tab", { name: "Closeout" }));

    expect(screen.getByText(S6_NAME)).toBeInTheDocument();
    expect(screen.getAllByText("Public Works & Safety").length).toBeGreaterThan(0);
  });

  it("switching role to Public Works & Safety shows the work-orders overlay", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });
    expect(screen.getByRole("columnheader", { name: "Compliance log" })).toBeInTheDocument();

    switchRole("pws");

    expect(screen.getByRole("columnheader", { name: "Work orders" })).toBeInTheDocument();
  });
});

describe("Active permits: every city role can reach it", () => {
  it.each(["clerk", "pws", "hl"] as const)("renders for %s without crashing", async (role) => {
    await renderScreen(<ActiveScreen />, { role, path: routes.city.active() });
    expect(screen.getByRole("heading", { name: "Active permits" })).toBeInTheDocument();
  });
});

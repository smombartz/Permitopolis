/**
 * Render tests for /city/active (workstream 3G), owned here along with lib/view/active.ts.
 * Mounted directly, as CityShell would show it to each of the three city roles.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActiveScreen } from "@/components/active/ActiveScreen";
import { addDaysISO } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { lastPush, navigate, renderScreen, storedCase, switchRole } from "./harness";
import { navState } from "./setup";

const TODAY = DEFAULT_DEMO_TODAY;

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

describe("Active permits: choosing a day", () => {
  const dayButton = (name: RegExp) => within(screen.getByRole("list", { name: "Today and the next 7 days" })).getByRole("button", { name });

  it("a day in the Today strip opens that day's map: never a click that changes nothing", async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active() });
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");

    await user.click(dayButton(/^Sat, May 8/));

    expect(navState.search.get("view")).toBe("map");
    expect(navState.search.get("date")).toBe("2027-05-08");
    expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Sat, May 8, 2027")).toBeInTheDocument();
    // The strip marks the day the map is on.
    expect(dayButton(/^Sat, May 8/)).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(/^Mon, May 3/)).toHaveAttribute("aria-pressed", "false");
  });

  it("the Map's date field goes straight to Jul 11, where the 5K's route is", async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: `${routes.city.active({ view: "map" })}&holds=1` });
    expect(screen.queryAllByText(S5_NAME)).toHaveLength(0);

    const field = screen.getByLabelText("Go to a date");
    expect(field).toHaveValue("2027-05-03");
    fireEvent.change(field, { target: { value: "2027-07-11" } });

    expect(navState.search.get("date")).toBe("2027-07-11");
    expect(screen.getByText("Sun, Jul 11, 2027")).toBeInTheDocument();
    expect(screen.getAllByText(S5_NAME).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(navState.search.get("date")).toBeNull();
  });

  it("a day clicked in the month grid is marked as the chosen one", async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({ view: "calendar" }) });
    const grid = screen.getByRole("tabpanel");

    // A day's name is its whole date, not the "11" its cell shows.
    const eleventh = within(grid).getByRole("button", { name: /^Tue, May 11, 2027/ });
    expect(eleventh).toHaveAttribute("aria-pressed", "false");
    await user.click(eleventh);

    expect(navState.search.get("date")).toBe("2027-05-11");
    const pressed = within(screen.getByRole("tabpanel")).getAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("11");
    expect(pressed[0].className).toContain("ring-2");
  });
});

describe("Active permits: the role overlay's side panel", () => {
  it("Health & Legal on the Calendar: 25 of 25 vendor permits, the active permits' own, not 25 of 52", async () => {
    await renderScreen(<ActiveScreen />, { role: "hl", path: routes.city.active({ view: "calendar" }) });

    expect(screen.getByText("25 of 25")).toBeInTheDocument();
    expect(screen.queryByText("25 of 52")).not.toBeInTheDocument();
  });

  it("Public Works & Safety on the Map: the work orders of the permits on show", async () => {
    await renderScreen(<ActiveScreen />, { role: "pws", path: routes.city.active({ view: "map" }) });

    const panel = within(document.querySelector('[data-slot="sticky-aside"]') as HTMLElement);
    expect(panel.getByText("Done").nextElementSibling).toHaveTextContent("7");
    expect(panel.getByText("3 closures and 3 walkthroughs scheduled.")).toBeInTheDocument();
  });
});

describe("Active permits: a hold expiring tomorrow", () => {
  function heldCase() {
    return makeCase({
      id: "PMT-27-0700",
      name: "Expiring hold picnic",
      state: "quote_sent",
      schedule: { date: addDaysISO(TODAY, 30), start: "09:00", end: "11:00", occurrences: [] },
      dateHold: { status: "held", placedOn: TODAY, expiresOn: addDaysISO(TODAY, 1) },
    });
  }

  it("is flagged in the list once held dates are included", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({}), search: { holds: "1" }, cases: [heldCase()] });

    expect(screen.getByText("Expires tomorrow")).toBeInTheDocument();
  });

  it("is not flagged when the hold expires further out", async () => {
    const further = heldCase();
    further.dateHold.expiresOn = addDaysISO(TODAY, 10);
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({}), search: { holds: "1" }, cases: [further] });

    expect(screen.queryByText("Expires tomorrow")).not.toBeInTheDocument();
  });
});

describe("Active permits: meetings and walkthroughs", () => {
  const CAL_JUNE = routes.city.active({ view: "calendar", date: "2027-06-15" });
  // The accessible name runs the screen-reader prefix and the label together, as for every calendar item ("Instant:Riverside Tai Chi ...").
  const MEETING = /^Meeting: ?Coordination meeting: Riverfront Summer 5K/;

  /** The calendar grid's own cell for a day: the day's button, then its items. */
  function dayCell(dayOfMonth: string): HTMLElement {
    const grid = document.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
    // A day's name is its whole date ("Mon, Jun 21, 2027, 2 events"); these tests are all in June 2027.
    const day = within(grid).getByRole("button", { name: new RegExp(`^\\w{3}, Jun ${dayOfMonth}, 2027`) });
    return day.parentElement as HTMLElement;
  }

  it("the calendar for June 2027 draws S5's coordination meeting in the cell of its day, Mon, Jun 21, as a meeting, for each city role", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: CAL_JUNE });

    const meeting = within(dayCell("21")).getByRole("button", { name: MEETING });
    // A meeting is not an event: it carries its own mark and outline, and its tooltip says who attends.
    expect(meeting).toHaveAttribute("data-kind", "meeting");
    expect(meeting).toHaveAttribute("title", "Meeting: Coordination meeting · Riverfront Summer 5K · Applicant, City Clerk, Public Works & Safety");
    expect(screen.getByText("Meeting or walkthrough")).toBeInTheDocument();
    // No other day has it.
    expect(screen.getAllByRole("button", { name: MEETING })).toHaveLength(1);

    switchRole("pws");
    expect(within(dayCell("21")).getByRole("button", { name: MEETING })).toBeInTheDocument();

    switchRole("hl");
    expect(within(dayCell("21")).getByRole("button", { name: MEETING })).toBeInTheDocument();
  });

  it("the day is the one the case holds: rescheduling the meeting on the case moves it on the calendar", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: CAL_JUNE });
    expect(within(dayCell("21")).getByRole("button", { name: MEETING })).toBeInTheDocument();

    act(() => {
      expect(useDemo.getState().dispatch("PMT-27-0097", { type: "schedule_meeting", taskId: "PMT-27-0097:coordination_meeting", date: "2027-06-24" }).ok).toBe(true);
    });

    expect(within(dayCell("21")).queryByRole("button", { name: MEETING })).not.toBeInTheDocument();
    expect(within(dayCell("24")).getByRole("button", { name: MEETING })).toBeInTheDocument();
  });

  it("the week view draws it too", async () => {
    await renderScreen(<ActiveScreen />, { role: "pws", path: routes.city.active({ view: "calendar", date: "2027-06-21" }), search: { cal: "week" } });
    expect(screen.getByRole("button", { name: MEETING })).toHaveAttribute("data-kind", "meeting");
  });

  it('"Show meetings" is on by default and takes the meetings off the calendar once turned off', async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: CAL_JUNE });
    expect(screen.getByRole("switch", { name: "Show meetings" })).toBeChecked();
    expect(screen.getByRole("button", { name: MEETING })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Show meetings" }));

    expect(navState.search.get("meetings")).toBe("0");
    expect(screen.queryByRole("button", { name: MEETING })).not.toBeInTheDocument();
    expect(screen.queryByText("Meeting or walkthrough")).not.toBeInTheDocument();
  });

  it("clicking a meeting opens its case", async () => {
    const { user } = await renderScreen(<ActiveScreen />, { role: "clerk", path: CAL_JUNE });

    await user.click(screen.getByRole("button", { name: MEETING }));

    expect(lastPush()).toBe(routes.city.case("PMT-27-0097", { from: CAL_JUNE }));
  });

  it("the Today strip has a meeting inside its own 8 days in that day's column, and does not count it as an event", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), demoToday: "2027-06-20" });

    const strip = within(screen.getByRole("list", { name: "Today and the next 7 days" }));
    const day = strip.getByRole("button", { name: /^Mon, Jun 21:/ }).parentElement as HTMLElement;
    expect(within(day).getByRole("button", { name: MEETING })).toHaveAttribute("data-kind", "meeting");
    // That Monday has a tai chi session and the meeting: one event, counted as one.
    expect(within(day).getAllByRole("button")).toHaveLength(3);
    expect(strip.getByRole("button", { name: "Mon, Jun 21: 1 event" })).toBeInTheDocument();
  });

  it("a week with no meeting shows none", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active(), demoToday: "2027-01-01" });

    expect(document.querySelector('[data-kind="meeting"]')).toBeNull();
  });
});

describe("Active permits: the Clerk's day-of contact duty", () => {
  it("names the event on the chosen day, in the Calendar side panel", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({ view: "calendar" }) });

    const panel = within(document.querySelector('[data-slot="sticky-aside"]') as HTMLElement);
    expect(panel.getByText(/Day-of contact duty/)).toBeInTheDocument();
    // Mon, May 3 is a Tai Chi session day (today's own event on the Today strip).
    expect(panel.getByText(/Tai Chi/)).toBeInTheDocument();
  });

  it("reads \"No event that day\" for a day with nothing on", async () => {
    await renderScreen(<ActiveScreen />, { role: "clerk", path: routes.city.active({ view: "calendar", date: "2027-05-20" }) });

    const panel = within(document.querySelector('[data-slot="sticky-aside"]') as HTMLElement);
    expect(panel.getByText("No event that day.")).toBeInTheDocument();
  });
});

describe("Active permits: every city role can reach it", () => {
  it.each(["clerk", "pws", "hl"] as const)("renders for %s without crashing", async (role) => {
    await renderScreen(<ActiveScreen />, { role, path: routes.city.active() });
    expect(screen.getByRole("heading", { name: "Active permits" })).toBeInTheDocument();
  });
});

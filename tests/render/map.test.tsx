import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapDevScreen } from "@/components/map/MapDevScreen";
import { MapThumbnail } from "@/components/map/MapThumbnail";
import { PermitopolisMap } from "@/components/map/PermitopolisMap";
import { buildSeed } from "@/lib/state";

describe("MapDevScreen", () => {
  it("mounts without throwing, with all four picker modes, the display map and the calendars", () => {
    render(<MapDevScreen />);

    expect(screen.getByRole("heading", { name: "Map and calendar dev checkpoint" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bookable spaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draw an area" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Street segments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draw a route" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PermitopolisMap" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MapThumbnail" })).toBeInTheDocument();
    // The 5K route (drawn once on the map and once in its legend) and an overlapping
    // Shelter 3 booking are both in the sample highlights.
    expect(screen.getAllByText("Riverfront Summer 5K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overlap").length).toBeGreaterThan(0);
  });

  it("selects Shelter 3 through the keyboard list beside the map and shows its label and capacity", async () => {
    const user = userEvent.setup();
    render(<MapDevScreen />);

    // The "Bookable spaces" demo starts on the inventory tab; its list is keyboard-operable
    // buttons. Anchored so it doesn't also match the map's "...Shelter 3 (overlap)" entry.
    const shelterButton = screen.getByRole("button", { name: /^Shelter 3/ });
    expect(shelterButton).toHaveAttribute("aria-pressed", "false");

    await user.click(shelterButton);

    expect(shelterButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/"label":"Shelter 3, Riverside Park"/)).toBeInTheDocument();
    expect(screen.getByText(/"capacity":60/)).toBeInTheDocument();
  });

  it("marks the residential block in the street segments list", () => {
    render(<MapDevScreen />);
    expect(screen.getAllByText("Residential").length).toBeGreaterThan(0);
  });
});

describe("Phase 1 review fix: tier is never a dot alone", () => {
  it("gives the display map a legend naming every tier", () => {
    render(<MapDevScreen />);
    const legend = screen.getByRole("list", { name: "Map legend: tiers" });
    expect(legend).toHaveTextContent("Instant");
    expect(legend).toHaveTextContent("Reviewed");
    expect(legend).toHaveTextContent("Special event");
  });

  it("shows the tier as visible text next to the dot in the PermitopolisMap list, not screen-reader only", () => {
    render(<MapDevScreen />);
    const list = screen.getByRole("list", { name: "Highlighted bookings and closures" });
    const row = within(list).getByRole("button", { name: /Riverfront Summer 5K/ });
    // A visible label, with no sr-only wrapper hiding it.
    expect(row.querySelector(".sr-only")).toBeNull();
    expect(row).toHaveTextContent("Special event");
  });

  it("shows the tier as visible text in MapThumbnail's caption", () => {
    render(<MapDevScreen />);
    const heading = screen.getByRole("heading", { name: "MapThumbnail" });
    const figure = heading.closest("section")?.querySelector("figure");
    expect(figure).not.toBeNull();
    expect(figure?.querySelector(".sr-only")).toBeNull();
    expect(figure).toHaveTextContent("Instant");
  });

  it("MapThumbnail draws a route that runs the same segments more than once (Four Bridges Ultra's four laps) without a duplicate-key error", () => {
    const ultra = buildSeed().find((c) => c.name === "Four Bridges Ultra")!;
    const segments = ultra.location!.segmentIds;
    expect(new Set(segments).size).toBeLessThan(segments.length);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container } = render(<MapThumbnail highlight={{ id: ultra.id, location: ultra.location!, status: "permitted", tier: ultra.tier, label: ultra.location!.label }} />);
      // Every lap is drawn.
      expect(container.querySelectorAll("svg > line").length).toBeGreaterThanOrEqual(segments.length);
      expect(errors.mock.calls.map((call) => String(call[0])).filter((message) => message.includes("same key"))).toEqual([]);
      // The display map (Active permits, on the ultra's day) draws the same shapes.
      render(<PermitopolisMap highlights={[{ id: ultra.id, location: ultra.location!, status: "permitted", tier: ultra.tier, label: ultra.name }]} />);
      expect(errors.mock.calls.map((call) => String(call[0])).filter((message) => message.includes("same key"))).toEqual([]);
      // Alone on the map, its own laps are not another booking to overlap with.
      expect(screen.queryByText("Overlap")).not.toBeInTheDocument();
    } finally {
      errors.mockRestore();
    }
  });

  it("gives the PermitopolisMap list rows the system focus ring", () => {
    render(<MapDevScreen />);
    const list = screen.getByRole("list", { name: "Highlighted bookings and closures" });
    const row = within(list).getAllByRole("button")[0];
    expect(row.className).toContain("focus-visible:outline-2");
    expect(row.className).toContain("focus-visible:outline-focus-ring");
  });

  it("gives the calendar day and item buttons the system focus ring", () => {
    render(<MapDevScreen />);
    const dayButton = screen.getByRole("button", { name: /Tue, May 4: no events/ });
    expect(dayButton.className).toContain("focus-visible:outline-2");

    const itemButtons = screen.getAllByRole("button", { name: /Downtown Arts Collective performance/ });
    expect(itemButtons.length).toBeGreaterThan(0);
    for (const button of itemButtons) {
      expect(button.className).toContain("focus-visible:outline-2");
      expect(button.className).toContain("focus-visible:outline-focus-ring");
    }
  });
});

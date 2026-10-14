import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapDevScreen } from "@/components/map/MapDevScreen";
import { MapThumbnail } from "@/components/map/MapThumbnail";
import { PermitopolisMap } from "@/components/map/PermitopolisMap";
import { buildSeed } from "@/lib/state";
import { buildInventoryLocation, buildStreetsLocation } from "@/lib/view/map";

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

  it("selects Shelter 3 through the keyboard list under the map and shows its label and capacity", async () => {
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
      expect(container.querySelectorAll("svg > path[data-shape]").length).toBe(segments.length);
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

  it("draws the city's names over a booking's shapes, and the booking's own name over those", () => {
    const { container } = render(
      <PermitopolisMap highlights={[{ id: "h", location: buildStreetsLocation(["main-2-3"]), status: "permitted", tier: "reviewed", label: "Main Street closure" }]} />,
    );
    const svg = container.querySelector("svg[role='img']")!;
    const shape = svg.querySelector("path[data-shape='main-2-3']")!;
    const streetName = Array.from(svg.querySelectorAll("text")).find((text) => text.textContent === "Main Street")!;
    const bookingName = Array.from(svg.querySelectorAll("text")).find((text) => text.textContent === "Main Street closure")!;
    // Later in the document is drawn on top.
    expect(shape.compareDocumentPosition(streetName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(streetName.compareDocumentPosition(bookingName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The drawing is decoration: hidden from a screen reader, and it never takes the click.
    expect(streetName.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("zooms a thumbnail to its place and keeps the whole city for the display map", () => {
    const shelter = render(<MapThumbnail highlight={{ id: "t", location: buildInventoryLocation(["shelter-3"]), status: "permitted", tier: "instant", label: "Shelter 3" }} />);
    const [, , width, height] = shelter.container.querySelector("svg[role='img']")!.getAttribute("viewBox")!.split(" ").map(Number);
    expect([width, height]).toEqual([320, 200]);
    shelter.unmount();

    const { container } = render(<PermitopolisMap highlights={[]} />);
    expect(container.querySelector("svg[role='img']")!.getAttribute("viewBox")).toBe("0 0 1600 1000");
  });

  it("has a map key under the display map and the picker, closed until asked for, and none on a thumbnail", () => {
    const { container } = render(<MapDevScreen />);
    const keys = Array.from(container.querySelectorAll<HTMLDetailsElement>("details[data-slot='map-key']"));
    // Four pickers and one display map on the dev page.
    expect(keys).toHaveLength(5);
    for (const key of keys) {
      expect(key.open).toBe(false);
      expect(within(key).getByText("Map key")).toBeInTheDocument();
      expect(within(key).getByText("Water tap")).toBeInTheDocument();
    }
    expect(container.querySelector("figure details")).toBeNull();
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MapDevScreen } from "@/components/map/MapDevScreen";

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

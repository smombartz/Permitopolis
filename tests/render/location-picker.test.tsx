import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { LocationPicker } from "@/components/map/LocationPicker";
import { buildInventoryLocation, buildStreetsLocation } from "@/lib/view/map";
import type { EventType, Location } from "@/lib/types";

/** The picker as the wizard holds it: the value lives outside and comes back in. */
function Harness({ initial = null, eventType = "picnic_party" }: { initial?: Location | null; eventType?: EventType }) {
  const [location, setLocation] = React.useState<Location | null>(initial);
  return (
    <>
      <LocationPicker value={location} onChange={setLocation} eventType={eventType} />
      <output data-testid="value">{location ? `${location.mode}: ${location.label}` : "none"}</output>
    </>
  );
}

const value = () => screen.getByTestId("value").textContent;
const tab = (name: string) => screen.getByRole("tab", { name });
const space = (name: RegExp) => screen.getByRole("button", { name });

describe("LocationPicker: the value follows the tab", () => {
  it("switching tabs hands over that tab's own selection, so what is pressed is what is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(space(/^Shelter 2/));
    expect(value()).toBe("inventory: Shelter 2, Riverside Park");

    // Demo path 2: on to two blocks of Main Street.
    await user.click(tab("Street segments"));
    expect(value()).toBe("none");
    const streets = within(screen.getByRole("list", { name: "Street segments" }));
    await user.click(streets.getByRole("button", { name: /Main Street, 1st to 2nd/ }));
    await user.click(streets.getByRole("button", { name: /Main Street, 2nd to 3rd/ }));
    expect(value()).toBe("streets: Main Street, 1st to 3rd Avenue");

    // Back on Bookable spaces, Shelter 2 is still pressed, and it is the value again.
    await user.click(tab("Bookable spaces"));
    expect(space(/^Shelter 2/)).toHaveAttribute("aria-pressed", "true");
    expect(value()).toBe("inventory: Shelter 2, Riverside Park");

    await user.click(space(/^Shelter 2/));
    expect(space(/^Shelter 2/)).toHaveAttribute("aria-pressed", "false");
    expect(value()).toBe("none");
  });

  it("the Draw an area tab emits the rectangle it shows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(tab("Draw an area"));
    expect(value()).toMatch(/^area: [\d,]+ sq ft in City Hall Plaza$/);
    expect(screen.getByText(/sq ft · up to [\d,]+ people/)).toBeInTheDocument();
  });

  it("opening on Draw an area with no value shows a suggestion, not square feet nobody chose", async () => {
    const user = userEvent.setup();
    render(<Harness eventType="performance_rally" />);
    expect(tab("Draw an area")).toHaveAttribute("aria-selected", "true");
    expect(value()).toBe("none");
    expect(screen.getByText("No area chosen yet. Drag on the map, or set a width and length.")).toBeInTheDocument();
    expect(screen.queryByText(/sq ft · up to/)).not.toBeInTheDocument();

    // Sizing it is choosing it.
    const width = screen.getByLabelText("Width (ft)");
    await user.clear(width);
    await user.type(width, "40");
    expect(value()).toMatch(/^area: [\d,]+ sq ft in City Hall Plaza$/);
    expect(screen.getByText(/sq ft · up to [\d,]+ people/)).toBeInTheDocument();
  });
});

describe("LocationPicker: a value that arrives or changes later", () => {
  it("shows a value given after mount, on its own tab", () => {
    const { rerender } = render(<LocationPicker value={null} onChange={() => {}} eventType="picnic_party" />);
    expect(space(/^Shelter 3/)).toHaveAttribute("aria-pressed", "false");

    // The Draft is read from storage a moment after the first render.
    rerender(<LocationPicker value={buildInventoryLocation(["shelter-3"])} onChange={() => {}} eventType="picnic_party" />);
    expect(space(/^Shelter 3/)).toHaveAttribute("aria-pressed", "true");

    rerender(<LocationPicker value={buildStreetsLocation(["maple-400"])} onChange={() => {}} eventType="picnic_party" />);
    expect(tab("Street segments")).toHaveAttribute("aria-selected", "true");
    const streets = within(screen.getByRole("list", { name: "Street segments" }));
    expect(streets.getByRole("button", { name: /400 block of Maple Street/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on the tab of the value it starts with", () => {
    render(<Harness initial={buildStreetsLocation(["maple-400"])} />);
    expect(tab("Street segments")).toHaveAttribute("aria-selected", "true");
    expect(value()).toBe("streets: 400 block of Maple Street");
  });
});

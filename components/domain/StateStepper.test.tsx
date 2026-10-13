import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateStepper } from "@/components/domain/StateStepper";

describe("StateStepper (Phase 1 review fix: compact dots are never unlabeled)", () => {
  it("shows a visible current-state label next to the compact dots", () => {
    render(<StateStepper state="permitted" compact />);
    // Once as the visible label, once as the current marker's accessible name.
    expect(screen.getAllByText("Permitted").length).toBeGreaterThan(0);
  });

  it("shows the ending, not the state it stopped in, as the compact label", () => {
    render(<StateStepper state="in_review" ending="denied" compact />);
    // Once as the visible compact label, once as the stopped marker's accessible name.
    expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);
    expect(screen.queryByText("In review")).not.toBeInTheDocument();
  });

  it("shows Needs info as the compact label when that marker is showing", () => {
    render(<StateStepper state="needs_info" compact />);
    expect(screen.getAllByText("Needs info").length).toBeGreaterThan(0);
  });

  it("gives every step marker an accessible name, compact or not", () => {
    render(<StateStepper state="quote_sent" compact />);
    const list = screen.getByRole("list", { name: "Case progress" });
    // Eight steps, each carrying its own state label for a screen reader.
    expect(list).toHaveTextContent("Draft");
    expect(list).toHaveTextContent("Submitted");
    expect(list).toHaveTextContent("Quote sent");
    expect(list).toHaveTextContent("Closed");
  });
});

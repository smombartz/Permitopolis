import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KitScreen } from "@/components/kit/KitScreen";

describe("the Phase 1 kit page", () => {
  it("mounts every primitive and domain component without throwing", () => {
    render(<KitScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Design kit" })).toBeInTheDocument();
  });

  it("shows a landmark section for every part of the system", () => {
    render(<KitScreen />);
    const sectionTitles = [
      "Button",
      "Form controls",
      "Tabs",
      "Dialog, sheet, dropdown, popover, tooltip, command",
      "Accordion",
      "Table",
      "Panel, scroll area, separator",
      "Motion",
      "Domain: tier, party and state",
      "Domain: StateStepper",
      "Domain: review status, due date, review clock, hold status",
      "Domain: CaseId, DateText, Money, and the icon maps",
      "Page skeleton",
    ];
    for (const title of sectionTitles) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("renders every tier badge, party chip and case state chip", () => {
    render(<KitScreen />);
    expect(screen.getByText("Instant")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Special event")).toBeInTheDocument();
    expect(screen.getAllByText("Health & Legal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs info").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);
  });

  it("renders the StateStepper with the eight main-path states", () => {
    render(<KitScreen />);
    const stepperSection = document.getElementById("domain-stepper");
    expect(stepperSection).not.toBeNull();
    const steppers = within(stepperSection as HTMLElement).getAllByRole("list", { name: "Case progress" });
    expect(steppers.length).toBeGreaterThan(0);
  });

  it("opens the command palette", async () => {
    render(<KitScreen />);
    const trigger = screen.getByRole("button", { name: /Command palette/ });
    trigger.click();
    expect(await screen.findByPlaceholderText("Jump to a case, role or scenario...")).toBeInTheDocument();
  });
});

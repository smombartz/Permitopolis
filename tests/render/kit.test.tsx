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
      "Shared UI: page header, section, key-value list, confirm dialog",
      "Shared UI: wizard stepper, filter bar, count badge, toolbar",
      "Shared UI: progress, inline alert, sticky aside, truncate, copy button",
      "Domain: persona avatar, task kind label, availability badge, ending banner",
      "Domain: EventTitle, LeadTimeRisk, DeptStatusDots",
      "Domain: CaseHeader",
      "Domain: ActivityTimeline",
      "Domain: FeeTable",
      "Domain: ConditionList",
      "Domain: WhoIsUp",
      "Domain: TaskCard, StackedTaskCard",
      "Page skeleton",
    ];
    for (const title of sectionTitles) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("renders every tier badge, party chip and case state chip", () => {
    render(<KitScreen />);
    expect(screen.getAllByText("Instant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Special event").length).toBeGreaterThan(0);
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

  // Part 3: long names, missing fields, overdue dates and an ended case must all be
  // somewhere in the kit's samples.
  describe("stress rows", () => {
    it("shows a 90+ character event name and a 60+ character organization name", () => {
      render(<KitScreen />);
      const longName = "Riverside Park Community Spring Festival, Craft Fair, Food Truck Rally and Live Music Celebration Day";
      const longOrg = "Permitopolis Riverside Neighborhood Association and Community Partners Coalition";
      expect(longName.length).toBeGreaterThan(90);
      expect(longOrg.length).toBeGreaterThan(60);
      expect(screen.getAllByText(longName).length).toBeGreaterThan(0);
      expect(screen.getAllByText(longOrg).length).toBeGreaterThan(0);
    });

    it("shows 'Not provided' for missing fields", () => {
      render(<KitScreen />);
      expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    });

    it("shows an overdue task", () => {
      render(<KitScreen />);
      expect(screen.getAllByText(/Overdue by/).length).toBeGreaterThan(0);
    });

    it("shows an ended case, with its reason, among the samples", () => {
      render(<KitScreen />);
      expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);
      expect(screen.getByText("Street closure denied by Public Safety.")).toBeInTheDocument();
      expect(screen.getByText("The date hold expired before payment was received.")).toBeInTheDocument();
    });
  });

  describe("shared building blocks (Part 2)", () => {
    it("confirms a destructive action through ConfirmDialog, never window.confirm", async () => {
      render(<KitScreen />);
      await screen.getByRole("button", { name: "Reset the demo" }).click();
      expect(await screen.findByRole("dialog", { name: "Reset the demo?" })).toBeInTheDocument();
    });

    it("renders the WizardStepper's five steps with the current one marked", () => {
      render(<KitScreen />);
      const stepper = screen.getByRole("list", { name: "Application steps" });
      expect(within(stepper).getByText("What")).toBeInTheDocument();
      expect(within(stepper).getByText("Plan")).toBeInTheDocument();
      expect(within(stepper).getByText("When").closest('[aria-current="step"]')).not.toBeNull();
    });

    it("filters with FilterBar: chips, a select, search and a result count", () => {
      render(<KitScreen />);
      const uiBlocks2 = document.getElementById("ui-blocks-2") as HTMLElement;
      expect(within(uiBlocks2).getByRole("button", { name: "Involves me" })).toHaveAttribute("aria-pressed", "false");
      expect(within(uiBlocks2).getByLabelText("Search cases")).toBeInTheDocument();
      expect(within(uiBlocks2).getByText("6 cases")).toBeInTheDocument();
      expect(within(uiBlocks2).getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
    });

    it("renders WhoIsUp's up-now row and the next-move sentence", () => {
      render(<KitScreen />);
      const whoIsUp = document.getElementById("domain-who-is-up");
      expect(whoIsUp).not.toBeNull();
      expect(within(whoIsUp as HTMLElement).getByText("Up now")).toBeInTheDocument();
      expect(screen.getByText(/^Next: the applicant responds/)).toBeInTheDocument();
    });

    it("renders FeeTable's subtotal, deposit and total, and a $0 line", () => {
      render(<KitScreen />);
      const feesSection = document.getElementById("domain-fees");
      expect(feesSection).not.toBeNull();
      expect(within(feesSection as HTMLElement).getAllByText("Subtotal of fees").length).toBe(2);
      expect(within(feesSection as HTMLElement).getAllByText("Total").length).toBe(2);
      expect(within(feesSection as HTMLElement).getAllByText("$0").length).toBeGreaterThan(0);
    });

    it("renders TaskCard's locked, pinned-request and done states together", () => {
      render(<KitScreen />);
      const taskSection = document.getElementById("domain-task-card");
      expect(taskSection).not.toBeNull();
      const within_ = within(taskSection as HTMLElement);
      expect(within_.getByText("Unlocks when your quote is ready.")).toBeInTheDocument();
      expect(within_.getByText(/Health & Legal asks:/)).toBeInTheDocument();
      expect(within_.getByText("Done")).toBeInTheDocument();
      expect(within_.getByText("Vendor health permits")).toBeInTheDocument();
      expect(within_.getByText("25 of 25")).toBeInTheDocument();
    });
  });
});

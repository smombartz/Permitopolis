import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardStepper } from "@/components/ui/wizard-stepper";

const STEPS = [{ label: "What" }, { label: "Where" }, { label: "When" }, { label: "Size" }, { label: "Plan" }];

describe("WizardStepper (Phase 3 review fix: every step has a name below sm too)", () => {
  it("names the current and the upcoming steps: the label is hidden from sight, not from assistive tech", () => {
    render(<WizardStepper steps={STEPS} current={2} onStepSelect={() => {}} />);
    const items = screen.getAllByRole("listitem");
    // What assistive tech reads: everything but the decorative, aria-hidden marker and rule.
    const spoken = (li: HTMLElement) => {
      const copy = li.cloneNode(true) as HTMLElement;
      for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
      return copy.textContent;
    };
    expect(items.map(spoken)).toEqual(["Step 1: What, done, edit", "Step 2: Where, done, edit", "Step 3: When", "Step 4: Size", "Step 5: Plan"]);
    // `hidden` is display: none, which removes the label from the accessibility tree as well.
    for (const li of items) {
      for (const span of li.querySelectorAll("span")) expect(span.className.split(/\s+/)).not.toContain("hidden");
    }
  });

  it("a done step's button says which step it reopens", () => {
    render(<WizardStepper steps={STEPS} current={2} onStepSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /^Step 1:\s*What, done, edit$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Step 2:\s*Where, done, edit$/ })).toBeInTheDocument();
  });
});

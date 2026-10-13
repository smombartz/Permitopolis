import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("WizardStepper (Phase 4 review fix: a step that has been reached stays an edit link)", () => {
  it("back on step 2 of a wizard that reached step 4: steps 3 and 4 keep their mark and their button, step 5 has neither", () => {
    const onStepSelect = vi.fn();
    render(<WizardStepper steps={STEPS} current={1} reached={3} onStepSelect={onStepSelect} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Step 1: What, done, edit", "Step 3: When, done, edit", "Step 4: Size, done, edit"]);
    expect(screen.getByText("Where").closest("[aria-current]")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: /Plan/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Step 4:\s*Size, done, edit$/ }));
    expect(onStepSelect).toHaveBeenCalledWith(3);
  });

  it("without `reached`, or with one behind the step in view, only the steps before it are done", () => {
    const { unmount } = render(<WizardStepper steps={STEPS} current={2} reached={0} onStepSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    unmount();
    render(<WizardStepper steps={STEPS} current={2} onStepSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

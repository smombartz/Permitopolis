import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StackedTaskCard, TaskCard } from "@/components/domain/TaskCard";
import type { Task } from "@/lib/types";

const TODAY = "2027-05-03";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "PMT-27-0118:vendor_health_permit:1",
    catalogId: "vendor_health_permit",
    owner: "applicant",
    kind: "document",
    title: "Upload Rolling Dumpling Co.'s health permit",
    why: "Because you added food vending.",
    reviewer: "hl",
    dueDate: "2027-05-05",
    status: "todo",
    unlocksOn: null,
    phase: "before_submitting",
    payload: {},
    history: [],
    tags: [],
    ...overrides,
  };
}

describe("TaskCard (PRD 'Applicant to-do board' card anatomy)", () => {
  it("shows the kind icon and label, title, why line, reviewer chip and due date", () => {
    render(<TaskCard task={task()} today={TODAY} />);
    expect(screen.getByText("Document")).toBeInTheDocument();
    expect(screen.getByText("Upload Rolling Dumpling Co.'s health permit")).toBeInTheDocument();
    expect(screen.getByText("Because you added food vending.")).toBeInTheDocument();
    expect(screen.getAllByText("Health & Legal").length).toBeGreaterThan(0);
    expect(screen.getByText(/Due in 2 days/)).toBeInTheDocument();
  });

  it("shows a dashed border and the unlock hint instead of a due date while locked", () => {
    render(<TaskCard task={task({ status: "locked", unlocksOn: "quote_sent" })} today={TODAY} unlockHint="Unlocks when your quote is ready." />);
    const card = document.querySelector('[data-slot="task-card"]');
    expect(card).toHaveClass("border-dashed");
    expect(screen.getByText("Unlocks when your quote is ready.")).toBeInTheDocument();
    expect(screen.queryByText(/Due in/)).not.toBeInTheDocument();
  });

  it("shows the reviewer's pinned message while a request is open", () => {
    const pinned = task({
      request: { from: "hl", message: "Please upload the updated certificate.", at: "2027-04-30T10:00", dueDate: "2027-05-05", resolved: false },
    });
    render(<TaskCard task={pinned} today={TODAY} />);
    expect(screen.getByText(/Please upload the updated certificate\./)).toBeInTheDocument();
    expect(screen.getByText(/Health & Legal asks:/)).toBeInTheDocument();
  });

  it("shows a check and no due date once done", () => {
    render(<TaskCard task={task({ status: "done" })} today={TODAY} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText(/Due in/)).not.toBeInTheDocument();
  });

  it("shows sign-off progress", () => {
    render(
      <TaskCard
        task={task({ kind: "sign_off", title: "Neighbor sign-off", payload: { progress: { done: 9, total: 12 } } })}
        today={TODAY}
      />
    );
    expect(screen.getByText("9 of 12 neighbors")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "9");
  });

  it("shows a payment amount", () => {
    render(<TaskCard task={task({ kind: "payment", title: "Pay fees and deposit", payload: { amount: 715 } })} today={TODAY} />);
    expect(screen.getByText("$715")).toBeInTheDocument();
  });

  it("calls onSelect and renders as a button when given one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TaskCard task={task()} today={TODAY} onSelect={onSelect} />);
    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("StackedTaskCard", () => {
  it("renders the stacked-card count, e.g. 'Vendor health permits · 25 of 25'", () => {
    render(<StackedTaskCard title="Vendor health permits" done={25} total={25} />);
    expect(screen.getByText("Vendor health permits")).toBeInTheDocument();
    expect(screen.getByText("25 of 25")).toBeInTheDocument();
  });
});

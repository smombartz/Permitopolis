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

  it("a locked card with a date shows it under the unlock hint: Carry your permit, Fri, Jun 18", () => {
    const carry = task({ catalogId: "carry_permit", kind: "action", title: "Carry your permit", status: "locked", unlocksOn: "event_day", dueDate: "2027-06-18", reviewer: null });
    render(<TaskCard task={carry} today={TODAY} unlockHint="For the day of your event" />);
    expect(screen.getByText("For the day of your event")).toBeInTheDocument();
    expect(screen.getByText("Fri, Jun 18")).toBeInTheDocument();
    // A locked card is not counted down: no "Due in 46 days".
    expect(screen.queryByText(/Due in/)).not.toBeInTheDocument();
  });

  it("a locked card with no date yet shows the hint alone", () => {
    render(<TaskCard task={task({ status: "locked", unlocksOn: "quote_sent", dueDate: null })} today={TODAY} unlockHint="Unlocks when your quote is ready" />);
    expect(screen.getByText("Unlocks when your quote is ready")).toBeInTheDocument();
    expect(screen.queryByText(/May|Jun/)).not.toBeInTheDocument();
  });

  it("a scheduled meeting says the day it is set for while it is still locked", () => {
    // S5's coordination meeting: set for Mon, Jun 21, locked until the permit is issued.
    const meeting = task({ catalogId: "coordination_meeting", kind: "meeting", title: "Coordination meeting", reviewer: "clerk", status: "locked", unlocksOn: "permitted", dueDate: "2027-06-21", payload: { scheduledFor: "2027-06-21" } });
    render(<TaskCard task={meeting} today={TODAY} unlockHint="Unlocks when your permit is issued" />);
    expect(screen.getByText("Scheduled for Mon, Jun 21")).toBeInTheDocument();
    expect(screen.getByText("Unlocks when your permit is issued")).toBeInTheDocument();
    // The day is said once.
    expect(screen.getAllByText(/Jun 21/)).toHaveLength(1);
  });

  it("...and once it is open: the day it is set for, and how far off that is", () => {
    const meeting = task({ catalogId: "site_walkthrough", kind: "meeting", title: "Site walkthrough", reviewer: "pws", dueDate: "2027-07-02", payload: { scheduledFor: "2027-07-02" } });
    render(<TaskCard task={meeting} today={TODAY} />);
    expect(screen.getByText("Scheduled for Fri, Jul 2")).toBeInTheDocument();
    expect(screen.getByText("Due in 60 days")).toBeInTheDocument();
    expect(screen.getAllByText(/Jul 2/)).toHaveLength(1);
  });

  it("a meeting with no date set shows none, and a held one no longer says when it was scheduled for", () => {
    const { unmount } = render(<TaskCard task={task({ kind: "meeting", title: "Pre-application meeting", reviewer: "clerk", dueDate: "2027-05-10" })} today={TODAY} />);
    expect(screen.queryByText(/Scheduled for/)).not.toBeInTheDocument();
    unmount();
    render(<TaskCard task={task({ kind: "meeting", title: "Pre-application meeting", status: "done", payload: { scheduledFor: "2027-03-17" } })} today={TODAY} />);
    expect(screen.queryByText(/Scheduled for/)).not.toBeInTheDocument();
  });

  it("a card the reviewer sent back reads Changes requested, with who sent it back and why", () => {
    const sentBack = task({
      status: "changes_requested",
      title: "Certificate of insurance",
      payload: { rejectedReason: "The City of Permitopolis is not listed as an additional insured." },
      history: [
        { at: "2027-04-27T09:10", actor: "applicant", status: "submitted" },
        { at: "2027-04-30T10:00", actor: "hl", status: "changes_requested" },
      ],
    });
    render(<TaskCard task={sentBack} today={TODAY} />);
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    expect(screen.getByText("Health & Legal sent this back:")).toBeInTheDocument();
    expect(screen.getByText(/not listed as an additional insured/)).toBeInTheDocument();
    // The reason stands where the why line was, and the card does not look like a fresh to-do.
    expect(screen.queryByText("Because you added food vending.")).not.toBeInTheDocument();
    const card = document.querySelector('[data-slot="task-card"]');
    expect(card).toHaveAttribute("data-status", "changes_requested");
    expect(card).toHaveClass("border-warning-border");
    expect(card).not.toHaveClass("bg-surface-1");
    // It is still due.
    expect(screen.getByText(/Due in 2 days/)).toBeInTheDocument();
  });

  it("a sent-back card with no reason on it keeps its why line under the label", () => {
    render(<TaskCard task={task({ status: "changes_requested" })} today={TODAY} />);
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    expect(screen.getByText("Because you added food vending.")).toBeInTheDocument();
  });

  it("a card added by an amendment carries an Amendment chip (path 7)", () => {
    const { unmount } = render(<TaskCard task={task({ title: "Sound details", kind: "form", reviewer: "pws", tags: ["amendment"] })} today={TODAY} />);
    expect(screen.getByText("Amendment")).toBeInTheDocument();
    unmount();
    render(<TaskCard task={task()} today={TODAY} />);
    expect(screen.queryByText("Amendment")).not.toBeInTheDocument();
  });

  it("a finished card shows the day it was finished: Done Apr 21", () => {
    const verified = task({
      status: "done",
      title: "Certificate of insurance",
      history: [
        { at: "2027-04-16T09:05", actor: "applicant", status: "submitted" },
        { at: "2027-04-21T11:00", actor: "hl", status: "done" },
      ],
    });
    render(<TaskCard task={verified} today={TODAY} />);
    expect(screen.getByText("Done Apr 21")).toBeInTheDocument();
    expect(screen.queryByText(/Due in/)).not.toBeInTheDocument();
  });

  it("a card done, reopened and done again shows the last time", () => {
    const again = task({
      status: "done",
      history: [
        { at: "2027-04-21T11:00", actor: "hl", status: "done" },
        { at: "2027-04-30T09:10", actor: "applicant", status: "submitted" },
        { at: "2027-05-03T09:00", actor: "hl", status: "done" },
      ],
    });
    render(<TaskCard task={again} today={TODAY} />);
    expect(screen.getByText("Done May 3")).toBeInTheDocument();
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

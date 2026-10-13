import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WhoIsUp } from "@/components/domain/WhoIsUp";
import type { PartyStatus } from "@/lib/state/types";
import type { Task } from "@/lib/types";

const TODAY = "2027-05-03";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "PMT-27-0097:pay_fees",
    catalogId: "pay_fees",
    owner: "applicant",
    kind: "payment",
    title: "Sign and pay $6,530",
    why: "Your quote is ready.",
    reviewer: null,
    dueDate: "2027-05-14",
    status: "todo",
    unlocksOn: null,
    phase: "permit",
    payload: {},
    history: [],
    tags: [],
    ...overrides,
  };
}

const ITEMS: PartyStatus[] = [
  {
    party: "applicant",
    status: "up_now",
    openTasks: [task()],
    oldestDue: "2027-05-14",
    daysHolding: 3,
    note: "",
    scope: "Riverfront Running Club",
  },
  {
    party: "hl",
    status: "up_now",
    openTasks: [task({ id: "t2", title: "Verify race-day insurance", dueDate: "2027-05-07" })],
    oldestDue: "2027-05-07",
    daysHolding: 3,
    note: "",
    scope: "Insurance, accessibility",
  },
  {
    party: "clerk",
    status: "waiting",
    openTasks: [],
    oldestDue: null,
    daysHolding: 0,
    note: "Unlocks when paid and verified",
    scope: "Owns the case",
  },
  {
    party: "pws",
    status: "done_for_now",
    openTasks: [],
    oldestDue: null,
    daysHolding: 0,
    note: "Approved with conditions",
    scope: "Route, police, sound",
  },
];

describe("WhoIsUp (docs/spec/img/wireframe-case-s5.png)", () => {
  it("renders all four party rows with a status pill, never color alone", () => {
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: the club signs and pays, and Health & Legal verifies insurance." />);
    expect(screen.getAllByText("Up now").length).toBe(2);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Done for now")).toBeInTheDocument();
  });

  it("highlights up-now rows with an indigo wash and a leading bar, not amber", () => {
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: ..." />);
    const rows = screen.getAllByRole("listitem");
    const applicantRow = rows[0];
    expect(applicantRow).toHaveClass("border-indigo-650");
    expect(applicantRow).toHaveClass("bg-pill");
    expect(applicantRow.className).not.toMatch(/amber|warning/);
  });

  it("shows the open action, its due date and days holding", () => {
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: ..." />);
    expect(screen.getByText("Sign and pay $6,530")).toBeInTheDocument();
    // Both the applicant and Health & Legal rows hold 3 days in this fixture.
    expect(screen.getAllByText("3 days holding").length).toBe(2);
  });

  it("lists every open action of a party, each with its own due date", () => {
    const two: PartyStatus[] = [
      {
        ...ITEMS[0],
        openTasks: [
          task({ id: "PMT-27-0097:accept_and_sign", title: "Accept conditions and sign", dueDate: "2027-05-07" }),
          task(),
        ],
        oldestDue: "2027-05-07",
      },
      ...ITEMS.slice(1),
    ];
    render(<WhoIsUp items={two} today={TODAY} nextMove="Next: ..." />);
    const applicantRow = screen.getAllByRole("listitem")[0];
    expect(within(applicantRow).getByText("Accept conditions and sign")).toBeInTheDocument();
    expect(within(applicantRow).getByText("Sign and pay $6,530")).toBeInTheDocument();
    expect(within(applicantRow).getByText(/Fri, May 7/)).toBeInTheDocument();
    expect(within(applicantRow).getByText(/Fri, May 14/)).toBeInTheDocument();
    expect(within(applicantRow).getAllByText("3 days holding")).toHaveLength(1);
  });

  it("takes a pinned request's due date over the card's own", () => {
    const pinned: PartyStatus[] = [
      {
        ...ITEMS[0],
        openTasks: [
          task({
            id: "PMT-27-0118:vendor_health_permit:1",
            title: "Vendor health permit",
            dueDate: "2027-06-04",
            request: { from: "hl", message: "Please upload the food truck's health permit.", dueDate: "2027-05-05", at: "2027-04-30T10:00", resolved: false },
          }),
        ],
      },
      ...ITEMS.slice(1),
    ];
    render(<WhoIsUp items={pinned} today={TODAY} nextMove="Next: ..." />);
    const applicantRow = screen.getAllByRole("listitem")[0];
    expect(within(applicantRow).getByText(/Wed, May 5/)).toBeInTheDocument();
    expect(within(applicantRow).queryByText(/Jun 4/)).not.toBeInTheDocument();
  });

  it("falls back to the row's note when there is no open task", () => {
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: ..." />);
    expect(screen.getByText("Unlocks when paid and verified")).toBeInTheDocument();
    expect(screen.getByText("Approved with conditions")).toBeInTheDocument();
  });

  it("shows the next-move sentence below the rows", () => {
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: the club signs and pays." />);
    expect(screen.getByText("Next: the club signs and pays.")).toBeInTheDocument();
  });

  it("opens the task panel when an open action is selected", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    render(<WhoIsUp items={ITEMS} today={TODAY} nextMove="Next: ..." onSelectTask={onSelectTask} />);
    await user.click(screen.getByRole("button", { name: "Sign and pay $6,530" }));
    expect(onSelectTask).toHaveBeenCalledWith("PMT-27-0097:pay_fees");
  });
});

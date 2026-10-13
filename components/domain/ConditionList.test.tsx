import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConditionList, groupConditionsByDept } from "@/components/domain/ConditionList";
import type { Condition } from "@/lib/types";

const CONDITIONS: Condition[] = [
  { id: "c1", dept: "pws", text: "Sound ends at 9 pm.", mergedByClerk: true, acceptedByApplicant: false },
  { id: "c2", dept: "pws", text: "Speakers face away from Elm Street.", mergedByClerk: false, acceptedByApplicant: true },
  { id: "c3", dept: "hl", text: "Vendor list confirmed 48 hours ahead.", mergedByClerk: false, acceptedByApplicant: false },
];

describe("groupConditionsByDept", () => {
  it("groups conditions by their department, preserving order within a group", () => {
    const groups = groupConditionsByDept(CONDITIONS);
    expect(groups.pws?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(groups.hl?.map((c) => c.id)).toEqual(["c3"]);
    expect(groups.clerk).toBeUndefined();
  });
});

describe("ConditionList", () => {
  it("marks accepted conditions in read-only mode, and merged ones for city staff only", () => {
    const { unmount } = render(<ConditionList conditions={CONDITIONS} showMerged />);
    expect(screen.getByText("Merged")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getAllByText("Not yet accepted").length).toBe(2);
    unmount();

    // The applicant's quote, the permit and the public check: "Merged" is the Clerk's bookkeeping.
    render(<ConditionList conditions={CONDITIONS} />);
    expect(screen.queryByText("Merged")).not.toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("shows an accept checkbox per condition in editable mode and calls back on toggle", async () => {
    const user = userEvent.setup();
    const onToggleAccept = vi.fn();
    render(<ConditionList conditions={CONDITIONS} editable onToggleAccept={onToggleAccept} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    await user.click(checkboxes[0]);
    expect(onToggleAccept).toHaveBeenCalledWith("c1");
  });

  it("each accept checkbox has a visible \"I accept\" label that toggles it, and its name carries the condition", async () => {
    const user = userEvent.setup();
    const onToggleAccept = vi.fn();
    render(<ConditionList conditions={CONDITIONS} editable onToggleAccept={onToggleAccept} />);

    const labels = screen.getAllByText("I accept");
    expect(labels).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "I accept: Vendor list confirmed 48 hours ahead." })).toBeInTheDocument();

    await user.click(labels[2]);
    expect(onToggleAccept).toHaveBeenCalledWith("c3");
  });

  it("read-only mode has no \"I accept\" label", () => {
    render(<ConditionList conditions={CONDITIONS} />);
    expect(screen.queryByText("I accept")).not.toBeInTheDocument();
  });
});

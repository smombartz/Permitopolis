import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DeptStatusDots } from "@/components/domain/DeptStatusDots";
import type { ReviewStatus } from "@/lib/types";

const STATUSES: ReviewStatus[] = ["not_routed", "pending", "approved", "approved_with_conditions", "needs_info", "denied"];

/** The status glyph of a marker: the second icon, after the department's own. */
function glyphOf(status: ReviewStatus): string {
  const { container, unmount } = render(<DeptStatusDots items={[{ dept: "hl", status }]} />);
  const icons = container.querySelectorAll(`[data-status="${status}"] svg`);
  expect(icons).toHaveLength(2);
  const markup = icons[1].innerHTML;
  unmount();
  return markup;
}

describe("DeptStatusDots", () => {
  it("draws a different glyph for every review status, so no two differ by color alone", () => {
    const glyphs = STATUSES.map(glyphOf);
    expect(new Set(glyphs).size).toBe(STATUSES.length);
    // The pair the tint cannot tell apart at all.
    expect(glyphOf("approved")).not.toBe(glyphOf("approved_with_conditions"));
  });

  it("keeps the department's own icon in every marker", () => {
    const { container } = render(
      <DeptStatusDots
        items={[
          { dept: "clerk", status: "pending" },
          { dept: "pws", status: "approved_with_conditions" },
          { dept: "hl", status: "needs_info" },
        ]}
      />,
    );
    const markers = [...container.querySelectorAll("[data-dept]")];
    expect(markers.map((marker) => [marker.getAttribute("data-dept"), marker.getAttribute("data-status")])).toEqual([
      ["clerk", "pending"],
      ["pws", "approved_with_conditions"],
      ["hl", "needs_info"],
    ]);
    const deptIcons = markers.map((marker) => marker.querySelector("svg")?.innerHTML);
    expect(new Set(deptIcons).size).toBe(3);
  });

  it("reads every department's status out as its name", () => {
    render(
      <DeptStatusDots
        items={[
          { dept: "pws", status: "approved_with_conditions" },
          { dept: "hl", status: "denied" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Reviews: Public Works & Safety: Approved with conditions; Health & Legal: Denied" })).toBeInTheDocument();
  });

  it("shows the words to a keyboard user: the row takes focus and opens its tooltip", async () => {
    const user = userEvent.setup();
    render(
      <DeptStatusDots
        items={[
          { dept: "pws", status: "approved" },
          { dept: "hl", status: "needs_info" },
        ]}
      />,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab();

    expect(screen.getByRole("img", { name: /^Reviews:/ })).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Public Works & Safety: Approved");
    expect(tooltip).toHaveTextContent("Health & Legal: Asked for more information");
  });

  it("renders nothing to focus before the case is routed", () => {
    const { container } = render(<DeptStatusDots items={[]} />);
    expect(container.querySelector('[data-slot="dept-status-dots"]')).toBeEmptyDOMElement();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });
});

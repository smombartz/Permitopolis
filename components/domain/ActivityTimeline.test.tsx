import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ActivityTimeline } from "@/components/domain/ActivityTimeline";
import type { Activity } from "@/lib/types";

const ITEMS: Activity[] = [
  { at: "2027-04-16T09:00", actor: "applicant", text: "Submitted the application." },
  { at: "2027-04-19T10:00", actor: "clerk", text: "Accepted as complete." },
  { at: "2027-04-21T11:00", actor: "hl", text: "Verified insurance." },
  { at: "2027-04-28T12:00", actor: "pws", text: "Approved with 3 conditions." },
  { at: "2027-04-30T13:00", actor: "neighbor", text: "Signed off." },
  { at: "2027-05-01T14:00", actor: "system", text: "Advanced the demo date." },
];

describe("ActivityTimeline", () => {
  it("renders every entry's text and a mono timestamp when not collapsed", () => {
    render(<ActivityTimeline items={ITEMS} />);
    for (const item of ITEMS) expect(screen.getByText(item.text)).toBeInTheDocument();
  });

  it("gives system and neighbor actors their own icon and accessible name", () => {
    render(<ActivityTimeline items={ITEMS} />);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Neighbor")).toBeInTheDocument();
  });

  it("shows only the latest N when collapsed, then everything after Show all", async () => {
    const user = userEvent.setup();
    render(<ActivityTimeline items={ITEMS} collapsedCount={2} />);
    expect(screen.getByText(ITEMS[0].text)).toBeInTheDocument();
    expect(screen.getByText(ITEMS[1].text)).toBeInTheDocument();
    expect(screen.queryByText(ITEMS[5].text)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Show all ${ITEMS.length}` }));
    expect(screen.getByText(ITEMS[5].text)).toBeInTheDocument();
  });

  it("shows no 'Show all' button when there is nothing more to show", () => {
    render(<ActivityTimeline items={ITEMS} collapsedCount={ITEMS.length} />);
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });
});

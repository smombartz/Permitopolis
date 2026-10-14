import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/components/ui/segmented-control";

const OPTIONS = [
  { value: "applicant", label: "Applicant" },
  { value: "clerk", label: "City Clerk" },
  { value: "pws", label: "Public Works & Safety" },
  { value: "hl", label: "Health & Legal" },
];

/** Controlled, as a view toggle is: the selected option follows what onChange reports. */
function Switcher({ initial = "applicant", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <button type="button">Before</button>
      <SegmentedControl
        aria-label="Switch role"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button">After</button>
    </>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });

describe("SegmentedControl as a radio group", () => {
  it("is one tab stop: the selected option, and Tab leaves the group", async () => {
    const user = userEvent.setup();
    render(<Switcher initial="clerk" />);

    expect(screen.getAllByRole("radio").map((option) => option.tabIndex)).toEqual([-1, 0, -1, -1]);

    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();
    expect(radio("City Clerk")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("Right and Left move to the neighboring option and select it, wrapping at the ends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switcher onChange={onChange} />);
    radio("Applicant").focus();

    await user.keyboard("{ArrowRight}");
    expect(radio("City Clerk")).toHaveFocus();
    expect(radio("City Clerk")).toBeChecked();
    expect(radio("Applicant")).not.toBeChecked();
    expect(radio("City Clerk").tabIndex).toBe(0);
    expect(radio("Applicant").tabIndex).toBe(-1);

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(radio("Health & Legal")).toHaveFocus();
    expect(radio("Health & Legal")).toBeChecked();

    await user.keyboard("{ArrowRight}");
    expect(radio("Applicant")).toBeChecked();
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(["clerk", "applicant", "hl", "applicant"]);
  });

  it("Home and End go to the first and the last option; Down and Up work as Right and Left", async () => {
    const user = userEvent.setup();
    render(<Switcher initial="clerk" />);
    radio("City Clerk").focus();

    await user.keyboard("{End}");
    expect(radio("Health & Legal")).toBeChecked();
    await user.keyboard("{Home}");
    expect(radio("Applicant")).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(radio("City Clerk")).toBeChecked();
    await user.keyboard("{ArrowUp}");
    expect(radio("Applicant")).toHaveFocus();
  });

  it("a click still selects, and Home on the first option reports no change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switcher onChange={onChange} />);

    await user.click(radio("Public Works & Safety"));
    expect(radio("Public Works & Safety")).toBeChecked();
    expect(onChange).toHaveBeenCalledWith("pws");

    onChange.mockClear();
    await user.keyboard("{End}{End}");
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(["hl"]);
  });
});

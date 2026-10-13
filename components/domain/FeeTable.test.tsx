import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeeTable, groupFeeLinesByDept, sumFeeLines } from "@/components/domain/FeeTable";
import type { FeeLine } from "@/lib/types";

const LINES: FeeLine[] = [
  { id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "flat", unitPrice: 50, estimate: 50, actual: null, kind: "fee" },
  { id: "f2", dept: "pws", label: "Barricades", qty: 4, unit: "each", unitPrice: 25, estimate: 100, actual: 125, kind: "fee" },
  { id: "f3", dept: "pws", label: "Late fee", qty: 1, unit: "flat", unitPrice: 150, estimate: 150, actual: null, kind: "late_fee" },
  { id: "f4", dept: "hl", label: "Vendor permit", qty: 1, unit: "each", unitPrice: 75, estimate: 75, actual: 75, kind: "fee" },
  { id: "d1", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, actual: null, kind: "deposit" },
];

describe("groupFeeLinesByDept", () => {
  it("groups fee and late-fee lines by department, leaving the deposit out", () => {
    const groups = groupFeeLinesByDept(LINES);
    expect(groups.clerk?.map((l) => l.id)).toEqual(["f1"]);
    expect(groups.pws?.map((l) => l.id)).toEqual(["f2", "f3"]);
    expect(groups.hl?.map((l) => l.id)).toEqual(["f4"]);
  });
});

describe("sumFeeLines", () => {
  it("sums estimates", () => {
    expect(sumFeeLines(LINES.filter((l) => l.kind !== "deposit"))).toBe(50 + 100 + 150 + 75);
  });
  it("is 0 for an empty list", () => {
    expect(sumFeeLines([])).toBe(0);
  });
});

describe("FeeTable", () => {
  it("renders a subtotal of fees, the deposit and the total", () => {
    render(<FeeTable lines={LINES} />);
    expect(screen.getByText("Subtotal of fees")).toBeInTheDocument();
    expect(screen.getByText("$375")).toBeInTheDocument(); // 50 + 100 + 150 + 75
    expect(screen.getByText("Refundable cleanup deposit")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("$625")).toBeInTheDocument(); // 375 + 250
  });

  it("adds Actual and Difference columns in closeout mode", () => {
    render(<FeeTable lines={LINES} showActual />);
    // One "Actual"/"Difference" header per department table (clerk, pws, hl).
    expect(screen.getAllByText("Actual").length).toBe(3);
    expect(screen.getAllByText("Difference").length).toBe(3);
    expect(screen.getAllByText("Not logged").length).toBe(2); // f1 and f3 have no actual yet
    // f2's unit price ($25) and its difference (125 - 100 = $25) both render.
    expect(screen.getAllByText("$25").length).toBe(2);
  });

  it("omits the Actual column by default", () => {
    render(<FeeTable lines={LINES} />);
    expect(screen.queryByText("Actual")).not.toBeInTheDocument();
  });

  it("compact: two columns, with the quantity and unit price under the line and the amount beside it", () => {
    render(<FeeTable lines={LINES} compact />);
    expect(screen.queryByText("Qty")).not.toBeInTheDocument();
    expect(screen.queryByText("Unit price")).not.toBeInTheDocument();
    for (const table of screen.getAllByRole("table")) {
      expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Line", "Estimate"]);
    }

    const row = screen.getByText("Barricades").closest("tr")!;
    const [line, amount] = within(row).getAllByRole("cell");
    expect(line).toHaveTextContent("4 each × $25");
    // The line wraps instead of pushing the amount out of a 280px box.
    expect(line.className).toContain("whitespace-normal");
    expect(amount).toHaveTextContent("$100");
    // The totals are unchanged.
    expect(screen.getByText("$625")).toBeInTheDocument();
  });

  it("compact with actuals: the actual sits under the estimate", () => {
    render(<FeeTable lines={LINES} compact showActual />);
    const row = screen.getByText("Barricades").closest("tr")!;
    expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("$100Actual $125");
    expect(screen.getAllByText("Not logged").length).toBe(2);
  });
});

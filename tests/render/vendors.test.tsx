import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { renderScreen } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza: Reviewed, one vendor, not yet uploaded
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout, 25 vendors, all verified

describe("Documents tab: the Vendors group", () => {
  it("S6 reads 25 of 25 verified, every vendor shown, and Issue food permits disabled for want of the engine step", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "documents" }), role: "hl" });
    const vendors = within(screen.getByRole("heading", { name: "Vendors" }).closest("section")!);
    expect(vendors.getByText("25 of 25 verified")).toBeInTheDocument();
    expect(vendors.getAllByText("Verified")).toHaveLength(25);
    expect(vendors.getByText("Food Truck 1")).toBeInTheDocument();
    expect(vendors.getByText("Food Truck 25")).toBeInTheDocument();
    expect(vendors.getByRole("button", { name: "Issue food permits" })).toBeDisabled();
    expect(vendors.getByText(/does not exist yet/)).toBeInTheDocument();
  });

  it("S3 reads 0 of 1 until the vendor's health permit is verified, and has no Issue food permits section (Reviewed, not Special)", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "documents" }), role: "hl" });
    const vendors = within(screen.getByRole("heading", { name: "Vendors" }).closest("section")!);
    expect(vendors.getByText("0 of 1 verified")).toBeInTheDocument();
    expect(vendors.getByText("Rolling Dumpling Co.")).toBeInTheDocument();
    expect(vendors.getByText("Not uploaded")).toBeInTheDocument();
    expect(vendors.queryByRole("button", { name: "Issue food permits" })).not.toBeInTheDocument();
  });

  it("a case with no food vendors shows no Vendors group", async () => {
    // S5, the Riverfront Summer 5K, has no vendors: insurance only.
    await renderScreen(<CaseDetailScreen />, { scenario: "S5", search: { tab: "documents" }, role: "hl" });
    expect(screen.queryByRole("heading", { name: "Vendors" })).not.toBeInTheDocument();
  });
});

import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { EMPTY_ADDONS } from "@/lib/types";
import { renderScreen, storedCase } from "./harness";

const NEW = "PMT-27-0900";

const S3 = "PMT-27-0118"; // Jazz in the Plaza: Standard, one vendor, not yet uploaded
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout, 25 vendors, all verified

describe("Documents tab: the Vendors group", () => {
  it("S6 reads 25 of 25 verified, every vendor shown, and the food permits as issued on Apr 15", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "documents" }), role: "hl" });
    const vendors = within(screen.getByRole("heading", { name: "Vendors" }).closest("section")!);
    expect(vendors.getByText("25 of 25 verified")).toBeInTheDocument();
    expect(vendors.getAllByText("Verified")).toHaveLength(25);
    expect(vendors.getByText("Food Truck 1")).toBeInTheDocument();
    expect(vendors.getByText("Food Truck 25")).toBeInTheDocument();
    expect(vendors.getByText("Issued Thu, Apr 15, 2027.")).toBeInTheDocument();
    expect(vendors.queryByRole("button", { name: "Issue food permits" })).not.toBeInTheDocument();
  });

  it("a Special event just permitted: Health & Legal verifies the last vendor, issues the food permits, and the applicant's card opens", async () => {
    const issueTask = makeTask({ id: `${NEW}:issue_food_permits`, catalogId: "issue_food_permits", owner: "hl", kind: "action", status: "locked", title: "Issue food permits", phase: "before_event" });
    const vendor = (n: number, status: "done" | "submitted") =>
      makeTask({ id: `${NEW}:vendor_health_permit:${n}`, catalogId: "vendor_health_permit", reviewer: "hl", status, title: `Health permit: Truck ${n}`, payload: { vendorName: `Truck ${n}`, files: [{ name: `truck-${n}.pdf`, size: 1000, type: "application/pdf" }] } });
    const download = makeTask({ id: `${NEW}:vendor_food_permits`, catalogId: "vendor_food_permits", kind: "action", reviewer: "hl", status: "locked", unlocksOn: "food_permits_issued", title: "Download per-vendor food permits", phase: "before_event" });
    const fair = makeCase({
      id: NEW,
      name: "Harvest street fair",
      tier: "special",
      state: "permitted",
      submittedAt: "2027-04-01T09:00",
      permit: { issuedOn: "2027-05-03", signature: "Ada Park" },
      addOns: { ...EMPTY_ADDONS, foodVending: { vendors: 2, vendorNames: ["Truck 1", "Truck 2"] } },
      schedule: { date: "2027-08-14", start: "10:00", end: "18:00", occurrences: [{ date: "2027-08-14", availability: { status: "open" }, billing: "paid" }] },
      tasks: [vendor(1, "done"), vendor(2, "submitted"), download, issueTask],
    });
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(NEW, { tab: "documents" }), role: "hl", cases: [fair] });
    const vendors = within(screen.getByRole("heading", { name: "Vendors" }).closest("section")!);

    // One vendor is still out: the button is there, off, with the engine's own reason.
    expect(vendors.getByRole("button", { name: "Issue food permits" })).toBeDisabled();
    expect(vendors.getByText("1 of 2 vendor health permits still needs to be verified.")).toBeInTheDocument();

    // Health & Legal verifies the last one (the engine, as the Verify panel dispatches it).
    act(() => {
      expect(useDemo.getState().dispatch(NEW, { type: "verify_document", taskId: `${NEW}:vendor_health_permit:2` }).ok).toBe(true);
    });
    expect(vendors.getByText("2 of 2 verified")).toBeInTheDocument();
    const issue = vendors.getByRole("button", { name: "Issue food permits" });
    expect(issue).toBeEnabled();

    await user.click(issue);
    expect(storedCase(NEW).tasks.find((t) => t.catalogId === "issue_food_permits")?.status).toBe("done");
    expect(storedCase(NEW).tasks.find((t) => t.catalogId === "vendor_food_permits")?.status).toBe("todo");
    expect(vendors.getByText("Issued Mon, May 3, 2027.")).toBeInTheDocument();
    expect(vendors.queryByRole("button", { name: "Issue food permits" })).not.toBeInTheDocument();
  });

  it("another role sees the same block without the button", async () => {
    const issueTask = makeTask({ id: `${NEW}:issue_food_permits`, catalogId: "issue_food_permits", owner: "hl", kind: "action", status: "todo", title: "Issue food permits" });
    const vendor = makeTask({ id: `${NEW}:vendor_health_permit:1`, catalogId: "vendor_health_permit", reviewer: "hl", status: "done", title: "Health permit: Truck 1", payload: { vendorName: "Truck 1" } });
    const fair = makeCase({ id: NEW, tier: "special", state: "permitted", submittedAt: "2027-04-01T09:00", addOns: { ...EMPTY_ADDONS, foodVending: { vendors: 1, vendorNames: ["Truck 1"] } }, tasks: [vendor, issueTask] });
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(NEW, { tab: "documents" }), role: "clerk", cases: [fair] });
    const vendors = within(screen.getByRole("heading", { name: "Vendors" }).closest("section")!);
    expect(vendors.getByText("Health & Legal issues these (not yours to issue).")).toBeInTheDocument();
    expect(vendors.queryByRole("button", { name: "Issue food permits" })).not.toBeInTheDocument();
  });

  it("S3 reads 0 of 1 until the vendor's health permit is verified, and has no Issue food permits section (Standard, not Special)", async () => {
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

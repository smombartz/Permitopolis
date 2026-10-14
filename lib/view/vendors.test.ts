import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { issueFoodPermitsStatus, vendorPermitGroup, VENDOR_STATUS_LABEL } from "./vendors";

const TODAY = DEFAULT_DEMO_TODAY;
const cases = buildSeed();

function caseById(id: string) {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

describe("vendorPermitGroup", () => {
  it("S6's Main Street Food Truck Festival: 25 of 25 vendor health permits verified", () => {
    const s6 = caseById("PMT-27-0031");
    const group = vendorPermitGroup(s6);
    expect(group).not.toBeNull();
    expect(group).toMatchObject({ total: 25, verifiedCount: 25 });
    expect(group!.rows.every((row) => row.status === "verified")).toBe(true);
    expect(group!.rows.every((row) => row.validThrough !== null)).toBe(true);
  });

  it("S3's Jazz in the Plaza: 0 of 1 until the vendor's health permit is verified", () => {
    const s3 = caseById("PMT-27-0118");
    const group = vendorPermitGroup(s3);
    expect(group).toMatchObject({ total: 1, verifiedCount: 0 });
    expect(group!.rows[0].vendorName).toBe("Rolling Dumpling Co.");
    // Waiting on the applicant's answer to Health & Legal's request: not yet uploaded.
    expect(group!.rows[0].status).toBe("not_uploaded");
    expect(VENDOR_STATUS_LABEL[group!.rows[0].status]).toBe("Not uploaded");
  });

  it("is null for a case with no food vendors", () => {
    const noVendors = cases.find((c) => (c.addOns.foodVending?.vendors ?? 0) === 0 && c.tasks.length > 0)!;
    expect(vendorPermitGroup(noVendors)).toBeNull();
  });
});

describe("issueFoodPermitsStatus", () => {
  it("S6: Health & Legal issued the food permits on Apr 15, once all 25 vendors were verified", () => {
    const status = issueFoodPermitsStatus(caseById("PMT-27-0031"), TODAY);
    expect(status).toMatchObject({ issuedOn: "2027-04-15", verifiedCount: 25, total: 25, disabledReason: null });
    expect(status.task).toMatchObject({ owner: "hl", status: "done" });
  });

  it("S3 is Standard, not Special: there are no food permits to issue, so there is no task and nothing to show", () => {
    const status = issueFoodPermitsStatus(caseById("PMT-27-0118"), TODAY);
    expect(status.task).toBeNull();
    expect(status.disabledReason).toBeNull();
  });

  it("a Special event whose permit was just issued: disabled with the engine's own reason until the last vendor is verified", () => {
    const vendor = (n: number, status: "done" | "submitted") =>
      makeTask({ id: `PMT-27-0001:vendor_health_permit:${n}`, catalogId: "vendor_health_permit", reviewer: "hl", status, payload: { vendorName: `Truck ${n}` } });
    const issue = makeTask({ id: "PMT-27-0001:issue_food_permits", catalogId: "issue_food_permits", owner: "hl", kind: "action", status: "locked", title: "Issue food permits" });
    const waiting = makeCase({ tier: "special", state: "permitted", tasks: [vendor(1, "done"), vendor(2, "submitted"), issue] });
    expect(issueFoodPermitsStatus(waiting, TODAY)).toMatchObject({ issuedOn: null, verifiedCount: 1, total: 2, disabledReason: "1 of 2 vendor health permits still needs to be verified." });

    const ready = makeCase({ tier: "special", state: "permitted", tasks: [vendor(1, "done"), vendor(2, "done"), { ...issue, status: "todo" }] });
    expect(issueFoodPermitsStatus(ready, TODAY)).toMatchObject({ issuedOn: null, verifiedCount: 2, total: 2, disabledReason: null });
  });
});

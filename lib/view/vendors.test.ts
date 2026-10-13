import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { issueFoodPermitsEligible, issueFoodPermitsStatus, vendorPermitGroup, VENDOR_STATUS_LABEL } from "./vendors";

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

describe("issueFoodPermitsEligible", () => {
  it("S6 is a Special event with vendors, permitted: eligible", () => {
    expect(issueFoodPermitsEligible(caseById("PMT-27-0031"))).toBe(true);
  });

  it("S3 is Reviewed, not Special: never eligible", () => {
    expect(issueFoodPermitsEligible(caseById("PMT-27-0118"))).toBe(false);
  });
});

describe("issueFoodPermitsStatus", () => {
  it("S6: eligible, every vendor verified, but disabled for want of the engine step", () => {
    const status = issueFoodPermitsStatus(caseById("PMT-27-0031"));
    expect(status.eligible).toBe(true);
    expect(status.allVerified).toBe(true);
    expect(status.task).toBeNull();
    expect(status.disabledReason).toMatch(/does not exist yet/);
  });

  it("S3: not eligible at all, so there is nothing to show", () => {
    const status = issueFoodPermitsStatus(caseById("PMT-27-0118"));
    expect(status.eligible).toBe(false);
  });
});

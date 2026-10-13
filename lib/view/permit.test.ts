import { describe, expect, it } from "vitest";
import { cancellationRefund, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import { permitPageInfo, sessionRows, verifyStatus } from "./permit";

const TODAY = DEFAULT_DEMO_TODAY;

function caseById(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

describe("verifyStatus", () => {
  const cases = buildSeed();

  it("S1 (Permitted, single event) is valid", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    expect(verifyStatus(s1)).toEqual({ valid: true });
  });

  it("S5 (Quote sent, no permit yet) is not valid: not yet issued", () => {
    const s5 = caseById(cases, "PMT-27-0097");
    const result = verifyStatus(s5);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/hasn't been issued/i);
  });

  it("an unknown id is not valid: no such permit", () => {
    const result = verifyStatus(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no permit/i);
  });

  it("a cancelled permit is not valid: cancelled", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const cancelled: EventCase = { ...s1, ending: "cancelled", endingReason: "Cancelled." };
    const result = verifyStatus(cancelled);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cancelled/i);
  });

  it("a closed case (the event is over) is not valid", () => {
    // B19: Summit Ridge Running Club downtown dash, closed.
    const b19 = caseById(cases, "PMT-27-0040");
    expect(b19.state).toBe("closed");
    const result = verifyStatus(b19);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/over/i);
  });
});

describe("permitPageInfo", () => {
  const cases = buildSeed();

  it("S1 is ready", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    expect(permitPageInfo(s1)).toEqual({ ready: true });
  });

  it("S5 (no permit yet) is not ready, and links to the board", () => {
    const s5 = caseById(cases, "PMT-27-0097");
    const info = permitPageInfo(s5);
    expect(info.ready).toBe(false);
    expect(info.href).toBe(`/events/${s5.id}`);
  });

  it("an ended case is not ready", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const cancelled: EventCase = { ...s1, ending: "cancelled", endingReason: "Cancelled." };
    const info = permitPageInfo(cancelled);
    expect(info.ready).toBe(false);
    expect(info.message).toMatch(/cancelled/i);
  });

  it("a closed case with its original permit is still ready (a historical record)", () => {
    const b19 = caseById(cases, "PMT-27-0040");
    expect(permitPageInfo(b19)).toEqual({ ready: true });
  });
});

describe("sessionRows", () => {
  const cases = buildSeed();

  it("a single event has one row, always paid once the permit exists", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const rows = sessionRows(s1);
    expect(rows).toEqual([{ date: "2027-05-22", billing: "paid" }]);
  });

  it("a series lists every occurrence with its own billing mark, skipped sessions included", () => {
    // B16: Riverside Tai Chi Circle. Today (May 3) is due; May 31 is skipped for the blackout.
    const b16 = caseById(cases, "PMT-27-0034");
    const rows = sessionRows(b16);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.find((r) => r.date === TODAY)).toEqual({ date: TODAY, billing: "due" });
    expect(rows.find((r) => r.date === "2027-05-31")?.billing).toBe("skipped");
    expect(rows.find((r) => r.date === "2027-03-08")?.billing).toBe("paid");
  });
});

describe("cancellationRefund (lib/rules, read directly by the permit page)", () => {
  it("Maya Chen's picnic (S1) shows a $62.50 refund on the demo date", () => {
    const cases = buildSeed();
    const s1 = caseById(cases, "PMT-27-0109");
    const result = cancellationRefund(s1, TODAY);
    expect(result.refund).toBe(62.5);
  });
});

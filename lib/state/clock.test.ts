import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { advanceClock, applyTick } from "./clock";

vi.mock("@/lib/rules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rules")>("@/lib/rules");
  return {
    ...actual,
    closeoutCards: vi.fn(() => []),
    dueDate: vi.fn((base: string, days: number) => base.slice(0, 8) + String(Number(base.slice(8, 10)) + days).padStart(2, "0")),
  };
});

describe("applyTick: hold expiry", () => {
  it("expires the hold when the quote isn't paid in full by the expiry date", () => {
    const c = makeCase({
      state: "quote_sent",
      dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: "2027-05-02" },
      feeLines: [{ id: "f1", dept: "clerk", label: "Fee", qty: 1, unit: "flat", unitPrice: 100, estimate: 100, actual: null, kind: "fee" }],
    });
    const result = applyTick(c, makeCtx({ today: "2027-05-03" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("hold_expired");
    expect(result.case.dateHold.status).toBe("expired");
  });

  it("does not expire a fully paid quote", () => {
    const c = makeCase({
      state: "quote_sent",
      dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: "2027-05-02" },
      feeLines: [{ id: "f1", dept: "clerk", label: "Fee", qty: 1, unit: "flat", unitPrice: 100, estimate: 100, actual: null, kind: "fee" }],
      payments: [{ id: "p1", at: "2027-05-01T09:00", amount: 100, method: "card", kind: "quote" }],
    });
    const result = applyTick(c, makeCtx({ today: "2027-05-03" }));
    expect(result.ok).toBe(false);
  });
});

describe("applyTick: event day and returning to Permitted", () => {
  it("moves Permitted to Event day on a session date, unlocking carry_permit", () => {
    const carry = makeTask({ id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", status: "locked", unlocksOn: "event_day" });
    const c = makeCase({ state: "permitted", schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] }, tasks: [carry] });
    const result = applyTick(c, makeCtx({ today: "2027-05-22" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("event_day");
    expect(result.case.tasks[0].status).toBe("todo");
  });

  it("a weekly series returns to Permitted the day after a session when another remains", () => {
    const c = makeCase({
      state: "event_day",
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        occurrences: [
          { date: "2027-06-06", availability: { status: "open" }, billing: "paid" },
          { date: "2027-06-13", availability: { status: "open" }, billing: "upcoming" },
        ],
      },
    });
    const result = applyTick(c, makeCtx({ today: "2027-06-07" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("permitted");
  });
});

describe("applyTick: Closeout and Instant closing itself", () => {
  it("Reviewed/Special events move to Closeout with cleanup, hours and reconcile tasks", () => {
    const c = makeCase({
      state: "event_day",
      tier: "special",
      schedule: { date: "2027-04-24", start: "12:00", end: "21:00", occurrences: [{ date: "2027-04-24", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = applyTick(c, makeCtx({ today: "2027-04-25" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("closeout");
    expect(result.case.tasks.map((t) => t.catalogId)).toEqual(expect.arrayContaining(["cleanup_inspection", "log_actual_hours", "reconcile"]));
    expect(result.case.tasks.find((t) => t.catalogId === "reconcile")?.status).toBe("locked");
  });

  it("an Instant event with no issues closes itself straight to Closed", () => {
    const c = makeCase({
      state: "event_day",
      tier: "instant",
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = applyTick(c, makeCtx({ today: "2027-05-23" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("closed");
  });

  it("an Instant event flagged with cleanup issues enters Closeout with just the exception task", () => {
    const c = makeCase({
      state: "event_day",
      tier: "instant",
      closeout: { cleanup: "issues", notes: "Damaged picnic table.", hoursLoggedOn: "2027-05-22", balance: null, refund: null, feedback: null },
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = applyTick(c, makeCtx({ today: "2027-05-23" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("closeout");
    expect(result.case.tasks.find((t) => t.catalogId === "instant_exception")).toBeDefined();
  });

  it("returns a no-op when nothing changes for the case today", () => {
    const c = makeCase({ state: "draft" });
    const result = applyTick(c, makeCtx({ today: "2027-05-04" }));
    expect(result.ok).toBe(false);
  });
});

describe("advanceClock", () => {
  it("replays tick for every day from (exclusive) to to (inclusive) across all cases", () => {
    const c = makeCase({
      state: "permitted",
      schedule: { date: "2027-05-05", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-05", availability: { status: "open" }, billing: "paid" }] },
    });
    const [result] = advanceClock([c], "2027-05-03", "2027-05-05", DEFAULT_CONFIG);
    expect(result.state).toBe("event_day");
  });

  it("is a no-op when moving backwards or staying put", () => {
    const c = makeCase({ state: "draft" });
    expect(advanceClock([c], "2027-05-03", "2027-05-01", DEFAULT_CONFIG)).toEqual([c]);
    expect(advanceClock([c], "2027-05-03", "2027-05-03", DEFAULT_CONFIG)).toEqual([c]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { EMPTY_ADDONS } from "@/lib/types";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { advanceClock, applyTick, sessionDates } from "./clock";

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

  it("a series carries its permit to every session: the card relocks for the next one, and opens dated that day", () => {
    const session = (date: string, billing: "paid" | "upcoming") => ({ date, availability: { status: "open" as const }, billing });
    const carry = makeTask({ id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", kind: "action", status: "locked", unlocksOn: "event_day", dueDate: "2027-06-06", history: [] });
    const series = makeCase({
      state: "permitted",
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-20" },
        occurrences: [session("2027-06-06", "paid"), session("2027-06-13", "upcoming"), session("2027-06-20", "upcoming")],
      },
      tasks: [carry],
    });
    const card = (c: typeof series) => c.tasks.find((t) => t.catalogId === "carry_permit")!;
    const billing = (c: typeof series) => c.schedule!.occurrences.map((o) => o.billing);

    // The first session: paid at booking, so nothing is due.
    const [first] = advanceClock([series], "2027-06-05", "2027-06-06", DEFAULT_CONFIG);
    expect(first.state).toBe("event_day");
    expect(card(first)).toMatchObject({ status: "todo", dueDate: "2027-06-06" });
    expect(billing(first)).toEqual(["paid", "upcoming", "upcoming"]);

    // The day after: back to Permitted, and the card waits for Jun 13.
    const [between] = advanceClock([first], "2027-06-06", "2027-06-07", DEFAULT_CONFIG);
    expect(between.state).toBe("permitted");
    expect(card(between)).toMatchObject({ status: "locked", unlocksOn: "event_day", dueDate: "2027-06-13" });

    // The second session: its payment is due today, and the card is today's.
    const [second] = advanceClock([between], "2027-06-07", "2027-06-13", DEFAULT_CONFIG);
    expect(second.state).toBe("event_day");
    expect(card(second)).toMatchObject({ status: "todo", unlocksOn: null, dueDate: "2027-06-13" });
    expect(billing(second)).toEqual(["paid", "due", "upcoming"]);

    // After the last session the card is done for good.
    const [after] = advanceClock([second], "2027-06-13", "2027-06-21", DEFAULT_CONFIG);
    expect(after.state).toBe("closed");
    expect(card(after).status).toBe("done");
    expect(billing(after)).toEqual(["paid", "due", "due"]);
  });

  it("a single event's one session is never marked due: it was paid for with the booking or the quote", () => {
    const c = makeCase({ state: "permitted", schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "upcoming" }] } });
    const result = applyTick(c, makeCtx({ today: "2027-05-22" }));
    expect(result.ok && result.case.schedule?.occurrences[0].billing).toBe("upcoming");
  });

  it("a session skipped for a blackout is not an event day", () => {
    const c = makeCase({
      state: "permitted",
      schedule: {
        date: "2027-05-24",
        start: "07:00",
        end: "08:00",
        recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-07" },
        occurrences: [
          { date: "2027-05-24", availability: { status: "open" }, billing: "paid" },
          { date: "2027-05-31", availability: { status: "blackout" }, billing: "skipped" },
          { date: "2027-06-07", availability: { status: "open" }, billing: "upcoming" },
        ],
      },
    });
    expect(sessionDates(c)).toEqual(["2027-05-24", "2027-06-07"]);
    expect(applyTick(c, makeCtx({ today: "2027-05-31" })).ok).toBe(false);
    const next = applyTick(c, makeCtx({ today: "2027-06-07" }));
    expect(next.ok && next.case.state).toBe("event_day");
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
    const reconcile = result.case.tasks.find((t) => t.catalogId === "reconcile");
    expect(reconcile?.status).toBe("locked");
    // Without this the Clerk's reconciliation would never leave "locked" once hours are logged.
    expect(reconcile?.unlocksOn).toBe("hours_logged");
  });

  it("\"Carry your permit\" is done once the last session has passed, in Closeout and in Closed", () => {
    const carry = () => makeTask({ id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", kind: "action", status: "todo" });
    const schedule = { date: "2027-04-24", start: "12:00", end: "21:00", occurrences: [{ date: "2027-04-24", availability: { status: "open" as const }, billing: "paid" as const }] };
    for (const tier of ["special", "instant"] as const) {
      const result = applyTick(makeCase({ state: "event_day", tier, schedule, tasks: [carry()] }), makeCtx({ today: "2027-04-25" }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.case.state).toBe(tier === "instant" ? "closed" : "closeout");
      expect(result.case.tasks.find((t) => t.catalogId === "carry_permit")?.status).toBe("done");
    }
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

  it("...and gives up its date: a closed case holds nothing", () => {
    const c = makeCase({
      state: "event_day",
      tier: "instant",
      dateHold: { status: "held", placedOn: "2027-04-26", expiresOn: null },
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = applyTick(c, makeCtx({ today: "2027-05-23" }));
    expect(result.ok && result.case.dateHold).toEqual({ status: "released", placedOn: "2027-04-26", expiresOn: null });
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

  it("an amendment still pending when the event arrives lapses: the Instant plan the permit covers closes itself, it does not go to Closeout as the Reviewed plan nobody approved", () => {
    const occurrences = [{ date: "2027-05-22", availability: { status: "open" as const }, billing: "paid" as const }];
    const schedule = { date: "2027-05-22", start: "11:00", end: "16:00", occurrences };
    const shelter = { id: "PMT-27-0001:fee:1", dept: "clerk" as const, label: "Shelter reservation", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" as const };
    const deposit = { ...shelter, id: "PMT-27-0001:fee:2", label: "Refundable cleanup deposit", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, kind: "deposit" as const };
    // Demo path 7 where the script leaves it: the DJ proposed, the new cards open, nothing submitted.
    const pending = makeCase({
      state: "permitted",
      tier: "reviewed",
      triggers: [{ id: "amplified_sound", raisesTo: "reviewed", label: "Amplified sound" }],
      addOns: { ...EMPTY_ADDONS, amplifiedSound: true },
      schedule,
      permit: { issuedOn: "2027-04-26", signature: null },
      dateHold: { status: "held", placedOn: "2027-04-26", expiresOn: null },
      feeLines: [shelter, deposit],
      payments: [{ id: "PMT-27-0001:pay:1", at: "2027-04-26T09:05", amount: 125, method: "card", kind: "booking" }],
      flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: false, amendmentPending: true },
      tasks: [
        makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", status: "done", payload: { amount: 125 } }),
        makeTask({ id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", kind: "action", status: "locked", unlocksOn: "event_day", dueDate: "2027-05-22" }),
        makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", tags: ["amendment"] }),
        makeTask({
          id: "PMT-27-0001:submit_application",
          catalogId: "submit_application",
          status: "locked",
          unlocksOn: "presubmit_done",
          tags: ["amendment"],
          payload: {
            pendingAmendment: {
              priorAnswers: { eventType: "picnic_party", name: "Test event", location: null, schedule, attendance: 40, addOns: EMPTY_ADDONS },
              priorTier: "instant",
              priorTriggers: [],
              priorLateFee: false,
              priorFeeLines: [shelter],
              priorSubmit: null,
              proposedOn: "2027-05-03",
            },
          },
        }),
      ],
    });

    const [eventDay] = advanceClock([pending], "2027-05-21", "2027-05-22", DEFAULT_CONFIG);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "instant", triggers: [], addOns: EMPTY_ADDONS, feeLines: [shelter], flags: { amendmentPending: false } });
    expect(eventDay.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["pay_fees", "done"],
      ["carry_permit", "todo"],
    ]);

    const [after] = advanceClock([pending], "2027-05-21", "2027-05-23", DEFAULT_CONFIG);
    expect(after).toMatchObject({ state: "closed", tier: "instant", dateHold: { status: "released" } });
    expect(after.tasks.filter((t) => t.tags.includes("amendment"))).toEqual([]);
    expect(after.tasks.some((t) => t.catalogId === "cleanup_inspection")).toBe(false);
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

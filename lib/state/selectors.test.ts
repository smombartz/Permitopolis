import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { buildSeed } from "./seed";
import { makeCase, makeTask } from "./testSupport";
import { transition } from "./transition";
import {
  activePermits,
  applicantCases,
  boardColumn,
  boardColumns,
  caseTotals,
  closeoutSettlement,
  daysUntilEvent,
  eventDate,
  hasActivePermit,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  permitSessions,
  queueFor,
  reviewClock,
  whoIsUp,
} from "./selectors";

describe("boardColumn", () => {
  it("maps task status to the four board columns", () => {
    expect(boardColumn(makeTask({ id: "a", catalogId: "x", status: "todo" }))).toBe("do_now");
    expect(boardColumn(makeTask({ id: "a", catalogId: "x", status: "changes_requested" }))).toBe("do_now");
    expect(boardColumn(makeTask({ id: "a", catalogId: "x", status: "submitted" }))).toBe("with_city");
    expect(boardColumn(makeTask({ id: "a", catalogId: "x", status: "locked" }))).toBe("coming_up");
    expect(boardColumn(makeTask({ id: "a", catalogId: "x", status: "done" }))).toBe("done");
  });
});

describe("isOpen / isVisibleToCity / involves", () => {
  it("isOpen is false once ended or closed", () => {
    expect(isOpen(makeCase({ state: "in_review" }))).toBe(true);
    expect(isOpen(makeCase({ state: "closed" }))).toBe(false);
    expect(isOpen(makeCase({ state: "submitted", ending: "withdrawn" }))).toBe(false);
  });

  it("Drafts are invisible to the city", () => {
    expect(isVisibleToCity(makeCase({ state: "draft" }))).toBe(false);
    expect(isVisibleToCity(makeCase({ state: "submitted" }))).toBe(true);
  });

  it("the applicant is always involved; a department only once routed or holding a task", () => {
    const c = makeCase({ state: "draft" });
    expect(involves(c, "applicant")).toBe(true);
    expect(involves(c, "clerk")).toBe(false);
    expect(involves(c, "pws")).toBe(false);
  });
});

describe("boardColumns", () => {
  const card = (suffix: string, extra: Partial<Parameters<typeof makeTask>[0]> = {}) => makeTask({ id: `PMT-27-0001:${suffix}`, catalogId: suffix, ...extra });
  const request = { from: "hl" as const, message: "Please upload it.", at: "2027-04-30T09:05", dueDate: "2027-05-05", resolved: false };

  it("sorts the applicant's cards into the four columns and leaves the city's tasks out", () => {
    const c = makeCase({
      state: "needs_info",
      tasks: [
        card("insurance_certificate", { status: "done" }),
        card("vendor_list", { status: "submitted" }),
        card("vendor_health_permit", { status: "todo" }),
        card("accept_and_sign", { status: "locked" }),
        card("sound_details", { status: "changes_requested" }),
        card("review:hl", { owner: "hl", kind: "review" }),
      ],
    });
    const columns = boardColumns(c);
    expect(Object.fromEntries(Object.entries(columns).map(([column, tasks]) => [column, tasks.map((t) => t.catalogId)]))).toEqual({
      do_now: ["vendor_health_permit", "sound_details"],
      with_city: ["vendor_list"],
      coming_up: ["accept_and_sign"],
      done: ["insurance_certificate"],
    });
  });

  it("Do now: a city request is pinned on top, then Submit application once it unlocks, then by due date", () => {
    const c = makeCase({
      state: "draft",
      tasks: [
        card("no_date", { dueDate: null }),
        card("later", { dueDate: "2027-06-04" }),
        card("sooner", { dueDate: "2027-05-10" }),
        card("submit_application", { dueDate: "2027-05-19" }),
        card("asked_for", { dueDate: "2027-06-30", request }),
      ],
    });
    expect(boardColumns(c).do_now.map((t) => t.catalogId)).toEqual(["asked_for", "submit_application", "sooner", "later", "no_date"]);
  });

  it("an answered request no longer pins its card", () => {
    const c = makeCase({ tasks: [card("sooner", { dueDate: "2027-05-10" }), card("answered", { dueDate: "2027-06-04", status: "changes_requested", request: { ...request, resolved: true } })] });
    expect(boardColumns(c).do_now.map((t) => t.catalogId)).toEqual(["sooner", "answered"]);
  });
});

describe("whoIsUp", () => {
  it("names the parties that are up now, in the order applicant, clerk, pws, hl", () => {
    const sign = makeTask({ id: "PMT-27-0097:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off" });
    const verify = makeTask({ id: "PMT-27-0097:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review" });
    const issue = makeTask({ id: "PMT-27-0097:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "locked" });
    expect(whoIsUp(makeCase({ state: "quote_sent", tasks: [verify, issue, sign] }), "2027-05-03")).toEqual(["applicant", "hl"]);
    expect(whoIsUp(makeCase({ state: "permitted" }), "2027-05-03")).toEqual([]);
    expect(whoIsUp(makeCase({ state: "submitted", ending: "withdrawn", tasks: [sign] }), "2027-05-03")).toEqual([]);
  });
});

describe("active permits", () => {
  const on = (date: string, billing: "paid" | "upcoming" | "skipped" = "upcoming") => ({ date, availability: { status: "open" as const }, billing });
  const single = (id: string, date: string, extra: Partial<Parameters<typeof makeCase>[0]> = {}) =>
    makeCase({ id, state: "permitted", schedule: { date, start: "11:00", end: "16:00", occurrences: [on(date)] }, ...extra });
  const held = { status: "held" as const, placedOn: "2027-04-19", expiresOn: "2027-05-14" };

  const picnic = single("PMT-27-0109", "2027-05-22");
  const festival = single("PMT-27-0031", "2027-04-24", { state: "closeout" });
  const taiChi = makeCase({
    id: "PMT-27-0034",
    state: "event_day",
    schedule: {
      date: "2027-05-24",
      start: "07:00",
      end: "08:00",
      recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-07" },
      occurrences: [on("2027-05-24", "paid"), on("2027-05-31", "skipped"), on("2027-06-07")],
    },
  });
  const quoted = single("PMT-27-0097", "2027-07-11", { state: "quote_sent", dateHold: held });
  const others = [
    single("PMT-27-0050", "2027-06-15", { ending: "cancelled" }),
    single("PMT-27-0044", "2027-03-01", { state: "closed" }),
    single("PMT-27-0118", "2027-06-18", { state: "needs_info", dateHold: { ...held, expiresOn: null } }),
    single("PMT-27-0052", "2027-07-01", { state: "quote_sent", ending: "hold_expired", dateHold: { ...held, status: "expired" } }),
    makeCase({ id: "PMT-27-0142", state: "draft" }),
  ];
  const cases = [quoted, picnic, ...others, taiChi, festival];

  it("hasActivePermit: Permitted, Event day or Closeout, and not ended", () => {
    expect(cases.filter(hasActivePermit).map((c) => c.id)).toEqual(["PMT-27-0109", "PMT-27-0034", "PMT-27-0031"]);
  });

  it("activePermits lists them by event date, soonest first", () => {
    expect(activePermits(cases, "2027-05-03").map((c) => c.id)).toEqual(["PMT-27-0031", "PMT-27-0109", "PMT-27-0034"]);
  });

  it("with holds: Quote sent cases that hold their date join the list, and only those", () => {
    expect(activePermits(cases, "2027-05-03", { includeHolds: true }).map((c) => c.id)).toEqual(["PMT-27-0031", "PMT-27-0109", "PMT-27-0034", "PMT-27-0097"]);
  });

  it("permitSessions gives the calendar one entry per session held, in date order, without skipped sessions", () => {
    expect(permitSessions(cases).map((s) => [s.case.id, s.date])).toEqual([
      ["PMT-27-0031", "2027-04-24"],
      ["PMT-27-0109", "2027-05-22"],
      ["PMT-27-0034", "2027-05-24"],
      ["PMT-27-0034", "2027-06-07"],
    ]);
  });

  it("permitSessions takes a date range and the holds toggle", () => {
    expect(permitSessions(cases, { from: "2027-05-22", to: "2027-05-31" }).map((s) => s.date)).toEqual(["2027-05-22", "2027-05-24"]);
    expect(permitSessions(cases, { from: "2027-07-01", includeHolds: true }).map((s) => [s.case.id, s.date])).toEqual([["PMT-27-0097", "2027-07-11"]]);
  });
});

describe("applicantCases", () => {
  it("filters by applicantId", () => {
    const mine = makeCase({ id: "PMT-27-0001", applicantId: "maya" });
    const other = makeCase({ id: "PMT-27-0002", applicantId: "someone-else" });
    expect(applicantCases([mine, other], "maya")).toEqual([mine]);
  });
});

describe("queueFor", () => {
  it("groups by due date against today", () => {
    const overdue = makeTask({ id: "a", catalogId: "x", owner: "pws", dueDate: "2027-05-01" });
    const soon = makeTask({ id: "b", catalogId: "y", owner: "pws", dueDate: "2027-05-08" });
    const later = makeTask({ id: "c", catalogId: "z", owner: "pws", dueDate: "2027-06-01" });
    const c = makeCase({ state: "in_review", tasks: [overdue, soon, later] });
    const items = queueFor([c], "pws", "2027-05-03");
    expect(items.find((i) => i.task.id === "a")?.group).toBe("overdue");
    expect(items.find((i) => i.task.id === "b")?.group).toBe("this_week");
    expect(items.find((i) => i.task.id === "c")?.group).toBe("later");
  });

  it("excludes closed and ended cases", () => {
    const task = makeTask({ id: "a", catalogId: "x", owner: "pws" });
    const c = makeCase({ state: "closed", tasks: [task] });
    expect(queueFor([c], "pws", "2027-05-03")).toEqual([]);
  });

  it("lists the tasks oldest due first across cases, with undated tasks last", () => {
    const first = makeCase({ id: "PMT-27-0001", state: "in_review", tasks: [makeTask({ id: "a", catalogId: "later", owner: "hl", dueDate: "2027-06-01" }), makeTask({ id: "b", catalogId: "undated", owner: "hl" })] });
    const second = makeCase({ id: "PMT-27-0002", state: "in_review", tasks: [makeTask({ id: "c", catalogId: "overdue", owner: "hl", dueDate: "2027-04-10" }), makeTask({ id: "d", catalogId: "soon", owner: "hl", dueDate: "2027-05-07" })] });
    expect(queueFor([first, second], "hl", "2027-05-03").map((item) => [item.task.catalogId, item.group])).toEqual([
      ["overdue", "overdue"],
      ["soon", "this_week"],
      ["later", "later"],
      ["undated", "later"],
    ]);
  });
});

describe("queueFor: days waiting", () => {
  it("counts from the start of the stretch the task has been open for now: a review parked on a request counts from the answer, a check reopened by a second upload from that upload", () => {
    const entry = (at: string, status: "todo" | "locked" | "done" | "changes_requested") => ({ at: `${at}T09:00`, actor: "system" as const, status });
    const tasks = [
      // Routed Apr 19, parked on a request Apr 30, back when the applicant answered on May 3.
      makeTask({ id: "resumed", catalogId: "review:hl", owner: "hl", kind: "review", history: [entry("2027-04-19", "todo"), entry("2027-04-30", "locked"), entry("2027-05-03", "todo")] }),
      // Never parked: since routing.
      makeTask({ id: "steady", catalogId: "review:hl", owner: "hl", kind: "review", history: [entry("2027-04-19", "todo")] }),
      // Verified on Apr 20, opened again by a new upload on Apr 30.
      makeTask({ id: "reopened", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review", history: [entry("2027-04-12", "todo"), entry("2027-04-20", "done"), entry("2027-04-30", "todo")] }),
    ];
    const days = Object.fromEntries(queueFor([makeCase({ state: "in_review", tasks })], "hl", "2027-05-03").map((item) => [item.task.id, item.daysWaiting]));
    expect(days).toEqual({ resumed: 0, steady: 14, reopened: 3 });
  });
});

describe("queueFor: a task with no due date", () => {
  const opened = (id: string, at: string) => makeTask({ id, catalogId: id, owner: "clerk", kind: "action", history: [{ at, actor: "system", status: "todo" }] });

  it("is Later while it is fresh, and This week once it has waited more than a week", () => {
    const c = makeCase({ state: "in_review", tasks: [opened("fresh", "2027-05-03T09:00"), opened("a_week", "2027-04-26T09:00"), opened("eight_days", "2027-04-25T09:00"), opened("seven_weeks", "2027-03-15T09:00")] });
    const groups = Object.fromEntries(queueFor([c], "clerk", "2027-05-03").map((item) => [item.task.id, item.group]));
    expect(groups).toEqual({ fresh: "later", a_week: "later", eight_days: "this_week", seven_weeks: "this_week" });
  });

  it("counts from when the task was last opened, not from when it was created locked", () => {
    const unlockedToday = makeTask({
      id: "consolidate",
      catalogId: "consolidate",
      owner: "clerk",
      kind: "action",
      history: [
        { at: "2027-03-15T09:00", actor: "system", status: "locked" },
        { at: "2027-05-03T09:00", actor: "system", status: "todo" },
      ],
    });
    expect(queueFor([makeCase({ state: "in_review", tasks: [unlockedToday] })], "clerk", "2027-05-03")[0].group).toBe("later");
  });

  it("on the seed, the Clerk's long-waiting steps are no longer the bottom group", () => {
    const waiting = queueFor(buildSeed(), "clerk", "2027-05-03").filter((item) => item.task.dueDate === null);
    expect(waiting.length).toBeGreaterThan(0);
    for (const item of waiting) expect(item.group, `${item.case.id} ${item.task.title}`).toBe(item.daysWaiting > 7 ? "this_week" : "later");
    expect(waiting.some((item) => item.group === "this_week")).toBe(true);
  });
});

describe("closeoutSettlement", () => {
  const line = (id: string, estimate: number, actual: number | null, kind: "fee" | "deposit" = "fee") => ({ id, dept: "pws" as const, label: id, qty: 1, unit: "flat", unitPrice: estimate, estimate, actual, kind });

  it("S6 once the hours are in: $750 over, all of it from the $1,000 deposit, $250 back, nothing billed", () => {
    const c = makeCase({ state: "closeout", feeLines: [line("police", 5610, 6120), line("crew", 0, 240), line("deposit", 1000, null, "deposit")] });
    expect(closeoutSettlement(c)).toEqual({ over: 750, deposit: 1000, fromDeposit: 750, refund: 250, bill: null });
  });

  it("an overage beyond the deposit: the deposit goes first and the rest is the final bill", () => {
    const c = makeCase({ state: "closeout", feeLines: [line("crew", 0, 300), line("deposit", 250, null, "deposit")] });
    expect(closeoutSettlement(c)).toEqual({ over: 300, deposit: 250, fromDeposit: 250, refund: null, bill: 50 });
  });

  it("nothing logged yet, or exactly on estimate: the whole deposit goes back", () => {
    const c = makeCase({ state: "closeout", feeLines: [line("police", 5610, null), line("deposit", 1000, null, "deposit")] });
    expect(closeoutSettlement(c)).toEqual({ over: 0, deposit: 1000, fromDeposit: 0, refund: 1000, bill: null });
  });

  it("is what reconcile_close does, for every seeded case in Closeout with its hours logged", () => {
    const seed = buildSeed();
    const ready = seed.filter((c) => c.state === "closeout" && c.ending === null && c.closeout.hoursLoggedOn !== null);
    expect(ready.length).toBeGreaterThan(0);
    for (const c of ready) {
      const settlement = closeoutSettlement(c);
      const result = transition(c, { type: "reconcile_close" }, "clerk", { today: "2027-05-03", cases: seed, cfg: DEFAULT_CONFIG });
      if (!result.ok) throw new Error(result.reason);
      expect(result.case.closeout.balance, c.id).toBe(settlement.over);
      expect(result.case.closeout.refund, c.id).toBe(settlement.refund);
      const refunded = result.case.payments.at(-1);
      if (settlement.refund) expect(refunded, c.id).toMatchObject({ kind: "refund", amount: -settlement.refund });
      // What caseTotals says is due after reconciling is the bill, and only the bill.
      expect(caseTotals(result.case).due, c.id).toBe(settlement.bill ?? 0);
    }
  });
});

describe("reviewClock", () => {
  it("formats the label with an elapsed day count and a pause note", () => {
    const c = makeCase({
      reviews: [{ dept: "hl", sections: [], status: "needs_info", dueDate: "2027-05-10", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: "2027-04-30", pausedDays: 0, allowedDays: 21 }, internalNote: "", messageToApplicant: "" }],
    });
    const view = reviewClock(c, "hl", "2027-05-03");
    expect(view).toMatchObject({ of: 21, paused: true });
    expect(view?.label).toContain("Day");
    expect(view?.label).toContain("paused");
  });

  it("counts the days elapsed, less the days paused: S3 on May 3 is Day 11 of 14, paused 3 days", () => {
    const c = makeCase({
      reviews: [{ dept: "hl", sections: [], status: "needs_info", dueDate: "2027-05-03", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: "2027-04-30", pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" }],
    });
    expect(reviewClock(c, "hl", "2027-05-03")).toEqual({ day: 11, of: 14, pausedDays: 3, paused: true, label: "Day 11 of 14 · paused 3 days" });
  });

  it("stops on the day the review was decided", () => {
    const c = makeCase({
      reviews: [{ dept: "pws", sections: [], status: "approved", dueDate: "2027-04-14", decidedOn: "2027-04-10", clock: { startedOn: "2027-03-10", pausedSince: null, pausedDays: 2, allowedDays: 21 }, internalNote: "", messageToApplicant: "" }],
    });
    expect(reviewClock(c, "pws", "2027-04-10")?.label).toBe("Day 29 of 21 · paused 2 days");
    expect(reviewClock(c, "pws", "2027-05-03")?.label).toBe("Day 29 of 21 · paused 2 days");
  });

  it("is null when the department isn't routed", () => {
    expect(reviewClock(makeCase(), "pws", "2027-05-03")).toBeNull();
  });
});

describe("eventDate / daysUntilEvent", () => {
  it("picks the next upcoming session, or the last one once all have passed", () => {
    const c = makeCase({
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
    expect(eventDate(c, "2027-06-07")).toBe("2027-06-13");
    expect(daysUntilEvent(c, "2027-06-07")).toBe(6);
    expect(eventDate(c, "2027-07-01")).toBe("2027-06-13");
  });
});

describe("caseTotals", () => {
  it("sums fees, deposit, paid and due", () => {
    const c = makeCase({
      feeLines: [
        { id: "f1", dept: "clerk", label: "App fee", qty: 1, unit: "flat", unitPrice: 50, estimate: 50, actual: null, kind: "fee" },
        { id: "f2", dept: "clerk", label: "Deposit", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, actual: null, kind: "deposit" },
      ],
      payments: [{ id: "p1", at: "2027-05-01T09:00", amount: 50, method: "card", kind: "quote" }],
    });
    expect(caseTotals(c)).toEqual({ fees: 50, deposit: 250, total: 300, paid: 50, due: 250 });
  });

  it("adds up to the cent: 62.1 + 62.2 + 62.3 is $186.60, and $124.50 is due after the first", () => {
    const c = makeCase({
      feeLines: [62.1, 62.2, 62.3].map((amount, i) => ({ id: `f${i}`, dept: "clerk" as const, label: `Line ${i}`, qty: 1, unit: "flat", unitPrice: amount, estimate: amount, actual: null, kind: "fee" as const })),
      payments: [{ id: "p1", at: "2027-05-01T09:00", amount: 62.1, method: "card", kind: "quote" }],
    });
    expect(caseTotals(c)).toEqual({ fees: 186.6, deposit: 0, total: 186.6, paid: 62.1, due: 124.5 });
  });

  it("after reconciling, the deposit is settled: a refunded case owes nothing (S6)", () => {
    const c = makeCase({
      state: "closed",
      closeout: { cleanup: "pass", notes: "", hoursLoggedOn: "2027-05-03", balance: 750, refund: 250, feedback: null },
      feeLines: [
        { id: "f1", dept: "pws", label: "Police", qty: 66, unit: "officer-hour", unitPrice: 85, estimate: 5610, actual: 6120, kind: "fee" },
        { id: "f2", dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: 60, estimate: 0, actual: 240, kind: "fee" },
        { id: "f3", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: 1000, estimate: 1000, actual: 1000, kind: "deposit" },
      ],
      payments: [
        { id: "p1", at: "2027-03-13T09:05", amount: 6610, method: "card", kind: "quote" },
        { id: "p2", at: "2027-05-03T09:00", amount: -250, method: "in_person", kind: "refund" },
      ],
    });
    expect(caseTotals(c)).toEqual({ fees: 6360, deposit: 0, total: 6360, paid: 6360, due: 0 });
  });

  it("after reconciling, an overage beyond the deposit is what is due", () => {
    const c = makeCase({
      state: "closed",
      closeout: { cleanup: "issues", notes: "", hoursLoggedOn: "2027-03-16", balance: 300, refund: null, feedback: null },
      feeLines: [
        { id: "f1", dept: "clerk", label: "Field reservation", qty: 4, unit: "hour", unitPrice: 20, estimate: 80, actual: 80, kind: "fee" },
        { id: "f2", dept: "clerk", label: "Application fee", qty: 1, unit: "application", unitPrice: 50, estimate: 50, actual: 50, kind: "fee" },
        { id: "f3", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: 250, estimate: 250, actual: 250, kind: "deposit" },
        { id: "f4", dept: "pws", label: "Extra cleanup crew", qty: 5, unit: "worker-hour", unitPrice: 60, estimate: 0, actual: 300, kind: "fee" },
      ],
      payments: [{ id: "p1", at: "2027-01-21T09:05", amount: 380, method: "card", kind: "quote" }],
    });
    expect(caseTotals(c)).toMatchObject({ fees: 430, total: 430, paid: 380, due: 50 });
  });

  it("a cancelled case owes nothing more", () => {
    const c = makeCase({
      state: "permitted",
      ending: "cancelled",
      feeLines: [{ id: "f1", dept: "clerk", label: "Shelter reservation", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }],
      payments: [
        { id: "p1", at: "2027-04-26T09:05", amount: 125, method: "card", kind: "booking" },
        { id: "p2", at: "2027-05-03T09:00", amount: -62.5, method: "card", kind: "refund" },
      ],
    });
    expect(caseTotals(c)).toMatchObject({ paid: 62.5, due: 0 });
  });
});

describe("leadTimeRisk", () => {
  it("flags at_risk when days left fall under what the state needs", () => {
    const c = makeCase({
      state: "submitted",
      schedule: { date: "2027-05-10", start: "09:00", end: "10:00", occurrences: [{ date: "2027-05-10", availability: { status: "open" }, billing: "upcoming" }] },
    });
    expect(leadTimeRisk(c, "2027-05-03", DEFAULT_CONFIG)).toBe("at_risk");
  });
});

describe("nextCaseId", () => {
  it("is PMT-27- plus the highest number in use plus one, zero-padded", () => {
    const cases = [makeCase({ id: "PMT-27-0007" }), makeCase({ id: "PMT-27-0142" }), makeCase({ id: "PMT-27-0003" })];
    expect(nextCaseId(cases)).toBe("PMT-27-0143");
  });

  it("starts at 0001 with no cases yet", () => {
    expect(nextCaseId([])).toBe("PMT-27-0001");
  });
});

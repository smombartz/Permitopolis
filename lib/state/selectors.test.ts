import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { makeCase, makeTask } from "./testSupport";
import {
  applicantCases,
  boardColumn,
  caseTotals,
  daysUntilEvent,
  eventDate,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  queueFor,
  reviewClock,
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

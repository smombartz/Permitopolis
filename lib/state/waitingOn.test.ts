import { describe, expect, it } from "vitest";
import { PARTIES } from "@/lib/types";
import { makeCase, makeTask } from "./testSupport";
import { isStalled, nextMove, waitingOn } from "./waitingOn";

describe("waitingOn", () => {
  it("always returns four rows, in order applicant, clerk, pws, hl", () => {
    const rows = waitingOn(makeCase({ state: "draft" }), "2027-05-03");
    expect(rows.map((r) => r.party)).toEqual(PARTIES);
  });

  it("S4 (Maple Street block party): the applicant is up, waiting on neighbors, not the Clerk", () => {
    const signoff = makeTask({ id: "PMT-27-0097:neighbor_signoff", catalogId: "neighbor_signoff", payload: { progress: { done: 9, total: 12 } } });
    const c = makeCase({ state: "submitted", tasks: [signoff] });
    const rows = waitingOn(c, "2027-05-03");
    expect(rows.find((r) => r.party === "applicant")?.status).toBe("up_now");
    expect(rows.find((r) => r.party === "clerk")?.status).not.toBe("up_now");
  });

  it("S5 (Quote sent): both the applicant and Health & Legal are up", () => {
    const acceptSign = makeTask({ id: "PMT-27-0097:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off" });
    const insurance = makeTask({ id: "PMT-27-0097:insurance_certificate", catalogId: "insurance_certificate", owner: "applicant", reviewer: "hl", status: "submitted" });
    const verify = makeTask({ id: "PMT-27-0097:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review" });
    const pws = { dept: "pws" as const, sections: ["Route"], status: "approved" as const, dueDate: "2027-05-01", decidedOn: "2027-04-25", clock: { startedOn: "2027-04-01", pausedSince: null, pausedDays: 0, allowedDays: 60 }, internalNote: "", messageToApplicant: "" };
    const hl = { dept: "hl" as const, sections: ["Insurance"], status: "pending" as const, dueDate: "2027-05-01", decidedOn: null, clock: { startedOn: "2027-04-01", pausedSince: null, pausedDays: 0, allowedDays: 60 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "quote_sent", reviews: [pws, hl], tasks: [acceptSign, insurance, verify] });
    const rows = waitingOn(c, "2027-05-03");
    expect(rows.find((r) => r.party === "applicant")?.status).toBe("up_now");
    expect(rows.find((r) => r.party === "hl")?.status).toBe("up_now");
    expect(rows.find((r) => r.party === "pws")?.status).toBe("done_for_now");
  });

  it("not_involved when a department has never been routed and holds no task", () => {
    const c = makeCase({ state: "draft" });
    const rows = waitingOn(c, "2027-05-03");
    expect(rows.find((r) => r.party === "hl")?.status).toBe("not_involved");
  });

  it("an ended case drops out of every queue", () => {
    const c = makeCase({ state: "submitted", ending: "withdrawn" });
    const rows = waitingOn(c, "2027-05-03");
    expect(rows.every((r) => r.status === "done_for_now" || r.status === "not_involved")).toBe(true);
  });
});

describe("nextMove", () => {
  it("starts with 'Next:' and names an open task", () => {
    const sentence = nextMove(makeCase({ state: "draft" }), "2027-05-03");
    expect(sentence.startsWith("Next:")).toBe(true);
  });
});

describe("isStalled", () => {
  it("flags a pre-Permitted case with nobody up", () => {
    const review = { dept: "hl" as const, sections: [], status: "approved" as const, dueDate: null, decidedOn: "2027-05-01", clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "in_review", reviews: [review] });
    expect(isStalled(c, "2027-05-03")).toBe(true);
  });

  it("is never stalled after Permitted, or once a case has ended", () => {
    expect(isStalled(makeCase({ state: "permitted" }), "2027-05-03")).toBe(false);
    expect(isStalled(makeCase({ state: "submitted", ending: "withdrawn" }), "2027-05-03")).toBe(false);
  });
});

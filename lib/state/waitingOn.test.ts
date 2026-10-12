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

describe("Needs info (S3): the applicant is up and the asker waits", () => {
  const card = makeTask({
    id: "PMT-27-0118:vendor_health_permit:1",
    catalogId: "vendor_health_permit",
    title: "Health permit: Rolling Dumpling Co.",
    reviewer: "hl",
    request: { from: "hl", message: "Please upload the current health permit", at: "2027-04-30T09:05", dueDate: "2027-05-05", resolved: false },
  });
  const parkedReview = makeTask({ id: "PMT-27-0118:review:hl", catalogId: "review:hl", owner: "hl", kind: "review", status: "locked", payload: { awaitingAnswer: true } });
  const hl = { dept: "hl" as const, sections: ["Vendor list"], status: "needs_info" as const, dueDate: "2027-05-03", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: "2027-04-30", pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
  const c = makeCase({ id: "PMT-27-0118", state: "needs_info", reviews: [hl], tasks: [card, parkedReview] });

  it("Health & Legal is Waiting, with the reason, not Up now", () => {
    const rows = waitingOn(c, "2027-05-03");
    expect(rows.find((r) => r.party === "applicant")?.status).toBe("up_now");
    const row = rows.find((r) => r.party === "hl");
    expect(row?.status).toBe("waiting");
    expect(row?.note).toBe("Waiting on the applicant's response");
    expect(row?.openTasks).toEqual([]);
  });

  it("the applicant's row is due on the request's date, not the card's own", () => {
    const withCardDate = { ...c, tasks: [{ ...card, dueDate: "2027-06-04" }, parkedReview] };
    expect(waitingOn(withCardDate, "2027-05-03").find((r) => r.party === "applicant")?.oldestDue).toBe("2027-05-05");
  });

  it("the sentence names the applicant when given a name, and who re-reviews", () => {
    expect(nextMove(c, "2027-05-03", "Downtown Arts Collective")).toBe(
      "Next: Downtown Arts Collective uploads the health permit: Rolling Dumpling Co., then Health & Legal re-reviews.",
    );
    expect(nextMove(c, "2027-05-03")).toBe("Next: The applicant uploads the health permit: Rolling Dumpling Co., then Health & Legal re-reviews.");
  });
});

describe("nextMove", () => {
  it("starts with 'Next:' and names an open task", () => {
    const sentence = nextMove(makeCase({ state: "draft" }), "2027-05-03");
    expect(sentence.startsWith("Next:")).toBe(true);
  });

  it("words command-titled tasks as what the party does (S5: two up, then the Clerk)", () => {
    const acceptSign = makeTask({ id: "PMT-27-0097:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off", title: "Accept conditions and sign" });
    const verify = makeTask({ id: "PMT-27-0097:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review", title: "Verify Certificate of insurance" });
    const issue = makeTask({ id: "PMT-27-0097:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", title: "Issue permit", status: "locked" });
    const c = makeCase({ id: "PMT-27-0097", state: "quote_sent", tasks: [acceptSign, verify, issue] });
    expect(nextMove(c, "2027-05-03", "Riverfront Running Club")).toBe(
      "Next: Riverfront Running Club accepts the conditions and signs, and Health & Legal verifies the certificate of insurance, then City Clerk issues the permit.",
    );
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

import { describe, expect, it } from "vitest";
import { PARTIES } from "@/lib/types";
import { involves } from "./selectors";
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

  it("S4 after Submit: the Clerk's intake check waits on the sign-offs still out, and says how many", () => {
    const signoff = makeTask({ id: "PMT-27-0126:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", title: "Neighbor sign-off", payload: { progress: { done: 9, total: 12 } } });
    const intake = makeTask({ id: "PMT-27-0126:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review", status: "locked", payload: { awaitingSignoffs: true } });
    const c = makeCase({ id: "PMT-27-0126", state: "submitted", tasks: [signoff, intake] });
    const clerk = waitingOn(c, "2027-05-03").find((r) => r.party === "clerk");
    expect(clerk).toMatchObject({ status: "waiting", openTasks: [], note: "Waiting on 3 neighbor sign-offs" });
    expect(isStalled(c, "2027-05-03")).toBe(false);

    const oneLeft = { ...c, tasks: [{ ...signoff, payload: { progress: { done: 11, total: 12 } } }, intake] };
    expect(waitingOn(oneLeft, "2027-05-03").find((r) => r.party === "clerk")?.note).toBe("Waiting on 1 neighbor sign-off");
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

describe("openTasks: oldest due first", () => {
  const card = (suffix: string, dueDate: string | null, extra: Partial<Parameters<typeof makeTask>[0]> = {}) =>
    makeTask({ id: `PMT-27-0001:${suffix}`, catalogId: suffix, title: suffix, dueDate, ...extra });

  it("sorts by due date, whatever order the cards were created in, with undated cards last", () => {
    const c = makeCase({ state: "in_review", tasks: [card("later", "2027-06-04"), card("undated", null), card("sooner", "2027-05-10"), card("overdue", "2027-04-29")] });
    const applicant = waitingOn(c, "2027-05-03").find((r) => r.party === "applicant")!;
    expect(applicant.openTasks.map((t) => t.catalogId)).toEqual(["overdue", "sooner", "later", "undated"]);
    expect(applicant.oldestDue).toBe("2027-04-29");
    // The row's one line, and the "Next:" sentence, name the task that is due first.
    expect(applicant.note).toBe("Up: overdue");
  });

  it("an open request's own date is the card's date for as long as it is open", () => {
    const request = { from: "hl" as const, message: "Please upload it.", at: "2027-04-30T09:05", dueDate: "2027-05-05", resolved: false };
    const c = makeCase({ state: "needs_info", tasks: [card("sooner", "2027-05-10"), card("asked_for", "2027-06-04", { request })] });
    expect(waitingOn(c, "2027-05-03").find((r) => r.party === "applicant")?.openTasks.map((t) => t.catalogId)).toEqual(["asked_for", "sooner"]);
  });

  it("cards due the same day keep the order they were created in", () => {
    const c = makeCase({ state: "quote_sent", tasks: [card("accept_and_sign", "2027-05-14"), card("pay_fees", "2027-05-14")] });
    expect(waitingOn(c, "2027-05-03").find((r) => r.party === "applicant")?.openTasks.map((t) => t.catalogId)).toEqual(["accept_and_sign", "pay_fees"]);
  });
});

describe("a department named on cards before the case is routed", () => {
  const insurance = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl", status: "submitted" });
  const sound = makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", reviewer: "pws", status: "submitted" });
  const intake = makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review" });
  const row = (c: ReturnType<typeof makeCase>, party: "pws" | "hl") => waitingOn(c, "2027-05-03").find((r) => r.party === party)!;

  it("is Waiting, not Done for now: it has not started", () => {
    const c = makeCase({ state: "submitted", tasks: [insurance, sound, intake] });
    for (const party of ["pws", "hl"] as const) {
      expect(row(c, party)).toMatchObject({ status: "waiting", note: "Starts when the City Clerk routes the case", openTasks: [], daysHolding: 0 });
    }
    expect(involves(c, "pws")).toBe(true);
  });

  it("the same while the Clerk waits on an answer at intake", () => {
    const c = makeCase({ state: "needs_info", tasks: [insurance, { ...intake, status: "locked", payload: { awaitingAnswer: true } }] });
    expect(row(c, "hl")).toMatchObject({ status: "waiting", note: "Starts when the City Clerk routes the case" });
  });

  it("the next-move sentence stops at the Clerk: nobody can say yet what the departments will do", () => {
    const c = makeCase({ state: "submitted", tasks: [insurance, sound, intake] });
    expect(nextMove(c, "2027-05-03")).toBe("Next: City Clerk checks the application is complete.");
  });

  it("is not involved at all while the case is a Draft: Drafts are the applicant's alone", () => {
    const draft = makeCase({ state: "draft", tasks: [{ ...insurance, status: "todo" }, { ...sound, status: "todo" }] });
    expect(row(draft, "hl").status).toBe("not_involved");
    expect(row(draft, "pws").status).toBe("not_involved");
    expect(involves(draft, "hl")).toBe(false);
  });

  it("is not involved once the Clerk has routed the case without it", () => {
    const hlReview = { dept: "hl" as const, sections: ["Certificate of insurance"], status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-05-03", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const hlTask = makeTask({ id: "PMT-27-0001:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", reviews: [hlReview], tasks: [insurance, sound, hlTask] });
    expect(row(c, "hl").status).toBe("up_now");
    expect(row(c, "pws")).toMatchObject({ status: "not_involved", note: "Not involved in this case" });
    expect(involves(c, "pws")).toBe(false);
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

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

describe("a waiting applicant's row says what their next card waits for", () => {
  const locked = (suffix: string, unlocksOn: "quote_sent" | "event_day" | "invoice_issued" | "closed") =>
    makeTask({ id: `PMT-27-0001:${suffix}`, catalogId: suffix, status: "locked", unlocksOn });
  const applicant = (c: ReturnType<typeof makeCase>) => waitingOn(c, "2027-05-03").find((r) => r.party === "applicant");

  // The row is read by city staff as well, so it says "the event", not "your event".
  it("a permitted picnic: Carry your permit is for the day of the event", () => {
    const paid = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", status: "done" });
    const c = makeCase({ state: "permitted", tasks: [paid, locked("carry_permit", "event_day")] });
    expect(applicant(c)).toMatchObject({ status: "waiting", note: "For the day of the event" });
  });

  it("in review: the card that unlocks first is the one named, wherever it sits in the list", () => {
    const c = makeCase({ state: "in_review", tasks: [locked("carry_permit", "event_day"), locked("accept_and_sign", "quote_sent")] });
    expect(applicant(c)?.note).toBe("Unlocks when the quote is ready");
  });

  it("in closeout: the final bill or refund", () => {
    const c = makeCase({ state: "closeout", tasks: [locked("feedback", "closed"), locked("final_bill_or_refund", "invoice_issued")] });
    expect(applicant(c)?.note).toBe("Unlocks when the City Clerk finishes reconciling costs");
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

describe("nextMove: who goes after the party that is up", () => {
  const cleanup = makeTask({ id: "PMT-27-0031:cleanup_inspection", catalogId: "cleanup_inspection", owner: "pws", kind: "inspection", title: "Cleanup inspection" });
  const reconcile = makeTask({ id: "PMT-27-0031:reconcile", catalogId: "reconcile", owner: "clerk", kind: "action", status: "locked", unlocksOn: "hours_logged" });
  const bill = makeTask({ id: "PMT-27-0031:final_bill_or_refund", catalogId: "final_bill_or_refund", kind: "payment", status: "locked", unlocksOn: "invoice_issued" });
  const feedback = makeTask({ id: "PMT-27-0031:feedback", catalogId: "feedback", kind: "form", status: "locked", unlocksOn: "closed" });

  it("S6: Public Works & Safety logs hours, then the Clerk reconciles (not the applicant, whose cards unlock later)", () => {
    // The applicant's locked cards come first in the list; the Clerk's task unlocks first.
    const c = makeCase({ id: "PMT-27-0031", state: "closeout", tasks: [bill, feedback, cleanup, reconcile] });
    expect(nextMove(c, "2027-05-03")).toBe("Next: Public Works & Safety inspects the cleanup, then City Clerk reconciles the costs and closes.");
  });

  it("once the Clerk is up, the applicant's final bill or refund is what follows: nobody knows yet which", () => {
    const c = makeCase({ id: "PMT-27-0031", state: "closeout", tasks: [bill, feedback, { ...cleanup, status: "done" }, { ...reconcile, status: "todo", unlocksOn: null }] });
    expect(nextMove(c, "2027-05-03")).toBe("Next: City Clerk reconciles the costs and closes, then The applicant gets the final bill or refund.");
    // Once the Clerk has closed with a bill owed, the card is open and it is a bill to pay.
    const billed = makeCase({ id: "PMT-27-0031", state: "closeout", tasks: [{ ...bill, status: "todo", unlocksOn: null }] });
    expect(nextMove(billed, "2027-05-03")).toBe("Next: The applicant pays the final bill.");
  });

  it("a Draft with no board yet: the applicant finishes the plan", () => {
    expect(nextMove(makeCase({ state: "draft" }), "2027-05-03", "Sunrise Yoga Club")).toBe("Next: Sunrise Yoga Club finishes the plan.");
  });

  it("three parties up at once read as a list", () => {
    const permit = makeTask({ id: "PMT-27-0070:vendor_health_permit:1", catalogId: "vendor_health_permit", title: "Health permit: Market Stall 1" });
    const pws = makeTask({ id: "PMT-27-0070:review:pws", catalogId: "review:pws", owner: "pws", kind: "review" });
    const hl = makeTask({ id: "PMT-27-0070:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const c = makeCase({ id: "PMT-27-0070", state: "in_review", tasks: [permit, pws, hl] });
    expect(nextMove(c, "2027-05-03")).toBe(
      "Next: The applicant uploads the health permit: Market Stall 1, Public Works & Safety reviews its sections, and Health & Legal reviews its sections.",
    );
  });

  it("a task parked on something specific (payment and verification) goes before one waiting on a later stage", () => {
    const verify = makeTask({ id: "PMT-27-0024:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review", title: "Verify Certificate of insurance" });
    const carry = makeTask({ id: "PMT-27-0024:carry_permit", catalogId: "carry_permit", kind: "action", status: "locked", unlocksOn: "event_day" });
    const issue = makeTask({ id: "PMT-27-0024:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "locked" });
    const c = makeCase({ id: "PMT-27-0024", state: "quote_sent", tasks: [carry, verify, issue] });
    expect(nextMove(c, "2027-05-03")).toBe("Next: Health & Legal verifies the certificate of insurance, then City Clerk issues the permit.");
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

describe("days holding: how long the case has sat with the party that is up", () => {
  const applicant = (c: ReturnType<typeof makeCase>, today = "2027-05-03") => waitingOn(c, today).find((r) => r.party === "applicant")!;

  it("a plan card nobody has touched counts from the day the application went in (S4: 20 days)", () => {
    // What requirements() writes: a card with no history at all.
    const signoff = makeTask({ id: "PMT-27-0126:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 9, total: 12 } }, history: [] });
    const c = makeCase({ id: "PMT-27-0126", state: "submitted", createdAt: "2027-04-02T09:00", submittedAt: "2027-04-13T09:00", tasks: [signoff] });
    expect(applicant(c)).toMatchObject({ status: "up_now", daysHolding: 20 });
  });

  it("a Draft counts from the day it was started, with or without a board", () => {
    const card = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", history: [] });
    expect(applicant(makeCase({ state: "draft", createdAt: "2027-05-01T10:00", tasks: [card] })).daysHolding).toBe(2);
    expect(applicant(makeCase({ state: "draft", createdAt: "2027-05-01T10:00" })).daysHolding).toBe(2);
  });

  it("a card a reviewer asked about counts from the request, not from the application (S3: 3 days)", () => {
    const pinned = makeTask({ id: "PMT-27-0118:vendor_health_permit:1", catalogId: "vendor_health_permit", history: [{ at: "2027-04-30T09:05", actor: "hl", status: "todo" }] });
    const c = makeCase({ state: "needs_info", submittedAt: "2027-04-16T09:30", tasks: [pinned] });
    expect(applicant(c).daysHolding).toBe(3);
  });

  it("a card that opened again counts from the last time it opened", () => {
    // A series' "Carry your permit": open for the Mar 1 session, locked after it, open again today.
    const carry = makeTask({
      id: "PMT-27-0034:carry_permit",
      catalogId: "carry_permit",
      kind: "action",
      history: [
        { at: "2027-03-01T09:00", actor: "system", status: "todo" },
        { at: "2027-03-02T09:00", actor: "system", status: "locked" },
        { at: "2027-05-03T09:00", actor: "system", status: "todo" },
      ],
    });
    expect(applicant(makeCase({ state: "event_day", createdAt: "2027-02-18T09:00", tasks: [carry] })).daysHolding).toBe(0);
    // A document sent back counts from the day it came back.
    const sentBack = makeTask({
      id: "PMT-27-0001:insurance_certificate",
      catalogId: "insurance_certificate",
      status: "changes_requested",
      history: [
        { at: "2027-04-10T09:00", actor: "applicant", status: "submitted" },
        { at: "2027-04-28T09:00", actor: "hl", status: "changes_requested" },
      ],
    });
    expect(applicant(makeCase({ state: "in_review", submittedAt: "2027-04-10T09:30", tasks: [sentBack] })).daysHolding).toBe(5);
  });

  it("is the longest-held of the party's open tasks, and 0 for a party that is not up", () => {
    const older = makeTask({ id: "PMT-27-0001:a", catalogId: "accept_and_sign", history: [{ at: "2027-04-20T09:00", actor: "system", status: "todo" }] });
    const newer = makeTask({ id: "PMT-27-0001:b", catalogId: "pay_fees", history: [{ at: "2027-04-30T09:00", actor: "system", status: "todo" }] });
    const rows = waitingOn(makeCase({ state: "quote_sent", tasks: [newer, older] }), "2027-05-03");
    expect(rows.find((r) => r.party === "applicant")?.daysHolding).toBe(13);
    expect(rows.find((r) => r.party === "clerk")?.daysHolding).toBe(0);
  });
});

describe("scope: what each party covers on the case", () => {
  const review = (dept: "clerk" | "pws", sections: string[]) => ({ dept, sections, status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-05-03", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" });

  it("a department reads as the sections routed to it; the Clerk always as the owner of the case", () => {
    // S6 and B06: the alcohol license is routed to the Clerk itself.
    const c = makeCase({ state: "in_review", reviews: [review("pws", ["Sound details", "Site plan"]), review("clerk", ["Alcohol details and liquor liability insurance"])] });
    const scope = Object.fromEntries(waitingOn(c, "2027-05-03").map((r) => [r.party, r.scope]));
    expect(scope.pws).toBe("Sound details, Site plan");
    expect(scope.clerk).toBe("Intake, routing, quote, permit and closeout");
  });
});

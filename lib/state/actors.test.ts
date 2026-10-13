/**
 * Who may raise which action. transition() used to trust the caller: any role could issue a
 * permit or verify another department's document. Every refusal here carries a reason a screen
 * can show as it is.
 */
import { describe, expect, it } from "vitest";
import type { Actor, EventCase } from "@/lib/types";
import { ACTION_TYPES, type Action } from "./actions";
import { actorsFor } from "./checks";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { transition } from "./transition";

const ID = "PMT-27-0001";
const ALL_ACTORS: Actor[] = ["applicant", "clerk", "pws", "hl", "neighbor", "system"];

function reasonFor(c: EventCase, action: Action, actor: Actor): string | null {
  const result = transition(c, action, actor, makeCtx());
  return result.ok ? null : result.reason;
}

/** One well-formed action of every type, for the table test below. */
const SAMPLE: { [T in Action["type"]]: Extract<Action, { type: T }> } = {
  create_board: { type: "create_board" },
  book_and_pay: { type: "book_and_pay", method: "card" },
  complete_task: { type: "complete_task", taskId: `${ID}:x` },
  simulate_signoff: { type: "simulate_signoff" },
  submit: { type: "submit" },
  respond_to_request: { type: "respond_to_request", taskId: `${ID}:x` },
  accept_and_sign: { type: "accept_and_sign", signature: "A. Person" },
  pay: { type: "pay", amount: 10, method: "card", kind: "quote" },
  withdraw: { type: "withdraw" },
  cancel: { type: "cancel" },
  submit_feedback: { type: "submit_feedback", rating: 5 },
  book_again: { type: "book_again" },
  amend: { type: "amend", answers: makeCase() },
  accept_complete: { type: "accept_complete" },
  confirm_routing: { type: "confirm_routing", reviewers: [{ dept: "hl", sections: [], dueDate: "2027-05-17" }] },
  send_to_commission: { type: "send_to_commission" },
  send_quote: { type: "send_quote", conditions: [], feeLines: [] },
  deny: { type: "deny", reason: "No." },
  issue_permit: { type: "issue_permit" },
  reconcile_close: { type: "reconcile_close" },
  decide_amendment: { type: "decide_amendment", decision: "approve" },
  request_info: { type: "request_info", message: "Please send it." },
  verify_document: { type: "verify_document", taskId: `${ID}:x` },
  reject_document: { type: "reject_document", taskId: `${ID}:x`, reason: "Expired." },
  review_decide: { type: "review_decide", decision: "approve", conditions: [], feeLines: [] },
  schedule_meeting: { type: "schedule_meeting", taskId: `${ID}:x`, date: "2027-05-10" },
  complete_city_task: { type: "complete_city_task", taskId: `${ID}:x` },
  log_closeout: { type: "log_closeout", cleanup: "pass", actuals: [], extraLines: [] },
  add_note: { type: "add_note", text: "A note." },
  remind: { type: "remind", party: "applicant" },
  tick: { type: "tick" },
};

describe("who may raise each action (plan 5.4)", () => {
  it("lists the parties for every action type", () => {
    expect(actorsFor("issue_permit")).toEqual(["clerk"]);
    expect(actorsFor("pay")).toEqual(["applicant", "clerk"]);
    expect(actorsFor("log_closeout")).toEqual(["pws"]);
    expect(actorsFor("review_decide")).toEqual(["clerk", "pws", "hl"]);
    expect(actorsFor("schedule_meeting")).toEqual(["clerk", "pws"]);
    expect(actorsFor("tick")).toEqual(["system"]);
    // The block captain presses "Simulate a sign-off" for a neighbor.
    expect(actorsFor("simulate_signoff")).toEqual(["neighbor", "applicant"]);
    for (const type of ACTION_TYPES) expect(actorsFor(type).length, type).toBeGreaterThan(0);
  });

  it("refuses every action from every party that is not on its list, before anything else is checked", () => {
    const c = makeCase({ id: ID, state: "in_review" });
    for (const type of ACTION_TYPES) {
      for (const actor of ALL_ACTORS) {
        if (actorsFor(type).includes(actor)) continue;
        const reason = reasonFor(c, SAMPLE[type], actor);
        expect(reason, `${type} by ${actor}`).toMatch(/^Only .+ can .+\.$/);
      }
    }
  });

  it("words the refusal for the person reading it", () => {
    const quoted = makeCase({ id: ID, state: "quote_sent" });
    expect(reasonFor(quoted, { type: "issue_permit" }, "applicant")).toBe("Only the City Clerk can issue the permit.");
    expect(reasonFor(quoted, { type: "issue_permit" }, "hl")).toBe("Only the City Clerk can issue the permit.");
    expect(reasonFor(quoted, { type: "accept_and_sign", signature: "City Clerk" }, "clerk")).toBe("Only the applicant can accept the conditions and sign.");
    expect(reasonFor(quoted, { type: "pay", amount: 10, method: "card", kind: "quote" }, "pws")).toBe("Only the applicant or the City Clerk can record a payment.");
    expect(reasonFor(makeCase({ state: "closeout" }), { type: "log_closeout", cleanup: "pass", actuals: [], extraLines: [] }, "clerk")).toBe(
      "Only Public Works & Safety can log the closeout.",
    );
    expect(reasonFor(makeCase({ state: "in_review" }), { type: "add_note", text: "Hello" }, "applicant")).toBe("Only city staff can add a note.");
    expect(reasonFor(makeCase({ state: "permitted" }), { type: "tick" }, "clerk")).toBe("Only the system can advance the clock.");
    // An amendment is the applicant's to propose and the Clerk's to decide: two actions, one party each.
    expect(reasonFor(makeCase({ state: "permitted" }), { type: "amend", answers: makeCase() }, "clerk")).toBe("Only the applicant can amend the application.");
    expect(reasonFor(makeCase({ state: "permitted" }), { type: "decide_amendment", decision: "approve" }, "applicant")).toBe("Only the City Clerk can decide an amendment.");
    expect(reasonFor(makeCase({ state: "permitted" }), { type: "decide_amendment", decision: "decline", reason: "No." }, "pws")).toBe("Only the City Clerk can decide an amendment.");
  });

  it("an ended case still answers with its ending first", () => {
    const ended = makeCase({ state: "submitted", ending: "withdrawn" });
    expect(reasonFor(ended, { type: "issue_permit" }, "applicant")).toBe("This case is withdrawn.");
  });
});

describe("verify_document and reject_document: the card's own reviewer", () => {
  const insurance = makeTask({ id: `${ID}:insurance_certificate`, catalogId: "insurance_certificate", title: "Certificate of insurance", reviewer: "hl", status: "submitted" });
  const c = makeCase({ id: ID, state: "in_review", tasks: [insurance] });

  it("a department that does not check the card cannot verify it or send it back", () => {
    const reason = "Health & Legal checks this card.";
    expect(reasonFor(c, { type: "verify_document", taskId: insurance.id }, "pws")).toBe(reason);
    expect(reasonFor(c, { type: "verify_document", taskId: insurance.id }, "clerk")).toBe(reason);
    expect(reasonFor(c, { type: "reject_document", taskId: insurance.id, reason: "Wrong year" }, "pws")).toBe(reason);
  });

  it("its reviewer can", () => {
    expect(reasonFor(c, { type: "verify_document", taskId: insurance.id }, "hl")).toBeNull();
    expect(reasonFor(c, { type: "reject_document", taskId: insurance.id, reason: "Wrong year" }, "hl")).toBeNull();
  });

  it("the department that asked for an answer can accept it, whoever the card's reviewer is", () => {
    // The Clerk asked about the insurance certificate at intake; Health & Legal reviews it later.
    const answered = { ...insurance, request: { from: "clerk" as const, message: "The named insured is missing.", at: "2027-04-22T09:00", dueDate: "2027-04-27", resolved: true } };
    const asked = makeCase({ id: ID, state: "submitted", tasks: [answered] });
    expect(reasonFor(asked, { type: "verify_document", taskId: answered.id }, "clerk")).toBeNull();
    expect(reasonFor(asked, { type: "verify_document", taskId: answered.id }, "pws")).toBe("Health & Legal checks this card.");
  });
});

describe("complete_city_task: work orders, meetings held and re-reviews only", () => {
  const workOrder = makeTask({ id: `${ID}:work_order:barricades`, catalogId: "work_order:barricades", owner: "pws", kind: "action", title: "Deliver barricades" });
  const walkthrough = makeTask({ id: `${ID}:site_walkthrough`, catalogId: "site_walkthrough", kind: "meeting", title: "Site walkthrough", reviewer: "pws" });
  const coordination = makeTask({ id: `${ID}:coordination_meeting`, catalogId: "coordination_meeting", kind: "meeting", title: "Coordination meeting", reviewer: "clerk" });
  const insurance = makeTask({ id: `${ID}:insurance_certificate`, catalogId: "insurance_certificate", title: "Certificate of insurance", reviewer: "hl", status: "todo" });
  const c = makeCase({ id: ID, state: "permitted", tasks: [workOrder, walkthrough, coordination, insurance] });

  it("refuses an applicant card that is not a meeting", () => {
    expect(reasonFor(c, { type: "complete_city_task", taskId: insurance.id }, "hl")).toBe("That card is the applicant's to finish.");
  });

  it("a city task is finished by the department that owns it", () => {
    expect(reasonFor(c, { type: "complete_city_task", taskId: workOrder.id }, "hl")).toBe("That task belongs to Public Works & Safety.");
    expect(reasonFor(c, { type: "complete_city_task", taskId: workOrder.id }, "pws")).toBeNull();
  });

  it("a meeting is closed by the department that holds it, or by the Clerk", () => {
    expect(reasonFor(c, { type: "complete_city_task", taskId: walkthrough.id }, "hl")).toBe("Only Public Works & Safety or the City Clerk can close this meeting.");
    expect(reasonFor(c, { type: "complete_city_task", taskId: walkthrough.id }, "pws")).toBeNull();
    expect(reasonFor(c, { type: "complete_city_task", taskId: walkthrough.id }, "clerk")).toBeNull();
    expect(reasonFor(c, { type: "complete_city_task", taskId: coordination.id }, "pws")).toBe("Only the City Clerk can close this meeting.");
  });

  it("a task with an action of its own is finished by that action, so its effect is never skipped", () => {
    const tasks = [
      makeTask({ id: `${ID}:intake_check`, catalogId: "intake_check", owner: "clerk", kind: "review" }),
      makeTask({ id: `${ID}:confirm_routing`, catalogId: "confirm_routing", owner: "clerk", kind: "action" }),
      makeTask({ id: `${ID}:consolidate`, catalogId: "consolidate", owner: "clerk", kind: "action" }),
      makeTask({ id: `${ID}:issue_permit`, catalogId: "issue_permit", owner: "clerk", kind: "action" }),
      makeTask({ id: `${ID}:reconcile`, catalogId: "reconcile", owner: "clerk", kind: "action" }),
      makeTask({ id: `${ID}:review:pws`, catalogId: "review:pws", owner: "pws", kind: "review" }),
      makeTask({ id: `${ID}:log_actual_hours`, catalogId: "log_actual_hours", owner: "pws", kind: "action" }),
    ];
    const held = makeCase({ id: ID, state: "quote_sent", tasks });
    expect(reasonFor(held, { type: "complete_city_task", taskId: `${ID}:issue_permit` }, "clerk")).toBe("Issue the permit to finish this task.");
    expect(reasonFor(held, { type: "complete_city_task", taskId: `${ID}:intake_check` }, "clerk")).toBe("Accept the application as complete to finish this task.");
    expect(reasonFor(held, { type: "complete_city_task", taskId: `${ID}:review:pws` }, "pws")).toBe("Decide the review to finish this task.");
    for (const t of tasks) expect(reasonFor(held, { type: "complete_city_task", taskId: t.id }, t.owner), t.catalogId).toMatch(/ to finish this task\.$/);
  });

  it("closing a re-review with no change accepts the card it was checking", () => {
    const card = makeTask({ id: `${ID}:vendor_health_permit:1`, catalogId: "vendor_health_permit", title: "Health permit: Rolling Dumpling Co.", reviewer: "hl", status: "submitted" });
    const verify = makeTask({ id: `${ID}:verify:vendor_health_permit:1`, catalogId: "verify:vendor_health_permit:1", owner: "hl", kind: "review", title: "Verify Health permit: Rolling Dumpling Co." });
    const reviewing = makeCase({ id: ID, state: "permitted", tasks: [card, verify] });
    const result = transition(reviewing, { type: "complete_city_task", taskId: verify.id }, "hl", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A card "With the city" always has someone tasked: the check and the card finish together.
    expect(result.case.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["vendor_health_permit", "done"],
      ["verify:vendor_health_permit:1", "done"],
    ]);
  });
});

describe("schedule_meeting: the department that holds the meeting, or the Clerk", () => {
  const preApp = makeTask({ id: `${ID}:pre_application_meeting`, catalogId: "pre_application_meeting", kind: "meeting", title: "Pre-application meeting", reviewer: "clerk" });
  const scheduler = makeTask({ id: `${ID}:schedule_pre_application_meeting`, catalogId: "schedule_pre_application_meeting", owner: "clerk", kind: "meeting", title: "Schedule the pre-application meeting" });
  const walkthrough = makeTask({ id: `${ID}:site_walkthrough`, catalogId: "site_walkthrough", kind: "meeting", title: "Site walkthrough", reviewer: "pws", status: "locked" });
  const c = makeCase({ id: ID, state: "in_review", tasks: [preApp, scheduler, walkthrough] });

  it("Public Works & Safety schedules its walkthrough, not the Clerk's meeting", () => {
    expect(reasonFor(c, { type: "schedule_meeting", taskId: walkthrough.id, date: "2027-07-02" }, "pws")).toBeNull();
    expect(reasonFor(c, { type: "schedule_meeting", taskId: preApp.id, date: "2027-05-10" }, "pws")).toBe("Only the City Clerk can schedule this meeting.");
    expect(reasonFor(c, { type: "schedule_meeting", taskId: walkthrough.id, date: "2027-07-02" }, "clerk")).toBeNull();
  });

  it("the Clerk's own 'Schedule the pre-application meeting' task schedules the applicant's meeting card", () => {
    // My queue opens the Clerk's task; the date belongs on the card the applicant sees.
    const result = transition(c, { type: "schedule_meeting", taskId: scheduler.id, date: "2027-05-10" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.find((t) => t.id === preApp.id)?.payload.scheduledFor).toBe("2027-05-10");
    expect(result.case.tasks.find((t) => t.id === scheduler.id)).toMatchObject({ status: "done" });
    expect(result.case.tasks.find((t) => t.id === scheduler.id)?.payload.scheduledFor).toBeUndefined();
  });
});

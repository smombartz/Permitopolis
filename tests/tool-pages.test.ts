/**
 * The Phase 5 and 6 tool pages, held to the case.
 *
 * Each role's own page (Payments; Closures and routes, Work orders; Verifications, Inspections)
 * and the meetings on Active permits is a second reading of something the case already shows:
 * a queue row, a Who's up task, a tab of the case detail. Each was built by a different
 * builder, off its own view-model. Nothing but this file makes a page agree with the case it
 * lists, on the seed and after the demo paths that move those cases (5, 6 and 7), and a work
 * order on one screen that another has never heard of is the kind of gap a demo finds.
 * `tests/both-sides.test.ts` does the same for the applicant's "With the city" notes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { applicantNameOf } from "@/lib/data/people";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import {
  availableActions,
  amendmentPaymentDue,
  caseTotals,
  checkCompleteCityTask,
  closeoutSettlement,
  isOpen,
  permitSessions,
  queueFor,
  quoteBalance,
  resetDemoStoreForTests,
  sessionDates,
  taskDueDate,
  useDemo,
  waitingOn,
  type Action,
} from "@/lib/state";
import type { Dept, Party } from "@/lib/types";
import { meetingItems } from "@/lib/view/active";
import { amendmentReview } from "@/lib/view/amend";
import { caseBackLink, documentCards, openKeyForTask, parseOpenKey, resolveOpenKey } from "@/lib/view/caseDetail";
import { closuresInRange } from "@/lib/view/closures";
import { buildInspectionGroups } from "@/lib/view/inspections";
import { dueRows, dueTotal, paymentsSummary, receivedRows, refundsIssuedRows, refundsOwedRows } from "@/lib/view/payments";
import { paymentRows } from "@/lib/view/clerkTools";
import { cityPageIsFor, cityToolLinks } from "@/lib/view/shell";
import { buildVerificationQueue } from "@/lib/view/verifications";
import { canActOn } from "@/lib/view/verify";
import { meetingRows, workOrderRows } from "@/lib/view/workOrders";

const TODAY = DEFAULT_DEMO_TODAY;
const S1 = "PMT-27-0109";
const S5 = "PMT-27-0097";
const S6 = "PMT-27-0031";
const ALL_YEAR = { from: "2027-01-01", to: "2028-12-31" };

const store = () => useDemo.getState();
const cases = () => store().cases;
const today = () => store().demoToday;
const get = (id: string) => cases().find((c) => c.id === id)!;

function as(role: Party, personaId?: string) {
  store().setRole(role);
  if (personaId) store().setPersona(personaId);
}
function act(id: string, action: Action) {
  const result = store().dispatch(id, action);
  if (!result.ok) throw new Error(`${action.type} as ${store().role} was refused: ${result.reason}`);
}

/** Demo path 5, as tests/demo-paths.test.ts dispatches it: the 5K ends up Permitted with its work orders. */
function runPath5() {
  as("hl");
  act(S5, { type: "verify_document", taskId: `${S5}:insurance_certificate` });
  as("applicant", "riverfront-running-club");
  act(S5, { type: "accept_and_sign", signature: "Simone Dubois" });
  act(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" });
  as("clerk");
  act(S5, { type: "issue_permit" });
}

/** Demo path 6: the Food Truck Festival's closeout logged, then (optionally) reconciled. */
function runPath6(reconcile: boolean) {
  as("pws");
  const police = get(S6).feeLines.find((line) => line.label === "Police")!;
  act(S6, { type: "log_closeout", cleanup: "pass", notes: "Swept.", actuals: [{ feeLineId: police.id, qty: 72 }], extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: store().cfg.fees.cleanupCrewPerWorkerHour }] });
  if (!reconcile) return;
  as("clerk");
  act(S6, { type: "reconcile_close" });
}

/** Demo path 7 up to the Clerk's approval: Maya's amended picnic owes its difference. */
function runPath7ToApproval() {
  as("applicant", "maya-chen");
  const s1 = get(S1);
  act(S1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true });
  act(S1, { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth" } });
  act(S1, { type: "complete_task", taskId: `${S1}:insurance_certificate`, files: [{ name: "coi.pdf", size: 1000, type: "application/pdf" }] });
  act(S1, { type: "submit" });
  as("pws");
  act(S1, { type: "verify_document", taskId: `${S1}:sound_details` });
  as("hl");
  act(S1, { type: "verify_document", taskId: `${S1}:insurance_certificate` });
  as("clerk");
  act(S1, { type: "decide_amendment", decision: "approve" });
}

/** The scenes every agreement below is checked in: the seed, and the demo paths that move these pages' cases. */
const SCENES: [name: string, setUp: () => void][] = [
  ["on the seed", () => {}],
  ["after demo path 5 (the 5K permitted)", runPath5],
  ["after demo path 6 (the festival's closeout logged)", () => runPath6(false)],
  ["after demo path 6 (reconciled and closed)", () => runPath6(true)],
  ["after demo path 7 (Maya's amendment approved)", runPath7ToApproval],
];

beforeEach(() => {
  resetDemoStoreForTests();
});

describe.each(SCENES)("Work orders (Public Works & Safety), %s", (_name, setUp) => {
  beforeEach(setUp);

  it("lists exactly the work-order tasks of the open cases, and its open rows are the work orders in Public Works & Safety's queue", () => {
    const rows = workOrderRows(cases(), today());
    const onCases = cases().filter(isOpen).flatMap((c) => c.tasks.filter((t) => t.catalogId.startsWith("work_order:")));
    expect(rows.map((r) => r.task.id).sort()).toEqual(onCases.map((t) => t.id).sort());

    const queued = queueFor(cases(), "pws", today()).filter((item) => item.task.catalogId.startsWith("work_order:"));
    expect(rows.filter((r) => r.status !== "done").map((r) => r.task.id).sort()).toEqual(queued.map((item) => item.task.id).sort());
    if (_name.includes("path 5")) expect(rows.filter((r) => r.case.id === S5).map((r) => [r.what, r.status])).toEqual([["Deliver barricades", "scheduled"], ["Staff police officers", "scheduled"], ["Close the street", "scheduled"]]);
  });

  it("each row says what the case says: the task's own due date, the place, done or not; and \"Mark done\" opens a panel the engine will take", () => {
    for (const row of workOrderRows(cases(), today())) {
      expect(row.due, row.task.id).toBe(row.task.dueDate);
      expect(row.where, row.task.id).toBe(row.case.location?.label ?? "Not provided");
      expect(row.status === "done", row.task.id).toBe(row.task.status === "done");
      expect(row.overdue, row.task.id).toBe(row.task.status !== "done" && row.task.dueDate !== null && row.task.dueDate < today());
      if (row.status === "done") continue;
      // The row links to the case with `?task=<the task's id>`: for Public Works & Safety that is the Mark done panel.
      expect(resolveOpenKey(row.case, row.task.id, "pws"), row.task.id).toBe(`complete_city_task:${row.task.id}`);
      expect(checkCompleteCityTask(row.case, row.task.id, "pws", today()), row.task.id).toEqual({ ok: true });
    }
  });
});

describe.each(SCENES)("Meetings: Active permits' calendar, the Work orders page's tab and the case, %s", (_name, setUp) => {
  beforeEach(setUp);

  it("every scheduled meeting on an open case is on the calendar, on its own day, and nothing else is", () => {
    const items = meetingItems(cases());
    const scheduled = cases().filter(isOpen).flatMap((c) => c.tasks.filter((t) => t.kind === "meeting" && t.payload.scheduledFor).map((t) => ({ c, t })));
    expect(items.map((m) => m.id).sort()).toEqual(scheduled.map(({ t }) => t.id).sort());
    for (const item of items) {
      const c = get(item.caseId);
      const card = c.tasks.find((t) => t.id === item.id)!;
      // One day for a meeting everywhere: the calendar, the card's due date on the applicant's board, the case's Reviews tab.
      expect(item.date, item.id).toBe(card.payload.scheduledFor);
      expect(card.dueDate, item.id).toBe(item.date);
      expect(item.held, item.id).toBe(card.status === "done");
      expect(item.eventName, item.id).toBe(c.name);
      // A meeting comes before the event it is for.
      expect(item.date < sessionDates(c).reduce((a, b) => (a < b ? a : b)), item.id).toBe(true);
    }
  });

  it("Public Works & Safety's meetings tab lists the same walkthroughs and coordination meetings, with the same days", () => {
    const rows = meetingRows(cases(), today());
    const onCalendar = new Map(meetingItems(cases()).map((m) => [m.id, m]));
    for (const row of rows) {
      const item = onCalendar.get(row.task.id);
      expect(row.scheduledFor, row.task.id).toBe(item?.date ?? null);
      expect(row.held, row.task.id).toBe(row.task.status === "done");
      // Schedule and Mark held open the panels the Reviews tab's Meetings block opens.
      if (row.held) continue;
      expect(parseOpenKey(resolveOpenKey(row.case, `schedule_meeting:${row.task.id}`, "pws")!)).toEqual({ action: "schedule_meeting", arg: row.task.id });
    }
    const walkthroughsAndCoordination = [...onCalendar.values()].filter((m) => /:(coordination_meeting|site_walkthrough)$/.test(m.id));
    expect(rows.filter((r) => r.scheduledFor).map((r) => r.task.id).sort()).toEqual(walkthroughsAndCoordination.map((m) => m.id).sort());
  });
});

describe.each(SCENES)("Closures and routes (Public Works & Safety), %s", (_name, setUp) => {
  beforeEach(setUp);

  it("shows as Permitted exactly the cases Active permits holds sessions for, on the same days", () => {
    const permitted = closuresInRange(cases(), ALL_YEAR, { status: "permitted" });
    const sessions = permitSessions(cases(), ALL_YEAR);
    expect(permitted.map((item) => item.case.id).sort()).toEqual([...new Set(sessions.map((s) => s.case.id))].sort());
    for (const item of permitted) {
      expect(item.dates, item.case.id).toEqual(sessions.filter((s) => s.case.id === item.case.id).map((s) => s.date));
    }
  });

  it("shows every quote holding its date as Date held, and never an ended case or a Draft", () => {
    const all = closuresInRange(cases(), ALL_YEAR);
    const withHolds = permitSessions(cases(), { ...ALL_YEAR, includeHolds: true });
    const quoteHolds = [...new Set(withHolds.map((s) => s.case.id))].filter((id) => get(id).state === "quote_sent");
    for (const id of quoteHolds) expect(all.find((item) => item.case.id === id)?.status, id).toBe("held");
    for (const item of all) {
      expect(item.case.ending, item.case.id).toBeNull();
      expect(item.case.state, item.case.id).not.toBe("draft");
    }
    if (_name.includes("path 5")) expect(all.find((item) => item.case.id === S5)).toMatchObject({ status: "permitted", dates: ["2027-07-11"] });
    else if (_name === "on the seed") expect(all.find((item) => item.case.id === S5)).toMatchObject({ status: "held", dates: ["2027-07-11"] });
  });
});

describe.each(SCENES)("Verifications (Health & Legal), %s", (_name, setUp) => {
  beforeEach(setUp);

  it.each(["hl", "pws", "clerk"] as const)("%s's queue of documents is every card the Documents tab lets it verify, and each has a city task behind it", (role: Dept) => {
    const rows = buildVerificationQueue(cases(), role, today());
    const onCases = cases().filter((c) => isOpen(c) && c.state !== "draft").flatMap((c) => documentCards(c).filter((t) => canActOn(t, role)).map((t) => ({ c, t })));
    // The page lists every card the role can act on; the Documents tab lists the documents and forms among them.
    for (const { t } of onCases) expect(rows.map((r) => r.taskId), t.id).toContain(t.id);
    for (const row of rows) {
      const c = get(row.caseId);
      const card = c.tasks.find((t) => t.id === row.taskId)!;
      expect(canActOn(card, role), row.taskId).toBe(true);
      expect(row.dueDate, row.taskId).toBe(taskDueDate(card));
      // The row opens `?task=verify_document:<card>`: the panel the case itself opens for it.
      expect(parseOpenKey(resolveOpenKey(c, `verify_document:${card.id}`, role)!)).toEqual({ action: "verify_document", arg: card.id });
      // Somebody on the city side is tasked with it: the role is up on that case, or its own review is parked on a request.
      const mine = waitingOn(c, today()).find((p) => p.party === role)!;
      expect(["up_now", "waiting"], `${row.taskId}: ${mine.status}`).toContain(mine.status);
    }
  });
});

describe.each(SCENES)("Inspections (Health & Legal), %s", (_name, setUp) => {
  beforeEach(setUp);

  it("a booth for every food vendor of every event in the next two weeks, named as the vendor's health permit names it", () => {
    for (const group of buildInspectionGroups(cases(), today())) {
      const c = get(group.caseId);
      const vendors = c.tasks.filter((t) => t.catalogId === "vendor_health_permit");
      expect(group.booths.map((b) => b.vendorName), group.caseId).toEqual(vendors.map((t) => t.payload.vendorName));
      expect(group.booths).toHaveLength(c.addOns.foodVending?.vendors ?? 0);
      expect(sessionDates(c), group.caseId).toContain(group.eventDate);
      expect(c.ending, group.caseId).toBeNull();
      expect(c.state, group.caseId).not.toBe("draft");
      expect(group.applicantName, group.caseId).toBe(applicantNameOf(c));
    }
  });
});

describe.each(SCENES)("Payments (City Clerk), %s", (_name, setUp) => {
  beforeEach(setUp);

  it("Due is what the engine says each case owes now, and Record payment opens a panel that will take it", () => {
    const rows = dueRows(cases(), today(), store().cfg);
    for (const row of rows) {
      const c = get(row.caseId);
      const ctx = { today: today(), cases: cases(), cfg: store().cfg };
      if (row.kind === "quote") expect(row.amount, row.key).toBe(quoteBalance(c, store().cfg));
      if (row.kind === "amendment") expect(row.amount, row.key).toBe(amendmentPaymentDue(c, store().cfg));
      if (row.kind === "final_invoice") expect(row.amount, row.key).toBe(caseTotals(c).due);
      // "Record payment" is `?task=pay`: the Clerk's own row for it is there, and enabled.
      expect(resolveOpenKey(c, "pay", "clerk"), row.key).toBe("pay");
      expect(availableActions(c, "clerk", ctx).find((a) => a.type === "pay"), row.key).toMatchObject({ enabled: true });
    }
    // And nothing owed is left off: every quote with a balance, every amendment with one.
    for (const c of cases().filter((x) => x.ending === null)) {
      if (c.state === "quote_sent" && quoteBalance(c, store().cfg) > 0) expect(rows.some((r) => r.caseId === c.id && r.kind === "quote"), c.id).toBe(true);
      if (amendmentPaymentDue(c, store().cfg) > 0) expect(rows.some((r) => r.caseId === c.id && r.kind === "amendment"), c.id).toBe(true);
    }
    expect(paymentsSummary(cases(), today(), store().cfg).outstanding).toBe(dueTotal(rows));
    if (_name.includes("path 7")) expect(rows.find((r) => r.caseId === S1)).toMatchObject({ kind: "amendment", label: "Amendment balance", amount: 393.75, dueDate: "2027-05-17" });
    if (_name.includes("path 5")) expect(rows.find((r) => r.caseId === S5)).toBeUndefined();
  });

  it("Received and Refunds issued are the cases' own payments, each once, under the name the case gives it", () => {
    const received = receivedRows(cases());
    const issued = refundsIssuedRows(cases());
    const all = cases().flatMap((c) => c.payments.map((p) => ({ c, p })));
    expect(received.map((r) => r.key).sort()).toEqual(all.filter(({ p }) => p.kind !== "refund").map(({ p }) => p.id).sort());
    expect(issued.map((r) => r.key).sort()).toEqual(all.filter(({ p }) => p.kind === "refund").map(({ p }) => p.id).sort());
    for (const row of received) {
      // The Conditions and fees tab of the case lists the same payment under the same label.
      const onCase = paymentRows(get(row.caseId)).find((p) => p.id === row.key)!;
      expect(row.label, row.key).toBe(onCase.label);
      expect(row.amount, row.key).toBe(onCase.amount);
    }
    for (const row of issued) expect(row.amount, row.key).toBeGreaterThan(0);
  });

  it("a refund is Owed exactly while a closeout is logged and not reconciled, for the amount reconciling will pay", () => {
    const owed = refundsOwedRows(cases());
    const waiting = cases().filter((c) => c.ending === null && c.state === "closeout" && c.closeout.hoursLoggedOn && (closeoutSettlement(c).refund ?? 0) > 0);
    expect(owed.map((r) => r.caseId).sort()).toEqual(waiting.map((c) => c.id).sort());
    for (const row of owed) expect(row.amount, row.caseId).toBe(closeoutSettlement(get(row.caseId)).refund);
    // The seed already has two closeouts logged and waiting on the Clerk; the festival joins them, then leaves.
    const festival = owed.find((r) => r.caseId === S6);
    if (_name === "on the seed") expect(owed.map((r) => [r.caseId, r.amount])).toEqual([["PMT-27-0036", 250], ["PMT-27-0038", 880]]);
    if (_name.includes("closeout logged")) expect(festival).toMatchObject({ amount: 250, rule: "Deposit refund pending reconciliation" });
    if (_name.includes("reconciled")) {
      expect(festival).toBeUndefined();
      expect(refundsIssuedRows(cases()).find((r) => r.caseId === S6)).toMatchObject({ amount: 250, rule: "Deposit refund after closeout" });
    }
  });
});

describe("an amendment, read from the city side", () => {
  it("the case's banner and the Clerk's panel say what the engine holds, stage by stage (demo path 7)", () => {
    const review = () => amendmentReview(get(S1), store().cfg);
    expect(review()).toBeNull();

    as("applicant", "maya-chen");
    const s1 = get(S1);
    act(S1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true });
    expect(review()).toMatchObject({
      stage: "proposed",
      proposedOn: TODAY,
      tierBefore: "instant",
      tierAfter: "reviewed",
      changes: ["Amplified sound: added"],
      totalBefore: 125,
      totalAfter: 518.75,
      paid: 125,
      balance: 393.75,
      lateFee: 53.75,
      approveBlockedBy: null,
      status: "Waiting on the applicant to finish its cards and submit it.",
    });
    expect(review()!.cards.map((card) => [card.title, card.statusText])).toEqual([
      ["Certificate of insurance", "With the applicant"],
      ["Sound details", "With the applicant"],
      ["Submit application", "Not open yet"],
      ["Accept conditions and sign", "Not open yet"],
    ]);

    act(S1, { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth" } });
    act(S1, { type: "complete_task", taskId: `${S1}:insurance_certificate`, files: [{ name: "coi.pdf", size: 1000, type: "application/pdf" }] });
    act(S1, { type: "submit" });
    expect(review()).toMatchObject({
      stage: "submitted",
      approveBlockedBy: 'Health & Legal is still checking "Certificate of insurance", and 1 more card.',
      status: "Health & Legal and Public Works & Safety are checking its cards, then the City Clerk decides.",
    });
    expect(review()!.cards.map((card) => card.statusText)).toEqual(["Being checked by Health & Legal", "Being checked by Public Works & Safety", "Submitted", "Not open yet"]);
    // The Clerk's task is in Who's up as waiting, and opens the decision panel from there.
    const decide = get(S1).tasks.find((t) => t.catalogId === "decide_amendment")!;
    expect(openKeyForTask(get(S1), decide, "clerk")).toBe("decide_amendment");
    expect(openKeyForTask(get(S1), decide, "pws")).toBe("remind:clerk");

    as("pws");
    act(S1, { type: "verify_document", taskId: `${S1}:sound_details` });
    expect(review()).toMatchObject({ approveBlockedBy: 'Health & Legal is still checking "Certificate of insurance".', status: "Health & Legal is checking its cards, then the City Clerk decides." });
    as("hl");
    act(S1, { type: "verify_document", taskId: `${S1}:insurance_certificate` });
    expect(review()).toMatchObject({ stage: "submitted", approveBlockedBy: null, status: "Its cards are checked: the City Clerk decides." });

    as("clerk");
    act(S1, { type: "decide_amendment", decision: "approve" });
    expect(review()).toMatchObject({ stage: "approved", balance: 393.75, status: "Approved. Waiting on the applicant to sign and pay $393.75." });

    as("applicant", "maya-chen");
    act(S1, { type: "accept_and_sign", signature: "Maya Chen" });
    act(S1, { type: "pay", amount: 393.75, method: "card", kind: "quote" });
    expect(review()).toBeNull();
    // The payment reads as what it was, on the case and on the Clerk's Payments page alike.
    expect(paymentRows(get(S1))[0]).toMatchObject({ label: "Amendment payment", amount: 393.75 });
    expect(receivedRows(cases()).find((r) => r.caseId === S1 && r.amount === 393.75)).toMatchObject({ label: "Amendment payment" });
  });
});

describe("every tool page a case can be opened from is a page the case goes back to", () => {
  it.each(["clerk", "pws", "hl"] as const)("%s: each of its tool pages that lists cases has its own back label, and no other role is sent to it", (role: Dept) => {
    const others = (["clerk", "pws", "hl"] as const).filter((r) => r !== role);
    for (const link of cityToolLinks(role)) {
      if (link.label === "Settings") continue; // Settings names open Drafts; it opens no case.
      const withQuery = `${link.href}?tab=x&from=2027-07-11`;
      expect(caseBackLink(withQuery, role), link.label).toEqual({ href: withQuery, label: `Back to ${link.label}` });
      expect(cityPageIsFor(role, link.href)).toBe(true);
      for (const other of others) expect(caseBackLink(withQuery, other), `${link.label} as ${other}`).toEqual({ href: "/city/cases", label: "Back to cases" });
    }
  });
});

/**
 * The PRD's demo script, as acceptance tests at the store level.
 *
 * Each path starts from a fresh seed and goes through the store the way the screens will:
 * setRole, setPersona, createDraft, updateDraft, dispatch (as the current role) and
 * setDemoToday. After every step the test asserts the case and what the other roles now see
 * (queues, who is up, active permits, availability). After every path, reset() must restore
 * the seed exactly. Paths 1 to 6 are P0; path 7 is P1.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAIN_1ST_TO_4TH } from "@/lib/data/streets";
import { datesEvery, weekdayOf } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, availability, capacityWarning, classify, dateGate, dueDate, estimateFees, routing, whatIf, type RulesCtx } from "@/lib/rules";
import {
  activePermits,
  applicantCases,
  availableActions,
  boardColumns,
  buildSeed,
  caseTotals,
  hasActivePermit,
  involves,
  isVisibleToCity,
  permitSessions,
  queueFor,
  reviewClock,
  sessionDates,
  useDemo,
  resetDemoStoreForTests,
  waitingOn,
  whoIsUp,
  type Action,
  type ActionType,
  type BoardColumn,
} from "@/lib/state";
import { EMPTY_ADDONS, type Dept, type EventAnswers, type EventCase, type FileRef, type ISODate, type Location, type Party, type Task } from "@/lib/types";

const TODAY = DEFAULT_DEMO_TODAY;
const S1 = "PMT-27-0109";
const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S4 = "PMT-27-0126";
const S5 = "PMT-27-0097";
const S6 = "PMT-27-0031";
const PLAZA_WEDDING_PHOTOS = "PMT-27-0115";

const SAMPLE_FILE: FileRef = { name: "sample-health-permit.pdf", size: 248_000, type: "application/pdf" };

/* ---------- the store, as a screen uses it ---------- */

const store = () => useDemo.getState();
const cases = () => store().cases;
const ctx = (): RulesCtx => ({ today: store().demoToday, cases: cases(), cfg: store().cfg });

function get(id: string): EventCase {
  const found = cases().find((c) => c.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
}

/** Switches role (and persona, for the Applicant) with the top bar's controls. */
function as(role: Party, personaId?: string): void {
  store().setRole(role);
  if (personaId) store().setPersona(personaId);
}

/** Dispatches as the current role, as a control on a screen does. Fails the test if refused. */
function act(caseId: string, action: Action): string[] {
  const result = store().dispatch(caseId, action);
  if (!result.ok) throw new Error(`${action.type} as ${store().role} was refused: ${result.reason}`);
  return result.spawnedIds ?? [];
}

/** The reason the engine gives for refusing, or null when the action went through. */
function refusal(caseId: string, action: Action): string | null {
  const result = store().dispatch(caseId, action);
  return result.ok ? null : (result.reason ?? "");
}

/* ---------- what each role sees ---------- */

const task = (c: EventCase, suffix: string): Task => {
  const found = c.tasks.find((t) => t.id === `${c.id}:${suffix}`);
  if (!found) throw new Error(`${c.id} has no task ${suffix}`);
  return found;
};

function board(c: EventCase): Record<BoardColumn, string[]> {
  const columns = boardColumns(c);
  const suffix = (t: Task) => t.id.slice(c.id.length + 1);
  return { do_now: columns.do_now.map(suffix), with_city: columns.with_city.map(suffix), coming_up: columns.coming_up.map(suffix), done: columns.done.map(suffix) };
}

const up = (id: string) => whoIsUp(get(id), store().demoToday);
const note = (id: string, party: Party) => waitingOn(get(id), store().demoToday).find((p) => p.party === party)!.note;
/** The role's My queue rows for one case, as task ids without the case prefix. */
const queue = (role: Dept, id: string) =>
  queueFor(cases(), role, store().demoToday)
    .filter((item) => item.case.id === id)
    .map((item) => item.task.catalogId);
const queueSizes = () => ({ clerk: queueFor(cases(), "clerk", TODAY).length, pws: queueFor(cases(), "pws", TODAY).length, hl: queueFor(cases(), "hl", TODAY).length });
const active = () => activePermits(cases(), store().demoToday).map((c) => c.id);
const panel = (id: string, role: Party, type: ActionType) => availableActions(get(id), role, ctx()).find((a) => a.type === type);
/** What a new applicant would be told about this place and time. */
const slot = (location: Location, date: ISODate, start = "00:00", end = "23:59") => availability(location, { date, start, end }, ctx());

const space = (id: string, label: string): Location => ({ mode: "inventory", inventoryIds: [id], segmentIds: [], label });
const SHELTER_2 = space("shelter-2", "Shelter 2, Riverside Park");
const SHELTER_3 = space("shelter-3", "Shelter 3, Riverside Park");
const FIELD_4 = space("field-4", "Field 4, Riverside Park");
const CITY_HALL_PLAZA: Location = { mode: "area", inventoryIds: [], areaId: "city-hall-plaza", areaRect: { x: 40, y: 30, w: 40, h: 20 }, segmentIds: [], squareFeet: 800, capacity: 80, label: "City Hall Plaza" };
const GREAT_LAWN: Location = { mode: "area", inventoryIds: [], areaId: "great-lawn", areaRect: { x: 10, y: 10, w: 120, h: 100 }, segmentIds: [], squareFeet: 12000, capacity: 1200, label: "Great Lawn" };
const TWO_MAIN_STREET_BLOCKS: Location = { mode: "streets", inventoryIds: [], segmentIds: ["main-1-2", "main-2-3"], miles: 0.2, label: "Main Street, 1st to 3rd Avenue" };

/** What the wizard's live panel shows for a draft: tier, lead time, reviewers and the estimate. */
function livePanel(id: string) {
  const draft = get(id);
  const cls = classify(draft, store().cfg);
  return {
    tier: draft.tier,
    classified: cls.tier,
    leadTimeDays: cls.leadTimeDays,
    triggers: cls.triggers.map((t) => t.id),
    reviewers: cls.reviewers.map((r) => r.dept),
    total: estimateFees(draft, cls, store().cfg).total,
    whatIf: whatIf(draft, store().cfg).map((w) => [w.triggerId, w.tier, w.text]),
  };
}

beforeEach(() => {
  resetDemoStoreForTests();
});

afterEach(() => {
  // Every path has changed something...
  expect(cases()).not.toEqual(buildSeed());
  // ...and Reset returns the seed exactly, with the demo's defaults.
  store().reset();
  expect(cases()).toEqual(buildSeed());
  expect(store()).toMatchObject({ demoToday: TODAY, role: "applicant", personaId: "new", hints: true, cfg: DEFAULT_CONFIG, lastPathByRole: {} });
});

describe("the store opens on the seed", () => {
  it("38 cases on Mon, May 3, 2027, and a path that changes one case leaves the other 37 alone", () => {
    expect(cases()).toEqual(buildSeed());
    expect(cases()).toHaveLength(38);
    expect(fmtDate(store().demoToday)).toBe("Mon, May 3, 2027");

    as("clerk");
    act(S3, { type: "add_note", text: "Called the organizer about the food truck." });
    const seed = buildSeed();
    expect(cases().filter((c, i) => c.id !== S3 && JSON.stringify(c) !== JSON.stringify(seed[i]))).toEqual([]);
    expect(get(S3).activity.at(-1)).toEqual({ at: "2027-05-03T09:00", actor: "clerk", text: "Called the organizer about the food truck." });
  });
});

describe("Path 1 · Instant in two minutes (S2)", () => {
  it("Sunrise Yoga Club finishes the wizard, pays the first session, and the Clerk sees 13 Sundays on Field 4", () => {
    const queuesBefore = queueSizes();
    const activeBefore = active();

    // As Sunrise Yoga Club: the persona opens its draft, in the wizard at step 3.
    as("applicant", "sunrise-yoga-club");
    expect(applicantCases(cases(), store().personaId).map((c) => c.id)).toEqual([S2]);
    expect(get(S2)).toMatchObject({ state: "draft", wizardStep: "when", tier: "instant" });
    expect(isVisibleToCity(get(S2))).toBe(false);

    // Step 4 and step 5: the answers stand, the wizard moves on.
    store().updateDraft(S2, { wizardStep: "size" });
    store().updateDraft(S2, { wizardStep: "plan" });
    expect(get(S2)).toMatchObject({ state: "draft", wizardStep: "plan", tier: "instant", attendance: 20 });

    // The plan shows Instant, 13 sessions at $20.
    const cls = classify(get(S2), store().cfg);
    expect(cls).toMatchObject({ tier: "instant", leadTimeDays: 10, reviewers: [] });
    expect(estimateFees(get(S2), cls, store().cfg)).toMatchObject({ perSession: 20, sessions: 13, total: 260, dueNow: 20 });
    expect(get(S2).schedule!.occurrences).toHaveLength(13);
    // The date gate passes: Jun 6 is 34 days out, and Jul 11 is a warning, not a block.
    expect(dateGate(get(S2), cls, ctx(), S2)).toMatchObject({ ok: true, leadTimeOk: true, daysUntil: 34, fixes: [], availability: { status: "impacted" } });
    expect(panel(S2, "applicant", "book_and_pay")).toMatchObject({ label: "Pay and book", enabled: true, primary: true });

    // Pay the first session; the series permit appears.
    act(S2, { type: "book_and_pay", method: "card" });
    const booked = get(S2);
    expect(booked).toMatchObject({ state: "permitted", tier: "instant", ending: null, permit: { issuedOn: TODAY, signature: null }, dateHold: { status: "held", placedOn: TODAY, expiresOn: null } });
    expect(booked.payments).toEqual([{ id: `${S2}:pay:1`, at: "2027-05-03T09:01", amount: 20, method: "card", kind: "booking" }]);
    expect(booked.schedule!.occurrences.map((o) => o.billing)).toEqual(["paid", ...Array(12).fill("upcoming")]);
    expect(caseTotals(booked)).toEqual({ fees: 260, deposit: 0, total: 260, paid: 20, due: 240 });
    expect(board(booked)).toEqual({ do_now: [], with_city: [], coming_up: ["carry_permit"], done: ["pay_fees"] });
    expect(task(booked, "pay_fees")).toMatchObject({ title: "Pay and book", payload: { amount: 20 } });
    expect(booked.activity.at(-1)?.text).toBe("Paid $20 and booked the date. The permit is issued.");
    expect(up(S2)).toEqual([]);
    // Paying twice is refused.
    expect(refusal(S2, { type: "book_and_pay", method: "card" })).toBe("This case is permitted.");
    // The other twelve sessions are paid one at a time: the next one has its own control.
    expect(availableActions(booked, "applicant", ctx()).map((a) => [a.type, a.label, a.enabled])).toEqual([
      ["pay", "Pay the next session", true],
      ["cancel", "Cancel", true],
      ["amend", "Amend", true],
    ]);

    // Switch to City Clerk: Active permits shows 13 Sundays on Field 4.
    as("clerk");
    expect(isVisibleToCity(get(S2))).toBe(true);
    expect(active()).toEqual(expect.arrayContaining([...activeBefore, S2]));
    expect(active()).toHaveLength(activeBefore.length + 1);
    const sundays = permitSessions(cases()).filter((s) => s.case.id === S2);
    expect(sundays.map((s) => s.date)).toEqual(datesEvery("2027-06-06", "2027-08-29", 7));
    expect(sundays).toHaveLength(13);
    expect(sundays.every((s) => weekdayOf(s.date) === 0 && s.case.location?.inventoryIds[0] === "field-4")).toBe(true);
    // The week of Jul 11 on the calendar: the class and the 5K's hold are both there.
    expect(permitSessions(cases(), { from: "2027-07-11", to: "2027-07-11", includeHolds: true }).map((s) => s.case.id)).toEqual([S5, S2]);

    // An Instant booking gives the city no task: every queue is as it was.
    expect(queueSizes()).toEqual(queuesBefore);
    expect(get(S2).tasks.filter((t) => t.owner !== "applicant")).toEqual([]);

    // The next applicant sees Field 4 as Booked at the hour of the class, on every one of the Sundays.
    for (const date of datesEvery("2027-06-06", "2027-08-29", 7)) {
      expect(slot(FIELD_4, date, "08:00", "09:00"), date).toMatchObject({ status: "booked", reason: "Sunrise Yoga Club weekly class has this date held" });
    }
    expect(slot(FIELD_4, "2027-06-07", "08:00", "09:00").status).toBe("open");
    expect(slot(FIELD_4, "2027-06-06", "10:00", "12:00").status).toBe("open");
  });
});

describe("Path 2 · Watch the tier move (New applicant)", () => {
  it("Shelter 2 for 40 is Instant; alcohol makes it Reviewed; two Main Street blocks make it Special; 1,200 people with no street is still Special", () => {
    const queuesBefore = queueSizes();

    as("applicant", "new");
    expect(applicantCases(cases(), "new")).toEqual([]);
    const id = store().createDraft("new", { eventType: "picnic_party", name: "Summer picnic" });
    expect(id).toBe("PMT-27-0143");
    expect(get(id)).toMatchObject({ state: "draft", tier: "instant", applicantId: "new", wizardStep: "what", triggers: [] });

    // Picnic or party at Shelter 2 for 40 people: Instant.
    store().updateDraft(id, { location: SHELTER_2, wizardStep: "where" });
    store().updateDraft(id, { schedule: { date: "2027-06-19", start: "11:00", end: "16:00", occurrences: [] }, wizardStep: "when" });
    store().updateDraft(id, { attendance: 40, wizardStep: "size" });
    expect(get(id).schedule!.occurrences).toEqual([{ date: "2027-06-19", availability: { status: "open" }, billing: "upcoming" }]);
    expect(livePanel(id)).toEqual({ tier: "instant", classified: "instant", leadTimeDays: 10, triggers: [], reviewers: [], total: 125, whatIf: [] });
    expect(capacityWarning(get(id))).toBeNull();
    expect(panel(id, "applicant", "book_and_pay")).toMatchObject({ enabled: true });

    // One more guest than the shelter holds is a warning with a larger space, never a tier.
    store().updateDraft(id, { attendance: 41 });
    expect(get(id).tier).toBe("instant");
    expect(capacityWarning(get(id))).toMatchObject({ capacity: 40, over: 1, suggestionId: "shelter-3" });
    store().updateDraft(id, { attendance: 40 });

    // Turn on alcohol: Reviewed, and the what-if chip offers the way back.
    store().updateDraft(id, { addOns: { ...EMPTY_ADDONS, alcohol: true } });
    expect(livePanel(id)).toEqual({
      tier: "reviewed",
      classified: "reviewed",
      leadTimeDays: 30,
      triggers: ["alcohol"],
      // The Clerk for the license, Public Works & Safety for police, Health & Legal for insurance.
      reviewers: ["clerk", "pws", "hl"],
      // Shelter $125, alcohol license $100, application $50, deposit $250.
      total: 525,
      whatIf: [["alcohol", "instant", "Remove alcohol: Instant, book today"]],
    });
    expect(panel(id, "applicant", "book_and_pay")).toBeUndefined();
    expect(panel(id, "applicant", "create_board")).toMatchObject({ enabled: true, primary: true });

    // Taking the way back, and coming forward again.
    store().updateDraft(id, { addOns: EMPTY_ADDONS });
    expect(livePanel(id)).toMatchObject({ tier: "instant", total: 125, reviewers: [], whatIf: [] });
    store().updateDraft(id, { addOns: { ...EMPTY_ADDONS, alcohol: true } });
    expect(get(id).tier).toBe("reviewed");

    // Switch the location to two Main Street blocks: Special event.
    store().updateDraft(id, { location: TWO_MAIN_STREET_BLOCKS });
    expect(livePanel(id)).toEqual({
      tier: "special",
      classified: "special",
      leadTimeDays: 60,
      triggers: ["street", "alcohol"],
      reviewers: ["clerk", "pws", "hl"],
      // Two blocks $300, alcohol license $100, application $250, deposit $1,000.
      total: 1650,
      // Dropping alcohol no longer changes the tier: the street alone makes it Special.
      whatIf: [],
    });
    expect(routing(get(id), classify(get(id))).find((r) => r.dept === "pws")?.reasons).toEqual(["Street closure", "Alcohol"]);
    // Jun 19 is 47 days out and a Special event needs 60: the gate now offers a new date or the late fee.
    expect(dateGate(get(id), classify(get(id)), ctx(), id)).toMatchObject({ ok: false, leadTimeOk: false, daysUntil: 47, fixes: ["new_date", "late_fee"] });

    // Set attendance to 1,200 with no street: still Special.
    store().updateDraft(id, { location: SHELTER_2, attendance: 1200 });
    expect(livePanel(id)).toEqual({
      tier: "special",
      classified: "special",
      leadTimeDays: 60,
      triggers: ["attendance_1000", "alcohol"],
      reviewers: ["clerk", "pws", "hl"],
      // Shelter $125, alcohol license $100, application $250, deposit $1,000.
      total: 1475,
      whatIf: [],
    });
    expect(get(id).triggers.map((t) => t.id)).not.toContain("street");
    expect(get(id).triggers.find((t) => t.id === "attendance_1000")?.label).toBe("1,200 people");
    expect(routing(get(id), classify(get(id))).find((r) => r.dept === "pws")?.reasons).toEqual(["1,000 or more attendees", "Alcohol"]);
    // No shelter holds that many: a warning beside the answer, with nothing larger to suggest.
    expect(capacityWarning(get(id))).toMatchObject({ capacity: 40, over: 1160, suggestionId: null });
    // On an open area the same crowd is Special too.
    store().updateDraft(id, { location: GREAT_LAWN });
    expect(livePanel(id)).toMatchObject({ tier: "special", triggers: ["plaza_open_area", "attendance_1000", "alcohol"], total: 1550 });
    store().updateDraft(id, { location: SHELTER_2 });
    // One fewer than the threshold, and the same event is Reviewed.
    store().updateDraft(id, { attendance: 999 });
    expect(get(id).tier).toBe("reviewed");
    store().updateDraft(id, { attendance: 1200 });
    expect(get(id).tier).toBe("special");

    // None of this is the city's business yet: a Draft is the applicant's alone and holds no date.
    expect(isVisibleToCity(get(id))).toBe(false);
    for (const role of ["clerk", "pws", "hl"] as const) expect(involves(get(id), role)).toBe(false);
    expect(queueSizes()).toEqual(queuesBefore);
    expect(slot(SHELTER_2, "2027-06-19").status).toBe("open");
    expect(applicantCases(cases(), "new").map((c) => c.id)).toEqual([id]);
  });
});

describe("Path 3 · Answer a request (S3)", () => {
  it("the applicant answers, Health & Legal verifies and approves, the Clerk sends the $715 quote, the applicant signs and pays, the Clerk issues the permit", () => {
    const healthPermit = `${S3}:vendor_health_permit:1`;
    const activeBefore = active();

    // As Downtown Arts Collective: open the pinned card, use the sample file, send.
    as("applicant", "downtown-arts-collective");
    expect(applicantCases(cases(), store().personaId).map((c) => c.id)).toEqual([S3]);
    expect(board(get(S3)).do_now).toEqual(["vendor_health_permit:1"]);
    act(S3, { type: "respond_to_request", taskId: healthPermit, files: [SAMPLE_FILE] });

    // The card moves to With the city, and the move is Health & Legal's.
    expect(get(S3).state).toBe("in_review");
    expect(board(get(S3))).toMatchObject({ do_now: [], with_city: ["vendor_health_permit:1"] });
    expect(task(get(S3), "vendor_health_permit:1")).toMatchObject({ status: "submitted", request: { resolved: true }, payload: { files: [SAMPLE_FILE] } });
    expect(up(S3)).toEqual(["hl"]);
    expect(queue("hl", S3)).toEqual(["review:hl"]);
    // The review clock ran three days paused, and runs again.
    expect(get(S3).reviews.find((r) => r.dept === "hl")).toMatchObject({ status: "pending", clock: { pausedSince: null, pausedDays: 3 } });
    expect(reviewClock(get(S3), "hl", TODAY)?.label).toBe("Day 11 of 14 · paused 3 days");
    // The Clerk cannot send a quote yet, and says why.
    expect(panel(S3, "clerk", "send_quote")).toMatchObject({ enabled: false, reason: "Waiting on every reviewer to approve." });

    // As Health & Legal: verify it and approve the section.
    as("hl");
    act(S3, { type: "verify_document", taskId: healthPermit });
    expect(task(get(S3), "vendor_health_permit:1").status).toBe("done");
    expect(get(S3).reviews.find((r) => r.dept === "hl")?.status).toBe("pending");
    act(S3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] });
    expect(get(S3).reviews.map((r) => [r.dept, r.status, r.decidedOn])).toEqual([
      ["pws", "approved_with_conditions", "2027-04-28"],
      ["hl", "approved", TODAY],
    ]);
    expect(queue("hl", S3)).toEqual([]);
    expect(up(S3)).toEqual(["clerk"]);
    expect(queue("clerk", S3)).toEqual(["consolidate"]);
    expect(note(S3, "hl")).toBe("Approved");

    // As City Clerk: consolidate. Public Works & Safety's conditions carry over; send the $715 quote.
    as("clerk");
    expect(panel(S3, "clerk", "send_quote")).toMatchObject({ enabled: true, primary: true });
    const reviewed = get(S3);
    expect(reviewed.conditions.map((cond) => [cond.dept, cond.text, cond.mergedByClerk])).toEqual([
      ["pws", "Sound ends at 9 pm", false],
      ["pws", "Speakers face away from the residences on Elm Street", false],
      ["pws", "No more than 85 dB at 50 feet", false],
    ]);
    act(S3, {
      type: "send_quote",
      conditions: reviewed.conditions.map((cond) => ({ dept: cond.dept, text: cond.text })),
      feeLines: reviewed.feeLines.map((line) => ({ dept: line.dept, label: line.label, qty: line.qty, unit: line.unit, unitPrice: line.unitPrice, kind: line.kind })),
    });
    const quoted = get(S3);
    expect(quoted.state).toBe("quote_sent");
    expect(quoted.conditions.map((cond) => [cond.dept, cond.text, cond.mergedByClerk, cond.acceptedByApplicant])).toEqual([
      ["pws", "Sound ends at 9 pm", true, false],
      ["pws", "Speakers face away from the residences on Elm Street", true, false],
      ["pws", "No more than 85 dB at 50 feet", true, false],
    ]);
    expect(caseTotals(quoted)).toEqual({ fees: 465, deposit: 250, total: 715, paid: 0, due: 715 });
    // The hold now has an end: 14 days to accept, sign and pay.
    expect(quoted.dateHold).toEqual({ status: "held", placedOn: "2027-04-19", expiresOn: "2027-05-17" });
    expect(board(quoted)).toMatchObject({ do_now: ["accept_and_sign", "pay_fees"], with_city: [], coming_up: ["carry_permit"] });
    expect(task(quoted, "pay_fees")).toMatchObject({ dueDate: "2027-05-17", payload: { amount: 715 } });
    expect(up(S3)).toEqual(["applicant"]);
    expect(queue("clerk", S3)).toEqual([]);
    expect(note(S3, "clerk")).toBe("Unlocks when paid and verified");
    expect(panel(S3, "clerk", "issue_permit")).toMatchObject({ enabled: false, reason: "Needs: signature (applicant), payment (applicant)" });
    // The toggle on Active permits now lists it as a quote holding a date.
    expect(activePermits(cases(), TODAY, { includeHolds: true }).map((c) => c.id)).toContain(S3);
    expect(active()).toEqual(activeBefore);

    // As the applicant: accept, sign and pay.
    as("applicant");
    act(S3, { type: "accept_and_sign", signature: "Jordan Alvarez" });
    expect(get(S3).flags.signed).toBe(true);
    expect(get(S3).conditions.every((cond) => cond.acceptedByApplicant)).toBe(true);
    expect(board(get(S3)).do_now).toEqual(["pay_fees"]);
    act(S3, { type: "pay", amount: 715, method: "card", kind: "quote" });
    expect(caseTotals(get(S3))).toMatchObject({ paid: 715, due: 0 });
    expect(board(get(S3)).do_now).toEqual([]);
    // Paid, so the date can no longer be lost.
    expect(get(S3).dateHold).toEqual({ status: "held", placedOn: "2027-04-19", expiresOn: null });
    // Insurance was verified on Apr 21, so nothing else is missing: the Clerk's issue step is up.
    expect(up(S3)).toEqual(["clerk"]);
    expect(queue("clerk", S3)).toEqual(["issue_permit"]);
    expect(refusal(S3, { type: "issue_permit" })).toBe("Only the City Clerk can issue the permit.");

    // As City Clerk: issue the permit. It appears in Active permits.
    as("clerk");
    expect(panel(S3, "clerk", "issue_permit")).toMatchObject({ enabled: true });
    act(S3, { type: "issue_permit" });
    const permitted = get(S3);
    expect(permitted).toMatchObject({ state: "permitted", permit: { issuedOn: TODAY, signature: "Jordan Alvarez" } });
    expect(active()).toEqual(expect.arrayContaining([...activeBefore, S3]));
    expect(permitSessions(cases()).filter((s) => s.case.id === S3).map((s) => s.date)).toEqual(["2027-06-18"]);
    expect(up(S3)).toEqual([]);
    for (const role of ["clerk", "pws", "hl"] as const) expect(queue(role, S3)).toEqual([]);
    // A plaza concert with no street and no city services needs no work order.
    expect(permitted.tasks.filter((t) => t.catalogId.startsWith("work_order:"))).toEqual([]);
    expect(board(permitted)).toMatchObject({ do_now: [], with_city: [], coming_up: ["carry_permit"] });
    // The wedding photos still cannot have the plaza that evening.
    expect(panel(PLAZA_WEDDING_PHOTOS, "clerk", "accept_complete")).toMatchObject({ enabled: false, reason: "Jazz in the Plaza has this date held" });

    // The Demo menu: jumping to Fri, Jun 18 puts Jazz in the Plaza on Event day.
    store().setDemoToday("2027-06-18");
    expect(store().demoToday).toBe("2027-06-18");
    expect(get(S3).state).toBe("event_day");
    expect(board(get(S3)).do_now).toEqual(["carry_permit"]);
    expect(get(S3).activity.at(-1)).toEqual({ at: "2027-06-18T09:00", actor: "system", text: "Today is event day." });
  });
});

describe("Path 4 · Neighbors and the date hold (S4)", () => {
  it("three more sign-offs, the Clerk accepts (the hold appears) and confirms routing, and the block party is in Public Works & Safety's queue", () => {
    const maple400 = get(S4).location!;

    // On load: the applicant is up, the Clerk waits, and nobody holds the block.
    expect(up(S4)).toEqual(["applicant"]);
    expect(queue("clerk", S4)).toEqual([]);
    expect(queue("pws", S4)).toEqual([]);
    expect(slot(maple400, "2027-06-26").status).toBe("open");

    // As the block captain: "Simulate a sign-off", three times.
    as("applicant", "maple-street-block-captain");
    act(S4, { type: "simulate_signoff" });
    expect(task(get(S4), "neighbor_signoff")).toMatchObject({ status: "todo", payload: { progress: { done: 10, total: 12 } } });
    expect(note(S4, "clerk")).toBe("Waiting on 2 neighbor sign-offs");
    expect(panel(S4, "clerk", "accept_complete")).toMatchObject({ enabled: false, reason: "Waiting on 2 neighbor sign-offs" });
    act(S4, { type: "simulate_signoff" });
    expect(note(S4, "clerk")).toBe("Waiting on 1 neighbor sign-off");
    act(S4, { type: "simulate_signoff" });
    expect(task(get(S4), "neighbor_signoff")).toMatchObject({ status: "done", payload: { progress: { done: 12, total: 12 } } });
    expect(refusal(S4, { type: "simulate_signoff" })).toBe("All neighbors have already signed off.");
    expect(board(get(S4))).toEqual({
      do_now: [],
      with_city: ["insurance_certificate", "city_services_request"],
      coming_up: ["accept_and_sign", "pay_fees", "carry_permit"],
      done: ["neighbor_signoff", "submit_application"],
    });
    // The last sign-off is what hands the case to the Clerk: its three days start today.
    expect(up(S4)).toEqual(["clerk"]);
    expect(queue("clerk", S4)).toEqual(["intake_check"]);
    expect(task(get(S4), "intake_check")).toMatchObject({ status: "todo", dueDate: "2027-05-06" });
    expect(get(S4).dateHold.status).toBe("none");
    // The applicant cannot accept their own application.
    expect(refusal(S4, { type: "accept_complete" })).toBe("Only the City Clerk can accept an application as complete.");

    // As City Clerk: Accept is now enabled in intake. Accept, and the date hold appears.
    as("clerk");
    expect(panel(S4, "clerk", "accept_complete")).toMatchObject({ enabled: true, primary: true });
    act(S4, { type: "accept_complete" });
    expect(get(S4)).toMatchObject({ state: "submitted", flags: { acceptedComplete: true }, dateHold: { status: "held", placedOn: TODAY, expiresOn: null } });
    expect(queue("clerk", S4)).toEqual(["confirm_routing"]);
    expect(slot(maple400, "2027-06-26")).toMatchObject({ status: "booked", reason: "Maple Street block party has this date held" });
    expect(activePermits(cases(), TODAY, { includeHolds: true }).map((c) => c.id)).not.toContain(S4);

    // Confirm routing, prefilled from routing(): Public Works & Safety and Health & Legal.
    const suggested = routing(get(S4), classify(get(S4), store().cfg), store().cfg);
    expect(suggested.map((r) => [r.dept, r.reasons, r.sections])).toEqual([
      ["pws", ["Block party", "City services"], ["City services request"]],
      ["hl", ["Insurance verification"], ["Certificate of insurance"]],
    ]);
    const due = dueDate(TODAY, store().cfg.sla.reviewDays.reviewed, store().cfg);
    expect(due).toBe("2027-05-17");
    // A list with nobody on it, or with a department twice, is refused.
    expect(refusal(S4, { type: "confirm_routing", reviewers: [] })).toBe("Choose at least one reviewer.");
    const reviewers = suggested.map((r) => ({ dept: r.dept, sections: r.sections, dueDate: due }));
    expect(refusal(S4, { type: "confirm_routing", reviewers: [...reviewers, reviewers[0]] })).toBe("Public Works & Safety is on the list twice; route each department once.");
    act(S4, { type: "confirm_routing", reviewers });

    // The case moves to In review.
    const routed = get(S4);
    expect(routed.state).toBe("in_review");
    expect(routed.reviews.map((r) => [r.dept, r.status, r.dueDate, r.clock.startedOn, r.clock.allowedDays])).toEqual([
      ["pws", "pending", "2027-05-17", TODAY, 14],
      ["hl", "pending", "2027-05-17", TODAY, 14],
    ]);
    expect(queue("clerk", S4)).toEqual([]);
    // The Clerk is waiting on the two reviews, and its row says so.
    expect(waitingOn(get(S4), TODAY).find((p) => p.party === "clerk")).toMatchObject({ status: "waiting", note: "Unlocks when every review is in", nextTask: { catalogId: "consolidate" } });
    expect(task(get(S4), "consolidate")).toMatchObject({ owner: "clerk", status: "locked" });

    // Public Works & Safety's queue now shows the block party. So does Health & Legal's.
    as("pws");
    expect(queueFor(cases(), "pws", TODAY).filter((item) => item.case.id === S4)).toMatchObject([{ task: { catalogId: "review:pws", title: "Review your sections", dueDate: "2027-05-17" }, group: "later", daysWaiting: 0 }]);
    expect(queue("hl", S4)).toEqual(["review:hl"]);
    expect(up(S4)).toEqual(["pws", "hl"]);
    expect(involves(get(S4), "pws")).toBe(true);
    expect(panel(S4, "pws", "review_decide")).toMatchObject({ enabled: true, primary: true });
    expect(reviewClock(get(S4), "pws", TODAY)?.label).toBe("Day 0 of 14");
    // The cards the applicant sent in are covered by those two reviews.
    expect(board(get(S4)).with_city).toEqual(["insurance_certificate", "city_services_request"]);
  });
});

describe("Path 5 · Two parties up at once (S5)", () => {
  it("Issue permit names both things it waits for; Health & Legal verifies; the applicant signs and pays $6,530; the Clerk issues; Public Works & Safety gets its work orders", () => {
    const insurance = `${S5}:insurance_certificate`;
    const NEEDS_ALL = "Needs: signature (applicant), payment (applicant), insurance (Health & Legal)";

    // As City Clerk, open the case: Who's up highlights both the applicant and Health & Legal.
    as("clerk");
    expect(up(S5)).toEqual(["applicant", "hl"]);
    expect(waitingOn(get(S5), TODAY).map((p) => [p.party, p.status])).toEqual([
      ["applicant", "up_now"],
      ["clerk", "waiting"],
      ["pws", "done_for_now"],
      ["hl", "up_now"],
    ]);
    // Issue permit is disabled, and says why: the applicant has not paid and Health & Legal has not verified.
    expect(panel(S5, "clerk", "issue_permit")).toMatchObject({ label: "Issue permit", enabled: false, primary: true, reason: NEEDS_ALL });
    expect(refusal(S5, { type: "issue_permit" })).toBe(NEEDS_ALL);
    expect(get(S5).state).toBe("quote_sent");
    expect(queue("clerk", S5)).toEqual([]);

    // As Health & Legal: verify the insurance.
    as("hl");
    expect(queue("hl", S5)).toEqual(["verify:insurance_certificate"]);
    // Public Works & Safety does not check insurance.
    expect(store().dispatch(S5, { type: "verify_document", taskId: insurance }, "pws")).toEqual({ ok: false, reason: "Health & Legal checks this card." });
    act(S5, { type: "verify_document", taskId: insurance });
    expect(task(get(S5), "insurance_certificate").status).toBe("done");
    expect(task(get(S5), "verify:insurance_certificate").status).toBe("done");
    expect(queue("hl", S5)).toEqual([]);
    expect(up(S5)).toEqual(["applicant"]);
    expect(board(get(S5))).toMatchObject({ do_now: ["accept_and_sign", "pay_fees"], with_city: [] });
    expect(panel(S5, "clerk", "issue_permit")).toMatchObject({ enabled: false, reason: "Needs: signature (applicant), payment (applicant)" });

    // As the applicant: sign and pay $6,530.
    as("applicant", "riverfront-running-club");
    expect(applicantCases(cases(), store().personaId).map((c) => c.id)).toEqual([S5]);
    act(S5, { type: "accept_and_sign", signature: "Simone Dubois" });
    expect(panel(S5, "clerk", "issue_permit")).toMatchObject({ enabled: false, reason: "Needs: payment (applicant)" });
    expect(task(get(S5), "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 6530 } });
    act(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" });
    expect(caseTotals(get(S5))).toEqual({ fees: 5530, deposit: 1000, total: 6530, paid: 6530, due: 0 });
    expect(get(S5).dateHold).toEqual({ status: "held", placedOn: "2027-03-10", expiresOn: null });
    expect(up(S5)).toEqual(["clerk"]);
    expect(queue("clerk", S5)).toEqual(["issue_permit"]);

    // As City Clerk: issue the permit.
    as("clerk");
    expect(panel(S5, "clerk", "issue_permit")).toMatchObject({ enabled: true });
    expect(queue("pws", S5)).toEqual([]);
    act(S5, { type: "issue_permit" });
    const permitted = get(S5);
    expect(permitted).toMatchObject({ state: "permitted", permit: { issuedOn: TODAY, signature: "Simone Dubois" } });
    expect(active()).toContain(S5);
    expect(queue("clerk", S5)).toEqual([]);

    // Public Works & Safety gets its work orders, due two days before the race...
    as("pws");
    expect(queueFor(cases(), "pws", TODAY).filter((item) => item.case.id === S5).map((item) => [item.task.catalogId, item.task.title, item.task.dueDate])).toEqual([
      ["work_order:barricades", "Deliver barricades", "2027-07-09"],
      ["work_order:police", "Staff police officers", "2027-07-09"],
      ["work_order:closure", "Close the street", "2027-07-09"],
    ]);
    // ...and the route shows on its map for Jul 11.
    const onJul11 = permitSessions(cases(), { from: "2027-07-11", to: "2027-07-11" });
    expect(onJul11.map((s) => s.case.id)).toEqual([S5]);
    expect(onJul11[0].case.location).toMatchObject({ mode: "route", miles: 3.1 });
    // The meetings the Clerk set are now on the applicant's board, with their dates.
    expect(board(permitted).do_now).toEqual(["coordination_meeting", "site_walkthrough"]);
    expect([task(permitted, "coordination_meeting").payload.scheduledFor, task(permitted, "site_walkthrough").payload.scheduledFor]).toEqual(["2027-06-21", "2027-07-02"]);
    // Each is due on the day it is set for: the applicant's row reads Jun 21, not the plan's Jun 18.
    expect(boardColumns(permitted).do_now.map((t) => [t.catalogId, t.dueDate])).toEqual([
      ["coordination_meeting", "2027-06-21"],
      ["site_walkthrough", "2027-07-02"],
    ]);
    expect(waitingOn(permitted, TODAY).find((p) => p.party === "applicant")?.oldestDue).toBe("2027-06-21");
    expect(up(S5)).toEqual(["applicant", "pws"]);

    // Starting a new City Hall Plaza event on Jul 11 shows the Impacted warning. Impacted, not blocked.
    as("applicant", "new");
    const id = store().createDraft("new", {
      eventType: "performance_rally",
      name: "Plaza brass band",
      location: CITY_HALL_PLAZA,
      schedule: { date: "2027-07-11", start: "13:00", end: "15:00", occurrences: [] },
      attendance: 80,
    });
    const warning = { status: "impacted", reason: "Riverfront Summer 5K closes Main Street 6 to 11:30 am that day" };
    expect(get(id).schedule!.occurrences).toEqual([{ date: "2027-07-11", availability: warning, billing: "upcoming" }]);
    expect(dateGate(get(id), classify(get(id)), ctx(), id)).toMatchObject({ ok: true, leadTimeOk: true, availability: warning, fixes: [] });
    // It can go on to its board like any other date.
    act(id, { type: "create_board" });
    expect(get(id)).toMatchObject({ tier: "reviewed", state: "draft" });
    // The streets of the route itself are a different matter: those are booked.
    expect(slot({ mode: "streets", inventoryIds: [], segmentIds: MAIN_1ST_TO_4TH, label: "Main Street, 1st to 4th Avenue" }, "2027-07-11", "08:00", "10:00")).toMatchObject({
      status: "booked",
      reason: "Riverfront Summer 5K has this date held",
    });
  });
});

describe("Path 6 · Closeout (S6)", () => {
  it("Public Works & Safety passes the cleanup check and logs the hours; the Clerk reconciles $750 over and refunds $250; the applicant books again for Sat, Apr 22, 2028", () => {
    // As Public Works & Safety: pass the cleanup check, log 72 officer-hours and 4 crew-hours.
    as("pws");
    expect(queue("pws", S6)).toEqual(["cleanup_inspection", "log_actual_hours"]);
    expect(panel(S6, "pws", "log_closeout")).toMatchObject({ enabled: true, primary: true });
    expect(panel(S6, "clerk", "reconcile_close")).toMatchObject({ enabled: false, reason: "Waiting on Public Works & Safety to log hours." });
    const police = get(S6).feeLines.find((line) => line.label === "Police")!;
    expect(police).toMatchObject({ qty: 66, unit: "officer-hour", unitPrice: 85, estimate: 5610, actual: null });
    act(S6, {
      type: "log_closeout",
      cleanup: "pass",
      notes: "Street swept and reopened by 11 pm.",
      actuals: [{ feeLineId: police.id, qty: 72 }],
      extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: store().cfg.fees.cleanupCrewPerWorkerHour }],
    });
    const logged = get(S6);
    expect(logged.state).toBe("closeout");
    expect(logged.closeout).toMatchObject({ cleanup: "pass", notes: "Street swept and reopened by 11 pm.", hoursLoggedOn: TODAY, balance: null, refund: null });
    expect(logged.feeLines.find((line) => line.label === "Police")).toMatchObject({ estimate: 5610, actual: 6120 });
    expect(logged.feeLines.at(-1)).toMatchObject({ label: "Cleanup crew", qty: 4, unitPrice: 60, estimate: 0, actual: 240 });
    expect(queue("pws", S6)).toEqual([]);
    // Then the Clerk reconciles.
    expect(up(S6)).toEqual(["clerk"]);
    expect(queue("clerk", S6)).toEqual(["reconcile"]);

    // As City Clerk: reconciliation shows $750 over the estimate.
    as("clerk");
    const over = logged.feeLines.filter((line) => line.kind !== "deposit").reduce((sum, line) => sum + ((line.actual ?? line.estimate) - line.estimate), 0);
    expect(over).toBe(750);
    expect(panel(S6, "clerk", "reconcile_close")).toMatchObject({ enabled: true, primary: true });
    // Issue the $250 deposit refund and close.
    act(S6, { type: "reconcile_close" });
    const closed = get(S6);
    expect(closed.state).toBe("closed");
    expect(closed.closeout).toMatchObject({ balance: 750, refund: 250 });
    expect(closed.payments.at(-1)).toMatchObject({ kind: "refund", amount: -250, method: "in_person" });
    expect(caseTotals(closed)).toEqual({ fees: 9395, deposit: 0, total: 9395, paid: 9395, due: 0 });
    expect(closed.activity.at(-1)?.text).toBe("Closed. Refunded $250 from the deposit.");
    expect(queue("clerk", S6)).toEqual([]);
    // A closed case leaves the Active permits list and its Closeout tab.
    expect(hasActivePermit(closed)).toBe(false);
    expect(active()).not.toContain(S6);
    // ...and no longer holds Main Street: the header stops reading "Date held".
    expect(closed.dateHold).toEqual({ status: "released", placedOn: "2027-02-03", expiresOn: null });

    // As the applicant: the board shows the refund, the feedback form and "Book again next year".
    as("applicant", "main-street-business-alliance");
    expect(board(closed)).toMatchObject({ do_now: ["feedback", "book_again"], with_city: [], coming_up: [] });
    expect(task(closed, "final_bill_or_refund")).toMatchObject({ status: "done", payload: { amount: -250 } });
    expect(up(S6)).toEqual(["applicant"]);
    expect(panel(S6, "applicant", "book_again")).toMatchObject({ label: "Book again next year", enabled: true });
    act(S6, { type: "submit_feedback", rating: 5, comment: "The closure went smoothly." });
    expect(get(S6).closeout.feedback).toEqual({ rating: 5, comment: "The closure went smoothly." });
    expect(board(get(S6)).do_now).toEqual(["book_again"]);
    // Feedback is given once.
    expect(panel(S6, "applicant", "submit_feedback")).toMatchObject({ enabled: false, reason: "Feedback is already in. Thank you." });
    expect(refusal(S6, { type: "submit_feedback", rating: 1 })).toBe("Feedback is already in. Thank you.");

    // "Book again next year" drafts Sat, Apr 22, 2028.
    const [nextYear] = act(S6, { type: "book_again" });
    expect(nextYear).toBe("PMT-27-0143");
    const draft = get(nextYear);
    expect(draft).toMatchObject({
      state: "draft",
      tier: "special",
      clonedFrom: S6,
      applicantId: "main-street-business-alliance",
      name: "Main Street Food Truck Festival",
      attendance: 3000,
      wizardStep: "plan",
      tasks: [],
      payments: [],
      permit: null,
    });
    expect(draft.schedule).toMatchObject({ date: "2028-04-22", start: "12:00", end: "21:00" });
    expect(fmtDate(draft.schedule!.date)).toBe("Sat, Apr 22, 2028");
    expect(draft.schedule!.occurrences).toEqual([{ date: "2028-04-22", availability: { status: "open" }, billing: "upcoming" }]);
    expect(draft.location?.segmentIds).toEqual(MAIN_1ST_TO_4TH);
    expect(estimateFees(draft, classify(draft)).total).toBe(9645);
    expect(dateGate(draft, classify(draft), ctx(), draft.id)).toMatchObject({ ok: true, fixes: [] });
    expect(board(get(S6)).do_now).toEqual([]);
    expect(applicantCases(cases(), store().personaId).map((c) => c.id)).toEqual([S6, nextYear]);
    // Next year's draft is the applicant's alone until it is submitted.
    expect(isVisibleToCity(draft)).toBe(false);
  });
});

describe("Path 7 · Amend up a tier (S1, P1)", () => {
  it("Maya adds a DJ: Reviewed, the gate fires at 19 days of 30, she takes the late fee, the new cards carry the amendment tag and the permit stays", () => {
    const queuesBefore = queueSizes();

    as("applicant", "maya-chen");
    const original = get(S1);
    expect(original).toMatchObject({ tier: "instant", state: "permitted", permit: { issuedOn: "2027-04-26", signature: null } });
    expect(panel(S1, "applicant", "amend")).toMatchObject({ enabled: true });

    // The wizard reopens on the same record with every answer filled in. Maya adds a DJ.
    const withDj: EventAnswers = {
      eventType: original.eventType,
      name: original.name,
      description: original.description,
      location: original.location,
      schedule: original.schedule,
      attendance: original.attendance,
      addOns: { ...original.addOns, amplifiedSound: true },
    };

    // The event becomes Reviewed and the date gate fires: 19 days left, 30 needed.
    const cls = classify(withDj, store().cfg);
    expect(cls).toMatchObject({ tier: "reviewed", leadTimeDays: 30 });
    expect(cls.reviewers.map((r) => r.dept)).toEqual(["pws", "hl"]);
    const gate = dateGate(withDj, cls, ctx(), S1);
    expect(gate).toMatchObject({ ok: false, leadTimeOk: false, daysUntil: 19, availability: { status: "open" }, earliestDate: "2027-06-02", lateFeeAmount: 53.75 });
    // She picks a new date, drops the DJ, or pays the late fee.
    expect(gate.fixes).toEqual(["new_date", "drop_addon", "late_fee"]);
    expect(gate.droppable).toEqual(["amplified_sound"]);

    // Without a fix the amendment does not go in, and the record is as it was.
    expect(refusal(S1, { type: "amend", answers: withDj })).toBe("Needs 30 days of notice; pick a later date or add the late fee.");
    expect(get(S1)).toEqual(original);

    // She chooses the late fee.
    act(S1, { type: "amend", answers: withDj, lateFee: true });
    const amended = get(S1);
    expect(amended).toMatchObject({ tier: "reviewed", addOns: { amplifiedSound: true }, flags: { amendmentPending: true, lateFee: true } });
    expect(amended.triggers.map((t) => t.id)).toEqual(["amplified_sound"]);

    // New cards tagged Amendment appear...
    expect(amended.tasks.map((t) => [t.catalogId, t.status, t.tags])).toEqual([
      ["pay_fees", "done", []],
      ["carry_permit", "locked", []],
      ["insurance_certificate", "todo", ["amendment"]],
      ["sound_details", "todo", ["amendment"]],
      ["submit_application", "locked", ["amendment"]],
      ["accept_and_sign", "locked", ["amendment"]],
    ]);
    expect(board(amended)).toEqual({ do_now: ["insurance_certificate", "sound_details"], with_city: [], coming_up: ["carry_permit", "submit_application", "accept_and_sign"], done: ["pay_fees"] });
    expect(up(S1)).toEqual(["applicant"]);
    // ...with the late fee on the new plan's fees.
    expect(amended.feeLines.map((line) => [line.label, line.estimate, line.kind])).toEqual([
      ["Shelter reservation", 125, "fee"],
      ["Amplified sound", 40, "fee"],
      ["Application fee", 50, "fee"],
      ["Refundable cleanup deposit", 250, "deposit"],
      ["Late fee", 53.75, "late_fee"],
    ]);
    expect(caseTotals(amended)).toEqual({ fees: 268.75, deposit: 250, total: 518.75, paid: 125, due: 393.75 });

    // The current permit stays valid for the original plan.
    expect(amended).toMatchObject({ state: "permitted", ending: null, permit: original.permit, dateHold: original.dateHold, payments: original.payments, schedule: original.schedule, location: original.location });
    expect(hasActivePermit(amended)).toBe(true);
    expect(active()).toContain(S1);
    expect(sessionDates(amended)).toEqual(["2027-05-22"]);
    expect(slot(SHELTER_3, "2027-05-22")).toMatchObject({ status: "booked", reason: "Maya Chen's 40th birthday picnic has this date held" });
    expect(panel(S1, "applicant", "cancel")).toMatchObject({ enabled: true });
    // The amendment has not reached the city yet: no queue has changed.
    expect(queueSizes()).toEqual(queuesBefore);

    // Her first amendment card works like any other card.
    act(S1, { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth, two speakers", soundCheckTime: "10:30" } });
    expect(board(get(S1)).with_city).toEqual(["sound_details"]);
    expect(get(S1).state).toBe("permitted");
  });
});

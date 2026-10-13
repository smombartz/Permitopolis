/**
 * The seed on the demo date, Mon, May 3, 2027.
 *
 * buildSeed() replays 38 scripts through the two real engines. This file holds it to its
 * contracts: the "Seed data" and "Filler cases" tables of docs/spec/prd.md, and section 6.2 of
 * the plan (dates in the histories, the background set, the stress rows, the reserved slots).
 * Where the PRD names a card, a column, a date or an amount, it is asserted as the PRD has it.
 */
import { describe, expect, it } from "vitest";
import { MAIN_1ST_TO_4TH } from "@/lib/data/streets";
import { PERSONAS } from "@/lib/data/people";
import { addDaysISO, dateOf, datesEvery, daysBetween, weekdayOf } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, availability, cancellationRefund, classify, dateGate, estimateFees, routing, type RulesCtx } from "@/lib/rules";
import {
  activePermits,
  applicantCases,
  availableActions,
  boardColumns,
  buildSeed,
  caseTotals,
  daysUntilEvent,
  hasActivePermit,
  involves,
  isSessionDate,
  isStalled,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  nextMove,
  permitSessions,
  queueFor,
  reviewClock,
  sessionDates,
  taskDueDate,
  transition,
  waitingOn,
  whoIsUp,
  type Action,
  type BoardColumn,
  type QueueItem,
} from "@/lib/state";
import { SEED_SCRIPTS } from "@/lib/state/seed";
import { PARTIES, type Actor, type CaseState, type Dept, type Ending, type EventCase, type ISODate, type Location, type Party, type Task } from "@/lib/types";

const TODAY = DEFAULT_DEMO_TODAY;
const seed = buildSeed();
const ctx: RulesCtx = { today: TODAY, now: `${TODAY}T09:00`, cases: seed, cfg: DEFAULT_CONFIG };

/** The seeded case of a script, by its key: 'S3', 'F5', 'B14'. */
function seeded(key: string): EventCase {
  const script = SEED_SCRIPTS.find((s) => s.key === key);
  const found = script && seed.find((c) => c.id === script.id);
  if (!found) throw new Error(`no seeded case for ${key}`);
  return found;
}

const card = (c: EventCase, suffix: string): Task => {
  const found = c.tasks.find((t) => t.id === `${c.id}:${suffix}`);
  if (!found) throw new Error(`${c.id} has no task ${suffix}`);
  return found;
};

/** The applicant's board as card ids per column, e.g. { do_now: ['neighbor_signoff'], ... }. */
function board(c: EventCase): Record<BoardColumn, string[]> {
  const columns = boardColumns(c);
  const suffix = (t: Task) => t.id.slice(c.id.length + 1);
  return { do_now: columns.do_now.map(suffix), with_city: columns.with_city.map(suffix), coming_up: columns.coming_up.map(suffix), done: columns.done.map(suffix) };
}

const standing = (c: EventCase) => Object.fromEntries(waitingOn(c, TODAY).map((p) => [p.party, p.status])) as Record<Party, string>;
const row = (c: EventCase, party: Party) => waitingOn(c, TODAY).find((p) => p.party === party)!;
const feeLines = (c: EventCase) => c.feeLines.map((line) => [line.label, line.estimate]);
const queued = (role: Dept, c: EventCase): QueueItem[] => queueFor(seed, role, TODAY).filter((item) => item.case.id === c.id);
const queuedTasks = (role: Dept, c: EventCase) => queued(role, c).map((item) => item.task.catalogId);
const activityOn = (c: EventCase, text: string) => c.activity.find((a) => a.text === text)?.at.slice(0, 10);

/** Why the engine would refuse this action on the seed, or null when it would go through. */
function reasonFor(c: EventCase, action: Action, actor: Actor): string | null {
  const result = transition(c, action, actor, ctx);
  return result.ok ? null : result.reason;
}

function run(c: EventCase, action: Action, actor: Actor): EventCase {
  const result = transition(c, action, actor, ctx);
  if (!result.ok) throw new Error(`${action.type} was refused: ${result.reason}`);
  return result.case;
}

/** Is this place free at any hour of that day, for a case that is not in the seed yet? */
const wholeDay = (location: Location, date: ISODate, ignoreCaseId?: string) => availability(location, { date, start: "00:00", end: "23:59" }, ctx, ignoreCaseId);
const space = (id: string): Location => ({ mode: "inventory", inventoryIds: [id], segmentIds: [], label: id });
const streets = (segmentIds: string[]): Location => ({ mode: "streets", inventoryIds: [], segmentIds, label: segmentIds.join(", ") });

describe("buildSeed()", () => {
  it("returns all 38 cases, one per script, in case-id order", () => {
    expect(seed).toHaveLength(38);
    expect(seed.map((c) => c.id)).toEqual(SEED_SCRIPTS.map((s) => s.id).sort());
  });

  it("every script reaches the tier, state and ending it expects", () => {
    for (const script of SEED_SCRIPTS) {
      const c = seeded(script.key);
      expect([script.key, c.tier, c.state, c.ending]).toEqual([script.key, script.expect.tier, script.expect.state, script.expect.ending ?? null]);
    }
  });

  it("is deterministic: two calls are deeply equal", () => {
    expect(buildSeed()).toEqual(seed);
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(seed));
  });

  it("hands out a copy each time, so nothing done to one seed reaches the next", () => {
    const first = buildSeed();
    const untouched = structuredClone(first);
    first[0].name = "Changed";
    first[0].tasks.push(card(seeded("S1"), "pay_fees"));
    first.pop();
    const second = buildSeed();
    expect(second).toEqual(untouched);
    expect(second[0]).not.toBe(first[0]);
  });

  it("is cheap to call again: the replay runs once", () => {
    const started = performance.now();
    for (let i = 0; i < 20; i++) buildSeed();
    // Twenty copies of 38 cases. A replay each time would take many times longer.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("gives every case an applicant from the people list, and S2's draft the last id", () => {
    for (const c of seed) expect(PERSONAS.some((p) => p.id === c.applicantId), c.id).toBe(true);
    expect(seeded("S3").id).toBe("PMT-27-0118");
    expect(seeded("S5").id).toBe("PMT-27-0097");
    expect(seeded("S2").id).toBe("PMT-27-0142");
    expect(nextCaseId(seed)).toBe("PMT-27-0143");
  });

  it("writes no session list by hand: every schedule's sessions are the dates its recurrence gives", () => {
    for (const c of seed) {
      if (!c.schedule) continue;
      const expected = c.schedule.recurrence ? datesEvery(c.schedule.date, c.schedule.recurrence.until, c.schedule.recurrence.frequency === "weekly" ? 7 : 14) : [c.schedule.date];
      expect(c.schedule.occurrences.map((o) => o.date), c.id).toEqual(expected);
      // A session on a blackout date is skipped, and only such a session is.
      for (const o of c.schedule.occurrences) expect(o.billing === "skipped", `${c.id} ${o.date}`).toBe(o.availability.status === "blackout");
    }
  });

  it("keeps every history inside the past: nothing is dated after the demo date, and each log runs forward in time", () => {
    for (const c of seed) {
      const times = c.activity.map((a) => a.at);
      expect(times.every((at) => dateOf(at) <= TODAY), c.id).toBe(true);
      expect([...times].sort(), c.id).toEqual(times);
      expect(c.activity[0], c.id).toEqual({ at: c.createdAt, actor: "applicant", text: "Started a draft." });
    }
  });

  it("gives every task an id of its own case, used once", () => {
    for (const c of seed) {
      const ids = c.tasks.map((t) => t.id);
      expect(new Set(ids).size, c.id).toBe(ids.length);
      expect(ids.every((id) => id.startsWith(`${c.id}:`)), c.id).toBe(true);
    }
  });

  it("keeps money to the cent on every case", () => {
    const cents = (n: number) => Math.round(n * 100) / 100 === n;
    for (const c of seed) {
      for (const line of c.feeLines) expect(cents(line.estimate) && (line.actual === null || cents(line.actual)), `${c.id} ${line.label}`).toBe(true);
      for (const payment of c.payments) expect(cents(payment.amount), `${c.id} ${payment.id}`).toBe(true);
      const totals = caseTotals(c);
      expect(Object.values(totals).every(cents), c.id).toBe(true);
    }
  });
});

describe("the demo date", () => {
  it("no case before Permitted is stalled: somebody is always up", () => {
    const stalled = seed.filter((c) => isStalled(c, TODAY)).map((c) => c.id);
    expect(stalled).toEqual([]);
    for (const c of seed) {
      const beforePermitted = c.ending === null && ["draft", "submitted", "in_review", "needs_info", "quote_sent"].includes(c.state);
      if (beforePermitted) expect(whoIsUp(c, TODAY).length, c.id).toBeGreaterThan(0);
    }
  });

  it("exactly one case is on Event day on May 3: the Monday tai chi series", () => {
    const today = seed.filter((c) => c.state === "event_day");
    expect(today.map((c) => c.name)).toEqual(["Riverside Tai Chi Circle morning practice"]);
    expect(weekdayOf(TODAY)).toBe(1);
    expect(isSessionDate(today[0], TODAY)).toBe(true);
    expect(permitSessions(seed, { from: TODAY, to: TODAY }).map((s) => s.case.id)).toEqual([today[0].id]);
  });

  it("a card with the city always has someone tasked with it", () => {
    for (const c of seed) {
      if (c.ending !== null || c.reviews.length === 0) continue;
      for (const t of c.tasks) {
        if (t.owner !== "applicant" || t.status !== "submitted" || !t.reviewer) continue;
        const suffix = t.id.slice(c.id.length + 1);
        const holder = c.tasks.find((city) => city.owner === t.reviewer && city.status !== "done" && (city.catalogId === `review:${t.reviewer}` || city.catalogId === `verify:${suffix}`));
        expect(holder, `${c.id} ${suffix}`).toBeDefined();
      }
    }
  });

  it("a case that holds a permit has no pre-permit work left open, and one past its day has none from before the day", () => {
    const open = (t: Task) => t.status === "todo" || t.status === "changes_requested" || t.status === "submitted";
    const leftOpen: string[] = [];
    for (const c of seed) {
      if (c.ending !== null || !c.permit) continue;
      const pastItsDay = c.state === "closeout" || c.state === "closed";
      for (const t of c.tasks.filter(open)) {
        const prePermit = t.phase === "before_submitting" || t.phase === "review" || t.phase === "permit";
        const beforeTheDay = t.phase === "before_event" || t.phase === "event_day";
        if (prePermit || (pastItsDay && beforeTheDay)) leftOpen.push(`${c.id} ${t.catalogId}`);
      }
    }
    expect(leftOpen).toEqual([]);
  });
});

describe("PRD seed table: the six scenarios", () => {
  describe("S1 · Maya Chen's 40th birthday picnic", () => {
    const s1 = seeded("S1");

    it("Instant, Permitted: Shelter 3 on Sat, May 22, 11 am to 4 pm, 45 guests", () => {
      expect(s1).toMatchObject({ name: "Maya Chen's 40th birthday picnic", applicantId: "maya-chen", tier: "instant", state: "permitted", ending: null, attendance: 45 });
      expect(s1.location?.inventoryIds).toEqual(["shelter-3"]);
      expect(s1.schedule).toMatchObject({ date: "2027-05-22", start: "11:00", end: "16:00" });
      expect(fmtDate(s1.schedule!.date)).toBe("Sat, May 22, 2027");
      expect(s1.permit).toEqual({ issuedOn: "2027-04-26", signature: null });
    });

    it("nobody is up; the permit is active", () => {
      expect(whoIsUp(s1, TODAY)).toEqual([]);
      expect(hasActivePermit(s1)).toBe(true);
      expect(activePermits(seed, TODAY).map((c) => c.id)).toContain(s1.id);
    });

    it("board: Pay and book, $125, is Done; Carry your permit is Coming up", () => {
      expect(board(s1)).toEqual({ do_now: [], with_city: [], coming_up: ["carry_permit"], done: ["pay_fees"] });
      expect(card(s1, "pay_fees")).toMatchObject({ title: "Pay and book", payload: { amount: 125 } });
      expect(caseTotals(s1)).toEqual({ fees: 125, deposit: 0, total: 125, paid: 125, due: 0 });
    });

    it("the permit page shows a $62.50 refund if cancelled today", () => {
      expect(daysUntilEvent(s1, TODAY)).toBe(19);
      expect(cancellationRefund(s1, TODAY).refund).toBe(62.5);
    });

    it("city side: on the active permits list and calendar, with no tasks", () => {
      expect(s1.tasks.filter((t) => t.owner !== "applicant")).toEqual([]);
      for (const role of ["clerk", "pws", "hl"] as const) expect(queued(role, s1)).toEqual([]);
      expect(permitSessions(seed).filter((s) => s.case.id === s1.id).map((s) => s.date)).toEqual(["2027-05-22"]);
    });
  });

  describe("S2 · Sunrise Yoga Club weekly class", () => {
    const s2 = seeded("S2");
    const estimate = estimateFees(s2, classify(s2));

    it("Instant, a 13-session series, Draft: Field 4, Sundays Jun 6 to Aug 29, 8 to 9 am, 20 people", () => {
      expect(s2).toMatchObject({ applicantId: "sunrise-yoga-club", tier: "instant", state: "draft", attendance: 20 });
      expect(s2.location?.inventoryIds).toEqual(["field-4"]);
      expect(s2.schedule).toMatchObject({ date: "2027-06-06", start: "08:00", end: "09:00", recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" } });
      expect(s2.schedule!.occurrences).toHaveLength(13);
      expect(s2.schedule!.occurrences.every((o) => weekdayOf(o.date) === 0)).toBe(true);
    });

    it("the applicant is up, in the wizard at step 3", () => {
      expect(whoIsUp(s2, TODAY)).toEqual(["applicant"]);
      expect(s2.wizardStep).toBe("when");
      expect(s2.tasks).toEqual([]);
    });

    it("panel: Instant, $20 a session, $260 in all", () => {
      expect(classify(s2)).toMatchObject({ tier: "instant", leadTimeDays: 10, reviewers: [] });
      expect(estimate).toMatchObject({ perSession: 20, sessions: 13, total: 260, dueNow: 20 });
    });

    it("the Jul 11 session carries an Impacted warning, and no session is blocked", () => {
      const impacted = s2.schedule!.occurrences.filter((o) => o.availability.status !== "open");
      expect(impacted).toEqual([{ date: "2027-07-11", billing: "upcoming", availability: { status: "impacted", reason: "Riverfront Summer 5K closes Main Street 6 to 11:30 am that day" } }]);
    });

    it("city side: not visible until paid", () => {
      expect(isVisibleToCity(s2)).toBe(false);
      for (const role of ["clerk", "pws", "hl"] as const) expect(involves(s2, role)).toBe(false);
      expect(activePermits(seed, TODAY, { includeHolds: true }).map((c) => c.id)).not.toContain(s2.id);
    });
  });

  describe("S3 · Jazz in the Plaza", () => {
    const s3 = seeded("S3");

    it("Reviewed, Needs info: City Hall Plaza, Fri, Jun 18, 6 to 9 pm, 150 people, sound, one food truck", () => {
      expect(s3).toMatchObject({ applicantId: "downtown-arts-collective", tier: "reviewed", state: "needs_info", attendance: 150 });
      expect(s3.location).toMatchObject({ mode: "area", areaId: "city-hall-plaza" });
      expect(s3.schedule).toMatchObject({ date: "2027-06-18", start: "18:00", end: "21:00" });
      expect(fmtDate(s3.schedule!.date)).toBe("Fri, Jun 18, 2027");
      expect(s3.addOns).toMatchObject({ amplifiedSound: true, foodVending: { vendors: 1, vendorNames: ["Rolling Dumpling Co."] } });
    });

    it("the applicant is up: upload the food truck's health permit, due Wed, May 5", () => {
      expect(whoIsUp(s3, TODAY)).toEqual(["applicant"]);
      const applicant = row(s3, "applicant");
      expect(applicant.openTasks.map((t) => t.title)).toEqual(["Health permit: Rolling Dumpling Co."]);
      expect(applicant.oldestDue).toBe("2027-05-05");
      expect(fmtDate(applicant.oldestDue!)).toBe("Wed, May 5, 2027");
      expect(nextMove(s3, TODAY, "Downtown Arts Collective")).toBe(
        "Next: Downtown Arts Collective uploads the health permit: Rolling Dumpling Co., then Health & Legal re-reviews.",
      );
    });

    it("board: exactly 1 card in Do now, 0 with the city, 3 coming up and 4 done", () => {
      expect(board(s3)).toEqual({
        do_now: ["vendor_health_permit:1"],
        with_city: [],
        coming_up: ["accept_and_sign", "pay_fees", "carry_permit"],
        done: ["insurance_certificate", "sound_details", "vendor_list", "submit_application"],
      });
    });

    it("the pinned card is Health & Legal's request, on the health permit card itself", () => {
      const pinned = card(s3, "vendor_health_permit:1");
      expect(pinned.request).toEqual({
        from: "hl",
        message: "Please upload Rolling Dumpling Co.'s current health permit",
        at: "2027-04-30T09:05",
        dueDate: "2027-05-05",
        resolved: false,
      });
      expect(taskDueDate(pinned)).toBe("2027-05-05");
      expect(s3.tasks.some((t) => t.catalogId === "respond_to_request")).toBe(false);
    });

    it("the quote will be $715: application $50, plaza $300, sound $40, one vendor $75, deposit $250", () => {
      expect(feeLines(s3)).toEqual([
        ["City Hall Plaza reservation", 300],
        ["Amplified sound", 40],
        ["Application fee", 50],
        ["Food or vendor permit", 75],
        ["Refundable cleanup deposit", 250],
      ]);
      expect(caseTotals(s3)).toMatchObject({ total: 715, paid: 0 });
      expect(card(s3, "pay_fees").payload.amount).toBe(715);
    });

    it("history: submitted Apr 16, held since Apr 19, insurance verified Apr 21, vendor list accepted Apr 30", () => {
      expect(dateOf(s3.submittedAt!)).toBe("2027-04-16");
      expect(s3.dateHold).toEqual({ status: "held", placedOn: "2027-04-19", expiresOn: null });
      expect(card(s3, "insurance_certificate").history.at(-1)).toMatchObject({ at: "2027-04-21T11:00", actor: "hl", status: "done" });
      expect(card(s3, "vendor_list").history.at(-1)).toMatchObject({ at: "2027-04-30T09:00", actor: "hl", status: "done" });
    });

    it("Public Works & Safety approved with three conditions on Wed, Apr 28", () => {
      expect(s3.reviews.find((r) => r.dept === "pws")).toMatchObject({ status: "approved_with_conditions", decidedOn: "2027-04-28" });
      expect(fmtDate("2027-04-28")).toBe("Wed, Apr 28, 2027");
      expect(s3.conditions.map((cond) => [cond.dept, cond.text])).toEqual([
        ["pws", "Sound ends at 9 pm"],
        ["pws", "Speakers face away from the residences on Elm Street"],
        ["pws", "No more than 85 dB at 50 feet"],
      ]);
      expect(row(s3, "pws")).toMatchObject({ status: "done_for_now", note: "Approved with conditions" });
    });

    it("Health & Legal asked on Apr 30 and its review clock is paused since then", () => {
      const review = s3.reviews.find((r) => r.dept === "hl")!;
      expect(review).toMatchObject({ status: "needs_info", clock: { startedOn: "2027-04-19", pausedSince: "2027-04-30", pausedDays: 0, allowedDays: 14 } });
      expect(reviewClock(s3, "hl", TODAY)).toEqual({ day: 11, of: 14, pausedDays: 3, paused: true, label: "Day 11 of 14 · paused 3 days" });
      expect(row(s3, "hl")).toMatchObject({ status: "waiting", note: "Waiting on the applicant's response", openTasks: [] });
      expect(queued("hl", s3)).toEqual([]);
      expect(standing(s3).clerk).toBe("done_for_now");
    });
  });

  describe("S4 · Maple Street block party", () => {
    const s4 = seeded("S4");

    it("Reviewed by the block-party exception, Submitted: 400 block of Maple Street, Sat, Jun 26, 2 to 8 pm, 120 neighbors, 4 barricades", () => {
      expect(s4).toMatchObject({ applicantId: "maple-street-block-captain", tier: "reviewed", state: "submitted", attendance: 120 });
      expect(classify(s4)).toMatchObject({ tier: "reviewed", blockPartyException: true, leadTimeDays: 30 });
      expect(s4.location?.segmentIds).toEqual(["maple-400"]);
      expect(s4.schedule).toMatchObject({ date: "2027-06-26", start: "14:00", end: "20:00" });
      expect(fmtDate(s4.schedule!.date)).toBe("Sat, Jun 26, 2027");
      expect(s4.addOns.cityServices?.barricades).toBe(4);
    });

    it("the applicant is up: 3 of 12 neighbor sign-offs to go", () => {
      expect(whoIsUp(s4, TODAY)).toEqual(["applicant"]);
      expect(card(s4, "neighbor_signoff").payload.progress).toEqual({ done: 9, total: 12 });
      expect(row(s4, "applicant").note).toBe("Up: Neighbor sign-off");
    });

    it("board: Do now is the neighbor sign-off, 9 of 12; insurance and the city services request are with the city; accept and sign and pay $510 are coming up", () => {
      expect(board(s4)).toEqual({
        do_now: ["neighbor_signoff"],
        with_city: ["insurance_certificate", "city_services_request"],
        coming_up: ["accept_and_sign", "pay_fees", "carry_permit"],
        done: ["submit_application"],
      });
      expect(card(s4, "pay_fees").payload.amount).toBe(510);
    });

    it("$510: application $50, one block closed $150, 4 barricades $60, deposit $250", () => {
      expect(feeLines(s4)).toEqual([
        ["Street closure", 150],
        ["Application fee", 50],
        ["Barricades", 60],
        ["Refundable cleanup deposit", 250],
      ]);
      expect(caseTotals(s4).total).toBe(510);
    });

    it("no date hold yet", () => {
      expect(s4.dateHold).toEqual({ status: "none", placedOn: null, expiresOn: null });
      expect(s4.flags.acceptedComplete).toBe(false);
    });

    it("the Clerk reads waiting on 3 sign-offs: one blocker, Accept disabled, and nothing in its queue", () => {
      expect(row(s4, "clerk")).toMatchObject({ status: "waiting", note: "Waiting on 3 neighbor sign-offs", openTasks: [] });
      expect(queued("clerk", s4)).toEqual([]);
      const accept = availableActions(s4, "clerk", ctx).find((a) => a.type === "accept_complete");
      expect(accept).toMatchObject({ enabled: false, reason: "Waiting on 3 neighbor sign-offs" });
      expect(reasonFor(s4, { type: "accept_complete" }, "clerk")).toBe("Waiting on 3 neighbor sign-offs");
    });

    it("routing pre-suggests Public Works & Safety (closure, barricades) and Health & Legal (insurance), neither started", () => {
      expect(routing(s4, classify(s4)).map((r) => [r.dept, r.reasons])).toEqual([
        ["pws", ["Block party", "City services"]],
        ["hl", ["Insurance verification"]],
      ]);
      for (const dept of ["pws", "hl"] as const) expect(row(s4, dept)).toMatchObject({ status: "waiting", note: "Starts when the City Clerk routes the case" });
    });
  });

  describe("S5 · Riverfront Summer 5K", () => {
    const s5 = seeded("S5");

    it("Special event, Quote sent: the 3.1-mile loop, Sun, Jul 11, 7 to 11 am, 1,200 runners, sound at the finish", () => {
      expect(s5).toMatchObject({ applicantId: "riverfront-running-club", tier: "special", state: "quote_sent", attendance: 1200 });
      expect(s5.location).toMatchObject({ mode: "route", miles: 3.1 });
      expect(s5.schedule).toMatchObject({ date: "2027-07-11", start: "07:00", end: "11:00" });
      expect(fmtDate(s5.schedule!.date)).toBe("Sun, Jul 11, 2027");
    });

    it("two parties are up at once: the applicant and Health & Legal", () => {
      expect(whoIsUp(s5, TODAY)).toEqual(["applicant", "hl"]);
      expect(standing(s5)).toEqual({ applicant: "up_now", clerk: "waiting", pws: "done_for_now", hl: "up_now" });
      expect(nextMove(s5, TODAY, "Riverfront Running Club")).toBe(
        "Next: Riverfront Running Club accepts the conditions and signs, and Health & Legal verifies the certificate of insurance, then City Clerk issues the permit.",
      );
    });

    it("the applicant accepts, signs and pays $6,530 by Fri, May 14", () => {
      expect(s5.dateHold).toEqual({ status: "held", placedOn: "2027-03-10", expiresOn: "2027-05-14" });
      expect(fmtDate(s5.dateHold.expiresOn!)).toBe("Fri, May 14, 2027");
      expect(card(s5, "accept_and_sign")).toMatchObject({ status: "todo", dueDate: "2027-05-14" });
      expect(card(s5, "pay_fees")).toMatchObject({ status: "todo", dueDate: "2027-05-14", payload: { amount: 6530 } });
      expect(activityOn(s5, "Sent the quote.")).toBe("2027-04-30");
    });

    it("$6,530: application $250, route 3.1 miles $1,240, sound $40, police 8 officers for 5 hours $3,400, 40 barricades $600, deposit $1,000", () => {
      expect(feeLines(s5)).toEqual([
        ["Route closure", 1240],
        ["Amplified sound", 40],
        ["Application fee", 250],
        ["Police", 3400],
        ["Barricades", 600],
        ["Refundable cleanup deposit", 1000],
      ]);
      expect(caseTotals(s5)).toEqual({ fees: 5530, deposit: 1000, total: 6530, paid: 0, due: 6530 });
    });

    it("Health & Legal verifies the race-day insurance certificate uploaded Apr 30, due Fri, May 7", () => {
      const insurance = card(s5, "insurance_certificate");
      expect(insurance).toMatchObject({ status: "submitted", payload: { files: [{ name: "race-day-insurance-certificate.pdf" }] } });
      expect(insurance.history.at(-1)).toMatchObject({ at: "2027-04-30T09:10", actor: "applicant", status: "submitted" });
      expect(queued("hl", s5).map((item) => [item.task.catalogId, item.task.title, item.task.dueDate, item.group])).toEqual([
        ["verify:insurance_certificate", "Verify Certificate of insurance", "2027-05-07", "this_week"],
      ]);
      expect(fmtDate("2027-05-07")).toBe("Fri, May 7, 2027");
    });

    it("board: sign and pay in Do now; the certificate with the city; every plan, the pre-application meeting and the community notice done", () => {
      expect(board(s5)).toEqual({
        do_now: ["accept_and_sign", "pay_fees"],
        with_city: ["insurance_certificate"],
        coming_up: ["coordination_meeting", "site_walkthrough", "carry_permit"],
        done: [
          "sound_details",
          "city_services_request",
          "site_plan",
          "traffic_control_plan",
          "security_medical_plan",
          "emergency_plan",
          "accessibility_plan",
          "cleanup_plan",
          "submit_application",
          "pre_application_meeting",
          "community_notification",
        ],
      });
    });

    it("coming up: the coordination meeting on Mon, Jun 21 and the walkthrough on Fri, Jul 2, as the Clerk set them", () => {
      expect(card(s5, "coordination_meeting")).toMatchObject({ status: "locked", payload: { scheduledFor: "2027-06-21" } });
      expect(card(s5, "site_walkthrough")).toMatchObject({ status: "locked", payload: { scheduledFor: "2027-07-02" } });
      expect(fmtDate("2027-06-21")).toBe("Mon, Jun 21, 2027");
      expect(fmtDate("2027-07-02")).toBe("Fri, Jul 2, 2027");
    });

    it("Clerk: Issue permit is disabled until paid and verified, and says so", () => {
      expect(card(s5, "issue_permit")).toMatchObject({ owner: "clerk", status: "locked" });
      expect(queued("clerk", s5)).toEqual([]);
      const issue = availableActions(s5, "clerk", ctx).find((a) => a.type === "issue_permit");
      expect(issue).toMatchObject({ enabled: false, reason: "Needs: signature (applicant), payment (applicant), insurance (Health & Legal)" });
      expect(row(s5, "clerk").note).toBe("Unlocks when paid and verified");
    });

    it("Public Works & Safety approved with four conditions; Health & Legal approved accessibility", () => {
      expect(s5.reviews.map((r) => [r.dept, r.status])).toEqual([
        ["pws", "approved_with_conditions"],
        ["hl", "approved"],
      ]);
      expect(s5.conditions.map((cond) => cond.text)).toEqual(["Route closed 6 to 11:30 am", "8 officers on the route", "40 barricades", "Finish-line sound off by 11 am"]);
      expect(s5.conditions.every((cond) => cond.dept === "pws" && cond.mergedByClerk)).toBe(true);
      expect(card(s5, "accessibility_plan").status).toBe("done");
    });
  });

  describe("S6 · Main Street Food Truck Festival", () => {
    const s6 = seeded("S6");

    it("Special event, Closeout, 9 days after: Main Street, 1st to 4th Avenue, Sat, Apr 24, noon to 9 pm, 3,000 people, 25 food trucks, beer garden, stage", () => {
      expect(s6).toMatchObject({ applicantId: "main-street-business-alliance", tier: "special", state: "closeout", attendance: 3000 });
      expect(s6.location?.segmentIds).toEqual(MAIN_1ST_TO_4TH);
      expect(s6.schedule).toMatchObject({ date: "2027-04-24", start: "12:00", end: "21:00" });
      expect(fmtDate(s6.schedule!.date)).toBe("Sat, Apr 24, 2027");
      expect(daysBetween(s6.schedule!.date, TODAY)).toBe(9);
      expect(s6.addOns).toMatchObject({ alcohol: true, foodVending: { vendors: 25 }, tentsStages: { count: 1 } });
      expect(activityOn(s6, "The event moved to Closeout.")).toBe("2027-04-25");
    });

    it("Public Works & Safety is up: the cleanup check and actual hours, due Fri, May 7. Then the Clerk reconciles", () => {
      expect(whoIsUp(s6, TODAY)).toEqual(["pws"]);
      expect(queued("pws", s6).map((item) => [item.task.catalogId, item.task.dueDate, item.group])).toEqual([
        ["cleanup_inspection", "2027-05-07", "this_week"],
        ["log_actual_hours", "2027-05-07", "this_week"],
      ]);
      expect(nextMove(s6, TODAY)).toBe("Next: Public Works & Safety inspects the cleanup, then City Clerk reconciles the costs and closes.");
    });

    it("the Clerk's reconciliation is locked until hours are logged", () => {
      expect(card(s6, "reconcile")).toMatchObject({ owner: "clerk", status: "locked", unlocksOn: "hours_logged" });
      expect(row(s6, "clerk")).toMatchObject({ status: "waiting", note: "Unlocks when hours are logged" });
      expect(queued("clerk", s6)).toEqual([]);
      expect(reasonFor(s6, { type: "reconcile_close" }, "clerk")).toBe("Waiting on Public Works & Safety to log hours.");
    });

    it("board: the final bill or refund and feedback are coming up; everything else is done", () => {
      const columns = board(s6);
      expect(columns.do_now).toEqual([]);
      expect(columns.with_city).toEqual([]);
      expect(columns.coming_up).toEqual(["final_bill_or_refund", "feedback", "book_again"]);
      expect(columns.done).toHaveLength(s6.tasks.filter((t) => t.owner === "applicant").length - 3);
      expect(columns.done.filter((id) => id.startsWith("vendor_health_permit:"))).toHaveLength(25);
      for (const id of ["pre_application_meeting", "community_notification", "coordination_meeting", "site_walkthrough", "vendor_food_permits", "carry_permit", "pay_fees"]) {
        expect(columns.done, id).toContain(id);
      }
    });

    it("$9,645 paid: application $250, 3 blocks $450, alcohol $100, 25 vendors $1,875, stage $60, police 66 officer-hours $5,610, 20 barricades $300, deposit $1,000", () => {
      expect(feeLines(s6)).toEqual([
        ["Street closure", 450],
        ["Temporary alcohol license", 100],
        ["Application fee", 250],
        ["Food or vendor permit", 1875],
        ["Structure fire inspection", 60],
        ["Police", 5610],
        ["Barricades", 300],
        ["Refundable cleanup deposit", 1000],
      ]);
      expect(s6.feeLines.find((line) => line.label === "Police")).toMatchObject({ qty: 66, unit: "officer-hour", unitPrice: 85 });
      expect(caseTotals(s6)).toEqual({ fees: 8645, deposit: 1000, total: 9645, paid: 9645, due: 0 });
      expect(s6.payments).toMatchObject([{ kind: "quote", amount: 9645, at: "2027-03-13T09:05" }]);
    });

    it("every work order was done before the day, and all three departments approved", () => {
      const workOrders = s6.tasks.filter((t) => t.catalogId.startsWith("work_order:"));
      expect(workOrders.map((t) => t.status)).toEqual(["done", "done", "done", "done", "done"]);
      expect(s6.reviews.map((r) => [r.dept, r.status])).toEqual([
        ["pws", "approved"],
        ["hl", "approved"],
        ["clerk", "approved"],
      ]);
    });
  });
});

describe("each city role opens to work", () => {
  const titles = (role: Dept) => queueFor(seed, role, TODAY).map((item) => `${item.case.name}: ${item.task.title}`);

  it("City Clerk: the Downtown Art Walk intake, the Plaza wedding photos and the Company picnic exception", () => {
    expect(queuedTasks("clerk", seeded("F1"))).toEqual(["intake_check"]);
    expect(queuedTasks("clerk", seeded("F5"))).toEqual(["intake_check"]);
    expect(queuedTasks("clerk", seeded("F7"))).toEqual(["instant_exception"]);
    expect(titles("clerk")).toEqual(
      expect.arrayContaining([
        "Downtown Art Walk: Check the application is complete",
        "Plaza wedding photos: Check the application is complete",
        "Brightline Logistics company picnic: Resolve the exception",
      ]),
    );
  });

  it("the six scenarios alone give the Clerk nothing: S4 waits on neighbors and S6 on Public Works & Safety", () => {
    for (const key of ["S1", "S2", "S3", "S4", "S5", "S6"]) expect(queued("clerk", seeded(key)), key).toEqual([]);
  });

  it("Public Works & Safety: the S6 closeout tasks and the Farmers Market review", () => {
    expect(queuedTasks("pws", seeded("S6"))).toEqual(["cleanup_inspection", "log_actual_hours"]);
    expect(queuedTasks("pws", seeded("F2"))).toEqual(["review:pws"]);
    expect(seeded("F2").reviews.find((r) => r.dept === "pws")).toMatchObject({ status: "pending", sections: ["Structure specs and layout"] });
  });

  it("Health & Legal: the S5 insurance verification, the Movie Night insurance and the Farmers Market", () => {
    expect(queuedTasks("hl", seeded("S5"))).toEqual(["verify:insurance_certificate"]);
    const movieNight = seeded("F3");
    expect(queuedTasks("hl", movieNight)).toEqual(["review:hl"]);
    expect(movieNight.reviews.find((r) => r.dept === "hl")).toMatchObject({ status: "pending", sections: ["Certificate of insurance"] });
    expect(card(movieNight, "insurance_certificate").status).toBe("submitted");
    expect(queuedTasks("hl", seeded("F2"))).toEqual(["review:hl"]);
  });

  it("every queue is in due-date order, and every queued task belongs to its role on an open case", () => {
    for (const role of ["clerk", "pws", "hl"] as const) {
      const items = queueFor(seed, role, TODAY);
      expect(items.length, role).toBeGreaterThan(2);
      const due = items.map((item) => taskDueDate(item.task) ?? "9999-12-31");
      expect([...due].sort(), role).toEqual(due);
      for (const item of items) {
        expect(item.task.owner).toBe(role);
        expect(item.case.ending).toBeNull();
        expect(involves(item.case, role)).toBe(true);
      }
    }
  });

  it("each scenario persona opens to its own case", () => {
    const scenarioOf: Record<string, string> = {
      "maya-chen": "S1",
      "sunrise-yoga-club": "S2",
      "downtown-arts-collective": "S3",
      "maple-street-block-captain": "S4",
      "riverfront-running-club": "S5",
      "main-street-business-alliance": "S6",
    };
    for (const [personaId, key] of Object.entries(scenarioOf)) {
      expect(PERSONAS.find((p) => p.id === personaId)?.scenario).toBe(key);
      expect(applicantCases(seed, personaId).map((c) => c.id), personaId).toEqual([seeded(key).id]);
    }
    expect(applicantCases(seed, "new")).toEqual([]);
  });
});

describe("PRD filler cases", () => {
  it("Downtown Art Walk: Main Street, 2nd to 5th Avenue, Fri, Jul 23. Special, Submitted and complete, for the Clerk to accept, route and schedule the consultation", () => {
    const f1 = seeded("F1");
    expect(f1).toMatchObject({ name: "Downtown Art Walk", tier: "special", state: "submitted" });
    expect(f1.location?.segmentIds).toEqual(["main-2-3", "main-3-4", "main-4-5"]);
    expect(fmtDate(f1.schedule!.date)).toBe("Fri, Jul 23, 2027");
    // Complete: every card that had to be in is in, and nothing stands in the way of accepting.
    expect(board(f1).do_now).toEqual([]);
    expect(board(f1).with_city).toEqual(["insurance_certificate", "site_plan", "traffic_control_plan", "security_medical_plan", "emergency_plan", "accessibility_plan", "cleanup_plan"]);
    expect(availableActions(f1, "clerk", ctx).find((a) => a.type === "accept_complete")).toMatchObject({ enabled: true, primary: true });

    const accepted = run(f1, { type: "accept_complete" }, "clerk");
    expect(accepted.dateHold).toMatchObject({ status: "held", placedOn: TODAY });
    expect(accepted.tasks.filter((t) => t.owner === "clerk" && t.status === "todo").map((t) => t.catalogId)).toEqual(["confirm_routing", "schedule_pre_application_meeting"]);
    expect(routing(f1, classify(f1)).map((r) => r.dept)).toEqual(["pws", "hl"]);
  });

  it("Riverside Farmers Market: Great Lawn, Saturdays Jun 5 to Sep 25. A Reviewed series, In review: tents for Public Works & Safety, the vendor list for Health & Legal", () => {
    const f2 = seeded("F2");
    expect(f2).toMatchObject({ name: "Riverside Farmers Market", tier: "reviewed", state: "in_review" });
    expect(f2.location?.areaId).toBe("great-lawn");
    expect(f2.schedule).toMatchObject({ date: "2027-06-05", recurrence: { frequency: "weekly", weekday: 6, until: "2027-09-25" } });
    expect(sessionDates(f2)).toHaveLength(17);
    expect(sessionDates(f2).every((d) => weekdayOf(d) === 6)).toBe(true);
    expect(f2.reviews.map((r) => [r.dept, r.status, r.sections])).toEqual([
      ["pws", "pending", ["Structure specs and layout"]],
      ["hl", "pending", ["Certificate of insurance", "Vendor list"]],
    ]);
    expect(f2.addOns.tentsStages).toEqual({ count: 12 });
    expect(card(f2, "vendor_list").status).toBe("submitted");
  });

  it("Movie Night on the Lawn: Great Lawn, Sat, Jun 12. Reviewed, In review, with Health & Legal to verify insurance", () => {
    const f3 = seeded("F3");
    expect(f3).toMatchObject({ name: "Movie Night on the Lawn", tier: "reviewed", state: "in_review" });
    expect(f3.location?.areaId).toBe("great-lawn");
    expect(fmtDate(f3.schedule!.date)).toBe("Sat, Jun 12, 2027");
    expect(whoIsUp(f3, TODAY)).toEqual(["hl"]);
    expect(f3.reviews.map((r) => [r.dept, r.status])).toEqual([
      ["pws", "approved"],
      ["hl", "pending"],
    ]);
  });

  it("the market and Movie Night both hold the Great Lawn on Jun 12, at hours that do not overlap (plan 3.3)", () => {
    const [market, movie] = [seeded("F2"), seeded("F3")];
    expect(market.dateHold.status).toBe("held");
    expect(movie.dateHold.status).toBe("held");
    expect(sessionDates(market)).toContain("2027-06-12");
    // The market runs 8 am to 1 pm; Movie Night sets up from 5 pm and runs 7 to 10:30 pm.
    expect(availability(market.location!, { date: "2027-06-12", start: "08:00", end: "13:00" }, ctx, market.id).status).toBe("open");
    expect(availability(movie.location!, { date: "2027-06-12", start: "17:00", end: "22:30" }, ctx, movie.id).status).toBe("open");
    expect(availability(movie.location!, { date: "2027-06-12", start: "12:00", end: "22:30" }, ctx, movie.id)).toMatchObject({ status: "booked", reason: "Riverside Farmers Market has this date held" });
  });

  it("Oak Avenue block party: Sat, Jun 5. Reviewed as a block party, Quote sent: the applicant pays, and it is on the Clerk's payments list", () => {
    const f4 = seeded("F4");
    expect(f4).toMatchObject({ name: "Oak Avenue block party", tier: "reviewed", state: "quote_sent" });
    expect(classify(f4).blockPartyException).toBe(true);
    expect(fmtDate(f4.schedule!.date)).toBe("Sat, Jun 5, 2027");
    expect(whoIsUp(f4, TODAY)).toEqual(["applicant"]);
    expect(board(f4).do_now).toEqual(["accept_and_sign", "pay_fees"]);
    expect(card(f4, "pay_fees")).toMatchObject({ dueDate: "2027-05-06", payload: { amount: 480 } });
    expect(caseTotals(f4)).toMatchObject({ total: 480, paid: 0, due: 480 });
    expect(f4.dateHold).toEqual({ status: "held", placedOn: "2027-04-12", expiresOn: "2027-05-06" });
    expect(card(f4, "neighbor_signoff")).toMatchObject({ status: "done", payload: { progress: { done: 8, total: 8 } } });
  });

  it("Plaza wedding photos: City Hall Plaza, Fri, Jun 18. Reviewed, Submitted, missing insurance, and refused the date S3 holds", () => {
    const f5 = seeded("F5");
    const s3 = seeded("S3");
    expect(f5).toMatchObject({ name: "Plaza wedding photos", tier: "reviewed", state: "submitted" });
    expect(f5.location?.areaId).toBe("city-hall-plaza");
    expect(fmtDate(f5.schedule!.date)).toBe("Fri, Jun 18, 2027");
    // What was uploaded as the certificate is a photo of a contract: nobody has accepted it.
    expect(card(f5, "insurance_certificate")).toMatchObject({ status: "submitted", payload: { files: [{ name: "wedding-photographer-contract.jpg", type: "image/jpeg" }] } });

    // S3 was complete first: its hold dates from Apr 19, ten days before this was submitted.
    expect(s3.dateHold.placedOn! < dateOf(f5.submittedAt!)).toBe(true);
    expect(reasonFor(f5, { type: "accept_complete" }, "clerk")).toBe("Jazz in the Plaza has this date held");
    expect(availableActions(f5, "clerk", ctx).find((a) => a.type === "accept_complete")).toMatchObject({ enabled: false, reason: "Jazz in the Plaza has this date held" });
    expect(f5.dateHold.status).toBe("none");
    expect(queuedTasks("clerk", f5)).toEqual(["intake_check"]);
  });

  it("Little League Opening Day: Fields 1 and 2, Sat, May 15. Instant, Permitted, on the active permits list", () => {
    const f6 = seeded("F6");
    expect(f6).toMatchObject({ name: "Little League Opening Day", tier: "instant", state: "permitted", attendance: 90 });
    expect(f6.location?.inventoryIds).toEqual(["field-1", "field-2"]);
    expect(fmtDate(f6.schedule!.date)).toBe("Sat, May 15, 2027");
    expect(activePermits(seed, TODAY).map((c) => c.id)).toContain(f6.id);
    expect(caseTotals(f6)).toMatchObject({ total: 240, paid: 240, due: 0 });
  });

  it("Company picnic: Shelter 4, Sat, Apr 17. Instant, Closeout with a damage report, on the Clerk's Instant exceptions tab", () => {
    const f7 = seeded("F7");
    expect(f7).toMatchObject({ tier: "instant", state: "closeout", attendance: 80 });
    expect(f7.name).toMatch(/company picnic$/);
    expect(f7.location?.inventoryIds).toEqual(["shelter-4"]);
    expect(fmtDate(f7.schedule!.date)).toBe("Sat, Apr 17, 2027");
    expect(f7.closeout).toMatchObject({ cleanup: "issues", notes: "One picnic table at Shelter 4 was broken during the event; recommend repair.", hoursLoggedOn: "2027-04-17" });
    expect(f7.feeLines.at(-1)).toMatchObject({ label: "Broken picnic table repair", estimate: 0, actual: 95 });
    expect(whoIsUp(f7, TODAY)).toEqual(["clerk"]);
    expect(card(f7, "instant_exception")).toMatchObject({ owner: "clerk", status: "todo", title: "Resolve the exception" });
    expect(reasonFor(f7, { type: "reconcile_close" }, "clerk")).toBeNull();
  });
});

describe("background cases (plan 6.2)", () => {
  const background = SEED_SCRIPTS.filter((s) => s.key.startsWith("B")).map((s) => seeded(s.key));
  const persona = (c: EventCase) => PERSONAS.find((p) => p.id === c.applicantId)!;

  it("25 cases with the exact count for every state and ending", () => {
    expect(background).toHaveLength(25);
    const counts: Partial<Record<CaseState | Ending, number>> = {};
    for (const c of background) {
      const key = c.ending ?? c.state;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({ draft: 2, submitted: 2, in_review: 3, needs_info: 2, quote_sent: 2, permitted: 4, event_day: 1, closeout: 2, closed: 3, denied: 1, withdrawn: 1, cancelled: 1, hold_expired: 1 });
  });

  it("with the 13 PRD cases, every state and every ending is on screen at load", () => {
    const states = new Set(seed.filter((c) => c.ending === null).map((c) => c.state));
    expect([...states].sort()).toEqual(["closed", "closeout", "draft", "event_day", "in_review", "needs_info", "permitted", "quote_sent", "submitted"]);
    expect(new Set(seed.map((c) => c.ending).filter(Boolean))).toEqual(new Set(["denied", "withdrawn", "cancelled", "hold_expired"]));
  });

  it("Draft: one with only a name; one complete but failing the date gate", () => {
    const b01 = seeded("B01");
    expect(b01).toMatchObject({ state: "draft", name: "Central High Robotics Showcase", location: null, schedule: null, attendance: null, tasks: [] });

    const b02 = seeded("B02");
    expect(b02.state).toBe("draft");
    expect(b02.location && b02.schedule && b02.attendance && b02.eventType).toBeTruthy();
    const gate = dateGate(b02, classify(b02), ctx, b02.id);
    // Thu, May 13 is 10 days away; a Reviewed event (amplified sound) needs 30.
    expect(gate).toMatchObject({ ok: false, leadTimeOk: false, daysUntil: 10, fixes: ["new_date", "drop_addon", "late_fee"], droppable: ["amplified_sound"] });
    expect(gate.availability.status).toBe("open");
  });

  it("Submitted: one missing insurance and six days old at intake", () => {
    const b03 = seeded("B03");
    expect(b03.state).toBe("submitted");
    expect(daysBetween(dateOf(b03.submittedAt!), TODAY)).toBe(6);
    expect(card(b03, "insurance_certificate")).toMatchObject({ status: "submitted", payload: { files: [{ name: "spring-fair-flyer.jpg", type: "image/jpeg" }] } });
    expect(queued("clerk", b03).map((item) => [item.task.catalogId, item.task.dueDate, item.group, item.daysWaiting])).toEqual([["intake_check", "2027-04-30", "overdue", 6]]);
    expect(seeded("B04").state).toBe("submitted");
  });

  it("In review: one with an overdue Public Works & Safety review and lead-time risk; one sent to commission", () => {
    const b05 = seeded("B05");
    expect(queued("pws", b05).map((item) => [item.task.catalogId, item.task.dueDate, item.group])).toEqual([["review:pws", "2027-03-29", "overdue"]]);
    expect(leadTimeRisk(b05, TODAY, DEFAULT_CONFIG)).toBe("at_risk");
    expect(daysUntilEvent(b05, TODAY)).toBe(10);

    const b06 = seeded("B06");
    expect(b06).toMatchObject({ state: "in_review", flags: { sentToCommission: true } });
    expect(activityOn(b06, "Sent to commission.")).toBe("2027-03-16");
    expect(whoIsUp(b06, TODAY)).toEqual(["clerk"]);
    // The three In review cases that are not at risk leave B05 as the red one.
    expect(["B06", "B07"].map((key) => leadTimeRisk(seeded(key), TODAY, DEFAULT_CONFIG))).toEqual(["ok", "ok"]);
  });

  it("Needs info: one where the applicant is overdue; one asked by the Clerk at intake", () => {
    const b08 = seeded("B08");
    expect(b08.state).toBe("needs_info");
    expect(card(b08, "insurance_certificate").request).toMatchObject({ from: "hl", dueDate: "2027-04-01", resolved: false });
    expect(row(b08, "applicant")).toMatchObject({ status: "up_now", oldestDue: "2027-04-01" });
    expect(row(b08, "applicant").oldestDue! < TODAY).toBe(true);

    const b09 = seeded("B09");
    expect(b09).toMatchObject({ state: "needs_info", reviews: [], flags: { acceptedComplete: false } });
    expect(card(b09, "respond_to_request:1")).toMatchObject({ title: "Proof of nonprofit status for the coordinating council", reviewer: "clerk", request: { from: "clerk", resolved: false } });
    expect(card(b09, "intake_check")).toMatchObject({ status: "locked", payload: { awaitingAnswer: true } });
    expect(row(b09, "clerk")).toMatchObject({ status: "waiting", note: "Waiting on the applicant's response" });
  });

  it("Quote sent: one whose hold expires tomorrow; one paid and waiting on insurance", () => {
    const b10 = seeded("B10");
    expect(b10.dateHold).toMatchObject({ status: "held", expiresOn: addDaysISO(TODAY, 1) });
    expect(caseTotals(b10).paid).toBe(0);

    const b11 = seeded("B11");
    expect(b11.state).toBe("quote_sent");
    expect(caseTotals(b11)).toMatchObject({ total: 400, paid: 400, due: 0 });
    expect(b11.flags.signed).toBe(true);
    expect(card(b11, "insurance_certificate").status).toBe("submitted");
    expect(whoIsUp(b11, TODAY)).toEqual(["hl"]);
    expect(reasonFor(b11, { type: "issue_permit" }, "clerk")).toBe("Needs: insurance (Health & Legal)");
    // Paid in full, so the date can no longer be lost: nothing reads "held until Apr 24".
    expect(b11.dateHold).toEqual({ status: "held", placedOn: "2027-03-27", expiresOn: null });
  });

  it("Permitted: one within the next 7 days, one series, one Special with work orders", () => {
    const permitted = background.filter((c) => c.state === "permitted" && c.ending === null);
    expect(permitted).toHaveLength(4);

    const b12 = seeded("B12");
    expect(daysUntilEvent(b12, TODAY)).toBe(6);

    const b13 = seeded("B13");
    expect(b13.schedule?.recurrence).toBeDefined();
    expect(sessionDates(b13).length).toBeGreaterThanOrEqual(20);
    expect(b13.schedule!.occurrences.map((o) => o.billing)).toEqual(["paid", ...Array(sessionDates(b13).length - 1).fill("upcoming")]);

    const b14 = seeded("B14");
    expect(b14.tier).toBe("special");
    expect(queued("pws", b14).map((item) => [item.task.catalogId, item.task.dueDate])).toEqual([
      ["work_order:barricades", "2027-08-12"],
      ["work_order:police", "2027-08-12"],
      ["work_order:closure", "2027-08-12"],
    ]);
    // Everything before the permit is behind it; the two meetings ahead of it are on the calendar.
    expect(board(b14).do_now).toEqual(["coordination_meeting", "site_walkthrough"]);
    expect(card(b14, "coordination_meeting").payload.scheduledFor).toBe("2027-07-23");
    expect(card(b14, "site_walkthrough").payload.scheduledFor).toBe("2027-08-06");
    expect(["pre_application_meeting", "community_notification", "schedule_pre_application_meeting"].map((id) => card(b14, id).status)).toEqual(["done", "done", "done"]);
    expect(queued("clerk", b14)).toEqual([]);
  });

  it("Event day: the Monday tai chi series, whose May 31 session is skipped for the blackout", () => {
    const b16 = seeded("B16");
    expect(b16).toMatchObject({ state: "event_day", name: "Riverside Tai Chi Circle morning practice" });
    expect(b16.schedule?.recurrence).toMatchObject({ frequency: "weekly", weekday: 1 });
    expect(b16.schedule!.occurrences.find((o) => o.date === "2027-05-31")).toMatchObject({ billing: "skipped", availability: { status: "blackout", reason: "Memorial Day: all parks are closed to bookings" } });
    expect(b16.schedule!.occurrences.filter((o) => o.billing === "skipped")).toHaveLength(1);
    expect(sessionDates(b16)).not.toContain("2027-05-31");
    expect(card(b16, "carry_permit").status).toBe("todo");
  });

  it("Closeout: one with hours logged, waiting on the Clerk; one with a failed cleanup inspection", () => {
    const b17 = seeded("B17");
    expect(b17).toMatchObject({ state: "closeout", closeout: { cleanup: "pass", hoursLoggedOn: "2027-04-21" } });
    expect(whoIsUp(b17, TODAY)).toEqual(["clerk"]);
    expect(queuedTasks("clerk", b17)).toEqual(["reconcile"]);

    const b18 = seeded("B18");
    expect(b18).toMatchObject({ state: "closeout", closeout: { cleanup: "issues", notes: "Trash left along the route; a follow-up sweep is needed." } });
    expect(b18.feeLines.at(-1)).toMatchObject({ label: "Extra cleanup crew", actual: 120 });
    // Its history is whole: nothing from before the event is still open.
    expect(b18.tasks.filter((t) => t.status === "todo").map((t) => t.catalogId)).toEqual(["reconcile"]);
    expect(b18.tasks.filter((t) => t.catalogId.startsWith("work_order:")).map((t) => t.status)).toEqual(["done", "done"]);
  });

  it("Closed: one refund, one extra invoice, one Instant closed automatically", () => {
    const b19 = seeded("B19");
    expect(b19).toMatchObject({ state: "closed", closeout: { balance: 0, refund: 1000, feedback: { rating: 5 } } });
    expect(b19.payments.at(-1)).toMatchObject({ kind: "refund", amount: -1000 });
    expect(caseTotals(b19)).toMatchObject({ paid: 330, due: 0 });
    expect(board(b19)).toMatchObject({ do_now: ["book_again"], with_city: [], coming_up: [] });

    const b20 = seeded("B20");
    expect(b20).toMatchObject({ state: "closed", closeout: { balance: 300, refund: null } });
    expect(card(b20, "final_bill_or_refund")).toMatchObject({ status: "todo", dueDate: "2027-03-31", payload: { amount: 50 } });
    expect(caseTotals(b20).due).toBe(50);

    const b21 = seeded("B21");
    expect(b21).toMatchObject({ tier: "instant", state: "closed" });
    expect(b21.activity.at(-1)).toEqual({ at: "2027-03-02T09:00", actor: "system", text: "The event closed out with no issues." });
    expect(b21.tasks.filter((t) => t.owner !== "applicant")).toEqual([]);
  });

  it("Denied, Withdrawn, Cancelled and Hold expired: one each, with its reason in the activity log", () => {
    const endings: [string, Ending, string, string][] = [
      ["B22", "denied", "Public Works & Safety could not approve the sound plan for this location.", "Denied: Public Works & Safety could not approve the sound plan for this location."],
      ["B23", "withdrawn", "Withdrawn by the applicant.", "Withdrew the application."],
      ["B24", "cancelled", "30 or more days before: full refund minus a $10 processing fee", "Cancelled. 30 or more days before: full refund minus a $10 processing fee. Refunded $140."],
      ["B25", "hold_expired", "The date hold expired before the quote was paid.", "The date hold expired. The space and date were released."],
    ];
    for (const [key, ending, reason, logged] of endings) {
      const c = seeded(key);
      expect([key, c.ending, c.endingReason]).toEqual([key, ending, reason]);
      expect(c.activity.at(-1)?.text, key).toBe(logged);
      // An ended case is out of every queue and holds no date.
      for (const role of ["clerk", "pws", "hl"] as const) expect(queued(role, c), key).toEqual([]);
      expect(c.dateHold.status, key).not.toBe("held");
      expect(whoIsUp(c, TODAY), key).toEqual([]);
    }
    expect(seeded("B25").dateHold).toMatchObject({ status: "expired", expiresOn: "2027-04-25" });
    expect(activityOn(seeded("B25"), "The date hold expired. The space and date were released.")).toBe("2027-04-26");
  });

  describe("stress rows, each at least once", () => {
    it("an event name of 90 or more characters", () => {
      expect(Math.max(...seed.map((c) => c.name.length))).toBeGreaterThanOrEqual(90);
    });

    it("an organization name of 60 or more, and a name with diacritics and an apostrophe", () => {
      expect(seed.some((c) => persona(c).name.length >= 60)).toBe(true);
      expect(seed.some((c) => /[À-ÖØ-öø-ÿ]/.test(persona(c).name) && persona(c).name.includes("'"))).toBe(true);
      expect(seed.some((c) => /[À-ÖØ-öø-ÿ]/.test(c.name) && c.name.includes("'"))).toBe(true);
    });

    it("no description, and no setup or teardown times", () => {
      expect(seed.some((c) => c.description === undefined)).toBe(true);
      expect(seed.some((c) => c.schedule && c.schedule.setupStart === undefined && c.schedule.teardownEnd === undefined)).toBe(true);
    });

    it("a series of 20 or more sessions", () => {
      expect(seed.some((c) => sessionDates(c).length >= 20)).toBe(true);
    });

    it("a case with one activity entry and one with 30 or more", () => {
      const lengths = seed.map((c) => c.activity.length);
      expect(Math.min(...lengths)).toBe(1);
      expect(seeded("B01").activity).toEqual([{ at: "2027-05-01T10:00", actor: "applicant", text: "Started a draft." }]);
      expect(seeded("B14").activity.length).toBeGreaterThanOrEqual(30);
    });

    it("an overdue task for each of the four parties", () => {
      const overdueFor = (party: Party) =>
        seed.filter((c) => c.ending === null && c.state !== "closed" && row(c, party).status === "up_now" && (row(c, party).oldestDue ?? TODAY) < TODAY).map((c) => c.id);
      for (const party of PARTIES) expect(overdueFor(party).length, party).toBeGreaterThan(0);
      expect(overdueFor("clerk")).toContain(seeded("B03").id);
      expect(overdueFor("pws")).toContain(seeded("B05").id);
      expect(overdueFor("hl")).toContain(seeded("B07").id);
      expect(overdueFor("applicant")).toContain(seeded("B08").id);
    });

    it("a $0 fee line", () => {
      const waiver = seeded("B17").feeLines.find((line) => line.label === "Courtesy fee waiver");
      expect(waiver).toMatchObject({ unitPrice: 0, estimate: 0, actual: 0 });
    });

    it("a route over 10 miles", () => {
      expect(seeded("B14").location).toMatchObject({ mode: "route", miles: 12.4 });
      expect(seeded("B14").feeLines.find((line) => line.label === "Route closure")).toMatchObject({ qty: 12.4, estimate: 4960 });
    });
  });
});

describe("reserved slots: what the demo paths need is free", () => {
  it("Field 4 on all 13 Sundays from Jun 6 to Aug 29 is open, or impacted on Jul 11, for the S2 draft (path 1)", () => {
    const s2 = seeded("S2");
    const sundays = datesEvery("2027-06-06", "2027-08-29", 7);
    expect(sundays).toHaveLength(13);
    const statuses = sundays.map((date) => [date, availability(s2.location!, { date, start: "08:00", end: "09:00" }, ctx, s2.id).status]);
    expect(statuses).toEqual(sundays.map((date) => [date, date === "2027-07-11" ? "impacted" : "open"]));
    // At any hour of those days, not only the hour of the class.
    expect(sundays.every((date) => wholeDay(space("field-4"), date, s2.id).status !== "booked")).toBe(true);
    expect(reasonFor(s2, { type: "book_and_pay", method: "card" }, "applicant")).toBeNull();
  });

  it("Shelter 2 is open on every day from May 13 to Aug 31 (path 2)", () => {
    const days = datesEvery("2027-05-13", "2027-08-31", 1);
    expect(days).toHaveLength(111);
    const notOpen = days.map((date) => [date, wholeDay(space("shelter-2"), date).status]).filter(([, status]) => status !== "open");
    // Nobody has booked it. The calendar itself closes one day and warns about another.
    expect(notOpen).toEqual([
      ["2027-05-31", "blackout"],
      ["2027-07-11", "impacted"],
    ]);
  });

  it("the Maple Street 400 block on Jun 26 is held by nobody else (path 4)", () => {
    const s4 = seeded("S4");
    expect(wholeDay(s4.location!, "2027-06-26", s4.id).status).toBe("open");
    expect(seed.filter((c) => c.id !== s4.id && c.location?.segmentIds.includes("maple-400"))).toEqual([]);
  });

  it("Main Street, 1st to 4th Avenue, is open on Sat, Apr 22, 2028 (path 6)", () => {
    expect(fmtDate("2028-04-22")).toBe("Sat, Apr 22, 2028");
    expect(wholeDay(streets(MAIN_1ST_TO_4TH), "2028-04-22").status).toBe("open");
  });

  it("the slots the 13 PRD cases use are theirs: each one books, holds or would be accepted without a rival", () => {
    for (const key of ["S1", "S3", "S5", "S6", "F2", "F3", "F4", "F6", "F7"]) {
      const c = seeded(key);
      for (const date of sessionDates(c)) {
        const window = { date, start: c.schedule!.setupStart ?? c.schedule!.start, end: c.schedule!.teardownEnd ?? c.schedule!.end };
        expect(availability(c.location!, window, ctx, c.id).status, `${key} ${date}`).not.toBe("booked");
      }
    }
    expect(reasonFor(seeded("F1"), { type: "accept_complete" }, "clerk")).toBeNull();
  });

  it("what the seed does hold reads as taken: Shelter 3 on May 22 is Booked, and City Hall Plaza on Jul 11 is Impacted, not blocked", () => {
    expect(wholeDay(space("shelter-3"), "2027-05-22")).toMatchObject({ status: "booked", reason: "Maya Chen's 40th birthday picnic has this date held" });
    const plaza: Location = { mode: "area", inventoryIds: [], areaId: "city-hall-plaza", segmentIds: [], label: "City Hall Plaza" };
    expect(wholeDay(plaza, "2027-07-11")).toEqual({ status: "impacted", reason: "Riverfront Summer 5K closes Main Street 6 to 11:30 am that day" });
  });
});

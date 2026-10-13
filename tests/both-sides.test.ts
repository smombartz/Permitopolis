/**
 * The applicant's side and the city's side of the same thing, held to each other.
 *
 * Phase 4 gave the applicant's "With the city" column a note under every card (who has it, how
 * long, expected by when) and a summary line, built in lib/view/board.ts. The city sees the same
 * card through other code: the task in a department's queue with its due date, Who's up, and
 * the Documents tab's "waiting N days" (lib/view/verify.ts). Nothing but this file makes the two
 * agree, and an applicant told "expected by Fri, May 7" while the reviewer's queue says Monday
 * is the kind of gap a demo finds.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { boardColumns, buildSeed, cardUnderVerification, queueFor, taskDueDate, transition, waitingOn } from "@/lib/state";
import type { Action } from "@/lib/state";
import type { Actor, EventCase, ISODate, Task } from "@/lib/types";
import { withCityColumnSummary, withCityInfo } from "@/lib/view/board";
import { daysWaiting } from "@/lib/view/verify";

const TODAY = DEFAULT_DEMO_TODAY;
const S3 = "PMT-27-0118";
const S4 = "PMT-27-0126";
const S5 = "PMT-27-0097";
const B03 = "PMT-27-0006"; // submitted, the Clerk's intake check a working day overdue

function run(c: EventCase, action: Action, actor: Actor, today: ISODate = TODAY): EventCase {
  const result = transition(c, action, actor, { today, now: `${today}T09:00`, cases: [c], cfg: DEFAULT_CONFIG });
  if (!result.ok) throw new Error(`${action.type} was refused: ${result.reason}`);
  return result.case;
}

/** The city task that has this card right now: its own verify task, its department's open review, or the Clerk's open intake check. */
function cityTaskFor(c: EventCase, card: Task): Task | undefined {
  const verify = c.tasks.find((t) => t.catalogId.startsWith("verify:") && t.status !== "done" && cardUnderVerification(c, t)?.id === card.id);
  if (verify) return verify;
  const review = c.tasks.find((t) => t.catalogId === `review:${card.reviewer}` && t.status === "todo");
  if (review) return review;
  if (c.reviews.length === 0) return c.tasks.find((t) => t.catalogId === "intake_check" && t.status === "todo");
  return undefined;
}

/** Every "With the city" card of every case, with what each side says about it. */
function bothSides(cases: EventCase[], today: ISODate) {
  const rows: { c: EventCase; card: Task; info: NonNullable<ReturnType<typeof withCityInfo>>; cityTask: Task | undefined }[] = [];
  for (const c of cases) {
    for (const card of boardColumns(c).with_city) {
      const info = withCityInfo(c, card, today);
      if (!info) continue;
      rows.push({ c, card, info, cityTask: cityTaskFor(c, card) });
    }
  }
  return rows;
}

describe("a card With the city: what the applicant is told is what the city sees", () => {
  const seed = buildSeed();
  const rows = bothSides(seed, TODAY);

  it("the seed has cards in every situation: under a review, under a verify task, and still at intake", () => {
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.some((r) => r.cityTask?.catalogId.startsWith("verify:"))).toBe(true);
    expect(rows.some((r) => r.cityTask?.catalogId.startsWith("review:"))).toBe(true);
    expect(rows.some((r) => r.cityTask?.catalogId === "intake_check")).toBe(true);
    expect(rows.some((r) => r.cityTask === undefined)).toBe(true);
  });

  it("names the party that holds the card now: the one whose task it is, never a department still waiting for routing", () => {
    for (const { c, card, info, cityTask } of rows) {
      const where = `${c.id} ${card.catalogId}`;
      if (cityTask) expect(info.dept, where).toBe(cityTask.owner);
      // The department that will check it is always named too.
      expect(info.reviewer, where).toBe(card.reviewer);
      // Before routing the card is at the Clerk's intake, and its reviewer has not started.
      if (c.reviews.length === 0) {
        expect([info.dept, info.atIntake], where).toEqual(["clerk", true]);
        if (info.reviewer !== "clerk") expect(waitingOn(c, TODAY).find((p) => p.party === info.reviewer)?.status, where).toBe("waiting");
      } else {
        expect([info.dept, info.atIntake], where).toEqual([card.reviewer, false]);
      }
    }
  });

  it("\"expected by\" is the due date on the city's own task, and is missing exactly when nobody at the city has an open, dated task for it", () => {
    for (const { c, card, info, cityTask } of rows) {
      expect(info.expectedBy, `${c.id} ${card.catalogId}`).toBe(cityTask ? taskDueDate(cityTask) : null);
    }
  });

  it("\"overdue\" on the board is \"Overdue\" in that party's queue, and a card with a date has its holder up now", () => {
    for (const { c, card, info, cityTask } of rows) {
      const where = `${c.id} ${card.catalogId}`;
      if (!cityTask) {
        expect(info.overdue, where).toBe(false);
        continue;
      }
      const inQueue = queueFor(seed, info.dept, TODAY).find((row) => row.task.id === cityTask.id);
      expect(inQueue, `${where}: ${cityTask.catalogId} is not in ${info.dept}'s queue`).toBeDefined();
      expect(info.overdue, where).toBe(inQueue!.group === "overdue");
      expect(waitingOn(c, TODAY).find((p) => p.party === info.dept)?.status, where).toBe("up_now");
    }
  });

  it("the days a card has waited are the days the city's Documents tab counts", () => {
    for (const { c, card, info } of rows) expect(info.daysWaiting, `${c.id} ${card.catalogId}`).toBe(daysWaiting(card, TODAY));
  });

  it("the column's summary line counts the same cards under the same holders, with the soonest date", () => {
    for (const c of seed) {
      const mine = rows.filter((r) => r.c.id === c.id);
      const summary = withCityColumnSummary(c, TODAY);
      expect(summary.reduce((sum, row) => sum + row.count, 0), c.id).toBe(mine.length);
      for (const row of summary) {
        const dates = mine.filter((r) => r.info.dept === row.dept && r.info.expectedBy).map((r) => r.info.expectedBy!).sort();
        expect(row.expectedBy, `${c.id} ${row.dept}`).toBe(dates[0] ?? null);
      }
    }
  });
});

describe("the named cases", () => {
  const seed = buildSeed();
  const get = (id: string) => seed.find((c) => c.id === id)!;

  it("S5: the insurance is with Health & Legal, expected by Fri, May 7, the due date on its verify task", () => {
    const c = get(S5);
    const card = c.tasks.find((t) => t.catalogId === "insurance_certificate")!;
    expect(withCityInfo(c, card, TODAY)).toMatchObject({ dept: "hl", reviewer: "hl", atIntake: false, expectedBy: "2027-05-07", overdue: false, daysWaiting: 3 });
    expect(queueFor(seed, "hl", TODAY).find((row) => row.case.id === S5)?.task).toMatchObject({ catalogId: "verify:insurance_certificate", dueDate: "2027-05-07" });
  });

  it("B03: submitted and not yet accepted, its cards are at the Clerk's intake, overdue there as in the Clerk's queue", () => {
    const c = get(B03);
    const intake = queueFor(seed, "clerk", TODAY).find((row) => row.case.id === B03)!;
    expect([intake.task.catalogId, intake.group]).toEqual(["intake_check", "overdue"]);
    for (const card of boardColumns(c).with_city) {
      expect(withCityInfo(c, card, TODAY)).toMatchObject({ dept: "clerk", atIntake: true, expectedBy: taskDueDate(intake.task), overdue: true });
    }
    expect(withCityColumnSummary(c, TODAY)).toEqual([{ dept: "clerk", deptLabel: "City Clerk", atIntake: true, count: 2, expectedBy: taskDueDate(intake.task) }]);
  });

  it("S4: the Clerk's intake waits on the neighbors, so nothing is promised yet", () => {
    const c = get(S4);
    expect(c.tasks.find((t) => t.catalogId === "intake_check")?.status).toBe("locked");
    for (const card of boardColumns(c).with_city) {
      expect(withCityInfo(c, card, TODAY)).toMatchObject({ dept: "clerk", atIntake: true, expectedBy: null, overdue: false });
    }
  });

  it("S3, as each role acts: at intake's end the review's date, after the decision the verify task's, after the check nothing", () => {
    // The applicant answers Health & Legal's request: the card is back under the open review.
    const permit = `${S3}:vendor_health_permit:1`;
    let c = run(get(S3), { type: "respond_to_request", taskId: permit, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
    const card = () => c.tasks.find((t) => t.id === permit)!;
    const review = c.reviews.find((r) => r.dept === "hl")!;
    expect(boardColumns(c).with_city.map((t) => t.id)).toEqual([permit]);
    expect(withCityInfo(c, card(), TODAY)).toMatchObject({ dept: "hl", atIntake: false, expectedBy: review.dueDate });
    expect(taskDueDate(c.tasks.find((t) => t.catalogId === "review:hl")!)).toBe(review.dueDate);

    // Health & Legal verifies it: nothing is with the city any more.
    c = run(c, { type: "verify_document", taskId: permit }, "hl");
    expect(boardColumns(c).with_city).toEqual([]);
    expect(withCityColumnSummary(c, TODAY)).toEqual([]);
  });

  it("S5, a second upload after the check: the same verify task reopens with a new date, and the board follows it", () => {
    let c = run(get(S5), { type: "verify_document", taskId: `${S5}:insurance_certificate` }, "hl");
    expect(boardColumns(c).with_city).toEqual([]);
    c = run(c, { type: "complete_task", taskId: `${S5}:insurance_certificate`, files: [{ name: "insurance-renewed.pdf", size: 200_000, type: "application/pdf" }] }, "applicant", "2027-05-04");
    const card = c.tasks.find((t) => t.catalogId === "insurance_certificate")!;
    const verify = c.tasks.find((t) => t.catalogId === "verify:insurance_certificate")!;
    expect(verify.status).toBe("todo");
    expect(withCityInfo(c, card, "2027-05-04")).toMatchObject({ dept: "hl", expectedBy: taskDueDate(verify), daysWaiting: 0 });
  });
});

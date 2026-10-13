/**
 * Health & Legal issues each vendor's temporary food permit (PRD, "Vendor permits"): a city task
 * that `issue_permit` creates for a Special event with food vendors, that opens once every
 * vendor's health permit is verified, and that unlocks the applicant's own "Download per-vendor
 * food permits" card when it is done. Runs against the real rules.
 */
import { describe, expect, it } from "vitest";
import { classify, requirements } from "@/lib/rules";
import { EMPTY_ADDONS, type EventAnswers, type EventCase, type Task } from "@/lib/types";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";
import { checkCompleteCityTask } from "../checks";
import { waitingOn } from "../waitingOn";
import { buildSeed } from "../seed";

const ID = "PMT-27-0001";
const TODAY = "2027-05-03";

const vendorCard = (n: number, status: Task["status"]) =>
  makeTask({ id: `${ID}:vendor_health_permit:${n}`, catalogId: "vendor_health_permit", reviewer: "hl", status, phase: "review", payload: { vendorName: `Truck ${n}` }, title: `Health permit: Truck ${n}` });

/** A Special event with two food vendors, signed and paid, a click away from its permit. */
function quoted(vendorStatuses: Task["status"][], overrides: Partial<EventCase> = {}): EventCase {
  return makeCase({
    id: ID,
    tier: "special",
    state: "quote_sent",
    addOns: { ...EMPTY_ADDONS, foodVending: { vendors: vendorStatuses.length, vendorNames: vendorStatuses.map((_, i) => `Truck ${i + 1}`) } },
    flags: { sentToCommission: false, lateFee: false, signed: true, acceptedComplete: true, amendmentPending: false },
    dateHold: { status: "held", placedOn: "2027-04-01", expiresOn: "2027-05-10" },
    tasks: [
      ...vendorStatuses.map((status, i) => vendorCard(i + 1, status)),
      makeTask({ id: `${ID}:vendor_food_permits`, catalogId: "vendor_food_permits", kind: "action", reviewer: "hl", status: "locked", unlocksOn: "food_permits_issued", dueDate: "2027-07-02", phase: "before_event", title: "Download per-vendor food permits" }),
      makeTask({ id: `${ID}:issue_permit`, catalogId: "issue_permit", owner: "clerk", kind: "action", status: "todo", title: "Issue permit" }),
    ],
    ...overrides,
  });
}

function apply(c: EventCase, action: Parameters<typeof transition>[1], actor: Parameters<typeof transition>[2]): EventCase {
  const result = transition(c, action, actor, makeCtx());
  if (!result.ok) throw new Error(`${action.type} as ${actor} was refused: ${result.reason}`);
  return result.case;
}

const task = (c: EventCase, suffix: string) => c.tasks.find((t) => t.id === `${c.id}:${suffix}`);
const row = (c: EventCase, party: "applicant" | "hl") => waitingOn(c, TODAY).find((p) => p.party === party)!;

describe("the plan's card", () => {
  it("\"Download per-vendor food permits\" waits for Health & Legal to issue them, not only for the permit", () => {
    const answers: EventAnswers = {
      eventType: "market_festival",
      name: "Street fair",
      location: { mode: "streets", inventoryIds: [], segmentIds: ["main-1-2", "main-2-3"], miles: 0.2, label: "Main Street, 1st to 3rd Avenue" },
      schedule: { date: "2027-08-14", start: "10:00", end: "18:00", occurrences: [] },
      attendance: 800,
      addOns: { ...EMPTY_ADDONS, foodVending: { vendors: 2, vendorNames: ["Truck 1", "Truck 2"] } },
    };
    const cards = requirements(answers, classify(answers), { caseId: ID, today: TODAY });
    expect(cards.find((t) => t.catalogId === "vendor_food_permits")).toMatchObject({ status: "locked", unlocksOn: "food_permits_issued", reviewer: "hl" });
  });
});

describe("issue_permit", () => {
  it("gives Health & Legal \"Issue food permits\", due when the applicant's card is, and open at once when every vendor is verified", () => {
    const permitted = apply(quoted(["done", "done"]), { type: "issue_permit" }, "clerk");
    expect(task(permitted, "issue_food_permits")).toMatchObject({ owner: "hl", kind: "action", title: "Issue food permits", status: "todo", dueDate: "2027-07-02", phase: "before_event" });
    // The applicant's card stays locked: the permits are not issued yet.
    expect(task(permitted, "vendor_food_permits")).toMatchObject({ status: "locked", unlocksOn: "food_permits_issued" });
    expect(row(permitted, "hl")).toMatchObject({ status: "up_now", note: "Up: Issue food permits" });
  });

  it("leaves it locked while a vendor's health permit is still out, and Who's up says what it waits for", () => {
    const permitted = apply(quoted(["done", "todo"]), { type: "issue_permit" }, "clerk");
    expect(task(permitted, "issue_food_permits")).toMatchObject({ status: "locked" });
    expect(row(permitted, "hl")).toMatchObject({ status: "waiting", note: "Unlocks when every vendor's health permit is verified", nextTask: { catalogId: "issue_food_permits" } });
    expect(checkCompleteCityTask(permitted, `${ID}:issue_food_permits`, "hl", TODAY)).toEqual({ ok: false, reason: "1 of 2 vendor health permits still needs to be verified." });
  });

  it("creates no such task for an event with no food permits to issue (Reviewed, or no vendors)", () => {
    const reviewed = quoted(["done"], { tier: "reviewed" });
    const withoutCard = { ...reviewed, tasks: reviewed.tasks.filter((t) => t.catalogId !== "vendor_food_permits") };
    expect(task(apply(withoutCard, { type: "issue_permit" }, "clerk"), "issue_food_permits")).toBeUndefined();
  });
});

describe("verifying the last vendor's health permit", () => {
  it("opens \"Issue food permits\" for Health & Legal", () => {
    let c = apply(quoted(["done", "todo"]), { type: "issue_permit" }, "clerk");
    c = apply(c, { type: "complete_task", taskId: `${ID}:vendor_health_permit:2`, files: [{ name: "truck-2.pdf", size: 1000, type: "application/pdf" }] }, "applicant");
    expect(task(c, "issue_food_permits")?.status).toBe("locked");
    expect(checkCompleteCityTask(c, `${ID}:issue_food_permits`, "hl", TODAY)).toMatchObject({ ok: false, reason: "1 of 2 vendor health permits still needs to be verified." });

    c = apply(c, { type: "verify_document", taskId: `${ID}:vendor_health_permit:2` }, "hl");
    expect(task(c, "issue_food_permits")?.status).toBe("todo");
    expect(checkCompleteCityTask(c, `${ID}:issue_food_permits`, "hl", TODAY)).toEqual({ ok: true });
  });
});

describe("complete_city_task on \"Issue food permits\"", () => {
  const ready = () => apply(quoted(["done", "done"]), { type: "issue_permit" }, "clerk");

  it("is Health & Legal's alone", () => {
    expect(transition(ready(), { type: "complete_city_task", taskId: `${ID}:issue_food_permits` }, "clerk", makeCtx())).toEqual({ ok: false, reason: "That task belongs to Health & Legal." });
  });

  it("issues the permits: the task is done, the applicant's card opens, and the log says how many", () => {
    const issued = apply(ready(), { type: "complete_city_task", taskId: `${ID}:issue_food_permits` }, "hl");
    expect(task(issued, "issue_food_permits")?.status).toBe("done");
    expect(task(issued, "vendor_food_permits")).toMatchObject({ status: "todo", unlocksOn: null, dueDate: "2027-07-02" });
    expect(issued.activity.at(-1)).toMatchObject({ actor: "hl", text: "Issued the food permits for 2 vendors." });
    expect(row(issued, "applicant")).toMatchObject({ status: "up_now", note: "Up: Download per-vendor food permits" });
    expect(transition(issued, { type: "complete_city_task", taskId: `${ID}:issue_food_permits` }, "hl", makeCtx())).toEqual({ ok: false, reason: "Already done." });

    // And only now can the applicant finish the card.
    const downloaded = apply(issued, { type: "complete_task", taskId: `${ID}:vendor_food_permits` }, "applicant");
    expect(task(downloaded, "vendor_food_permits")?.status).toBe("done");
  });

  it("the applicant cannot download permits that have not been issued", () => {
    expect(transition(ready(), { type: "complete_task", taskId: `${ID}:vendor_food_permits` }, "applicant", makeCtx())).toEqual({
      ok: false,
      reason: "Unlocks when Health & Legal issues the food permits",
    });
  });
});

describe("the seed", () => {
  it("S6's food permits were issued by Health & Legal the day before the organizer downloaded them", () => {
    const s6 = buildSeed().find((c) => c.id === "PMT-27-0031")!;
    const issue = task(s6, "issue_food_permits")!;
    expect(issue).toMatchObject({ owner: "hl", status: "done" });
    expect(issue.history.at(-1)).toMatchObject({ at: "2027-04-15T09:00", actor: "hl", status: "done" });
    const download = task(s6, "vendor_food_permits")!;
    expect(download.status).toBe("done");
    expect(download.history.at(-1)!.at > issue.history.at(-1)!.at).toBe(true);
    expect(s6.activity.map((a) => a.text)).toContain("Issued the food permits for 25 vendors.");
  });

  it("no other seeded case is waiting on food permits", () => {
    const open = buildSeed().filter((c) => c.tasks.some((t) => t.catalogId === "issue_food_permits" && t.status !== "done"));
    expect(open.map((c) => c.id)).toEqual([]);
  });
});

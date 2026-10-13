import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { singleSchedule, streetsLocation } from "@/lib/state/seed/helpers";
import {
  closedAtNote,
  closureChecklist,
  filterWorkOrders,
  groupWorkOrdersByEvent,
  meetingRows,
  parseWorkOrdersFilters,
  reopenedAtNote,
  todaysClosureCases,
  workOrderRows,
  workOrdersQueryString,
  workOrdersSummary,
} from "./workOrders";

const TODAY = DEFAULT_DEMO_TODAY; // Mon, May 3, 2027
const B14 = "PMT-27-0030"; // Four Bridges Ultra: Special, Permitted, three open work orders, Aug 14
const B18 = "PMT-27-0038"; // Thunderbird MC poker run: Special, Closeout, barricades and closure both done
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent (not yet permitted): no work orders yet

describe("workOrderRows", () => {
  it("B14: the three open work orders, with their quantities, event date and due date", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === B14);
    expect(rows).toHaveLength(3);
    const barricades = rows.find((r) => r.kind === "barricades")!;
    expect(barricades).toMatchObject({ what: "Deliver barricades", quantity: "30 barricades", eventDate: "2027-08-14", due: "2027-08-12", status: "scheduled", overdue: false });
    const police = rows.find((r) => r.kind === "police")!;
    expect(police.quantity).toBe("6 officers × 4h");
    const closure = rows.find((r) => r.kind === "closure")!;
    expect(closure.what).toBe("Close the street");
  });

  it("B18: its two work orders are both done and never overdue, whatever today is", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === B18);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "done" && !r.overdue)).toBe(true);
  });

  it("S5 before it is permitted has no work orders yet", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === S5);
    expect(rows).toEqual([]);
  });

  it("a work order past its due date, still open, is overdue", () => {
    const c = makeCase({ state: "permitted" });
    const task = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action", dueDate: "2027-04-01" });
    const rows = workOrderRows([{ ...c, tasks: [task] }], TODAY);
    expect(rows[0]).toMatchObject({ status: "scheduled", overdue: true });
  });

  it("an ended case's work orders do not show", () => {
    const c = makeCase({ state: "permitted", ending: "cancelled", endingReason: "Cancelled by the applicant." });
    const task = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action" });
    expect(workOrderRows([{ ...c, tasks: [task] }], TODAY)).toEqual([]);
  });
});

describe("filterWorkOrders", () => {
  it("narrows by status and kind", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === B14);
    expect(filterWorkOrders(rows, { kind: "police" })).toHaveLength(1);
    expect(filterWorkOrders(rows, { status: "done" })).toEqual([]);
  });

  it("narrows by a due-date range", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === B14);
    expect(filterWorkOrders(rows, { from: "2027-08-13" })).toEqual([]);
    expect(filterWorkOrders(rows, { to: "2027-08-11" })).toEqual([]);
    expect(filterWorkOrders(rows, { from: "2027-08-01", to: "2027-08-31" })).toHaveLength(3);
  });
});

describe("groupWorkOrdersByEvent", () => {
  it("groups by case and sorts by event date, B18's past event before B14's future one", () => {
    const rows = workOrderRows(buildSeed(), TODAY).filter((r) => r.case.id === B14 || r.case.id === B18);
    const groups = groupWorkOrdersByEvent(rows);
    expect(groups.map((g) => g.case.id)).toEqual([B18, B14]);
    expect(groups[1].rows).toHaveLength(3);
  });
});

describe("workOrdersSummary", () => {
  it("counts open, overdue and due this week", () => {
    const overdue = { ...makeTask({ id: "a:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action", dueDate: "2027-04-01" }) };
    const dueThisWeek = { ...makeTask({ id: "b:work_order:police", catalogId: "work_order:police", owner: "pws", kind: "action", dueDate: "2027-05-05" }) };
    const done = { ...makeTask({ id: "c:work_order:closure", catalogId: "work_order:closure", owner: "pws", kind: "action", status: "done", dueDate: "2027-04-20" }) };
    const rows = workOrderRows(
      [
        { ...makeCase({ id: "PMT-27-7001" }), tasks: [overdue] },
        { ...makeCase({ id: "PMT-27-7002" }), tasks: [dueThisWeek] },
        { ...makeCase({ id: "PMT-27-7003" }), tasks: [done] },
      ],
      TODAY,
    );
    expect(workOrdersSummary(rows, TODAY)).toBe("2 open: 1 overdue, 1 due this week");
  });

  it("is all zeros with nothing open", () => {
    expect(workOrdersSummary([], TODAY)).toBe("0 open: 0 overdue, 0 due this week");
  });
});

describe("meetingRows", () => {
  it("B14: its coordination meeting and walkthrough, both scheduled and not yet held", () => {
    const rows = meetingRows(buildSeed(), TODAY).filter((r) => r.case.id === B14);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.kind === "coordination_meeting")).toMatchObject({ scheduledFor: "2027-07-23", held: false });
    expect(rows.find((r) => r.kind === "site_walkthrough")).toMatchObject({ scheduledFor: "2027-08-06", held: false });
  });

  it("a meeting with no scheduledFor yet is still to schedule", () => {
    const c = makeCase({ tier: "special" });
    const task = makeTask({ id: "x:coordination_meeting", catalogId: "coordination_meeting", owner: "applicant", kind: "meeting", status: "locked", reviewer: "clerk" });
    const rows = meetingRows([{ ...c, tasks: [task] }], TODAY);
    expect(rows).toEqual([{ task, case: { ...c, tasks: [task] }, kind: "coordination_meeting", scheduledFor: null, held: false, eventDate: null }]);
  });

  it("does not list a work order or an unrelated task", () => {
    const c = makeCase();
    const task = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action" });
    expect(meetingRows([{ ...c, tasks: [task] }], TODAY)).toEqual([]);
  });
});

describe("todaysClosureCases / closureChecklist", () => {
  it("is empty when nothing is on Event day with a street closure", () => {
    expect(todaysClosureCases(buildSeed(), TODAY)).toEqual([]);
  });

  it("lists a case on Event day with a street closed, with its work orders as the checklist", () => {
    const todaySchedule = singleSchedule(TODAY, "09:00", "17:00");
    const streetCase = makeCase({ id: "PMT-27-8001", state: "event_day", location: streetsLocation(["main-1-2"], "Main Street, 1st to 2nd Avenue"), schedule: todaySchedule });
    const notStreet = makeCase({ id: "PMT-27-8002", state: "event_day", location: { mode: "inventory", inventoryIds: ["shelter-1"], segmentIds: [], label: "Shelter 1" }, schedule: todaySchedule });
    const notToday = makeCase({ id: "PMT-27-8003", state: "permitted", location: streetsLocation(["main-2-3"], "Main Street, 2nd to 3rd Avenue"), schedule: singleSchedule("2027-09-01", "09:00", "17:00") });
    const barricades = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action", dueDate: "2027-05-01" });
    const closure = makeTask({ id: "x:work_order:closure", catalogId: "work_order:closure", owner: "pws", kind: "action", dueDate: "2027-04-30" });
    const withTasks = { ...streetCase, tasks: [barricades, closure] };
    const cases = [withTasks, notStreet, notToday];

    expect(todaysClosureCases(cases, TODAY)).toEqual([withTasks]);
    expect(closureChecklist(withTasks).map((t) => t.catalogId)).toEqual(["work_order:closure", "work_order:barricades"]);
  });
});

describe("closedAtNote / reopenedAtNote", () => {
  it("is the fixed, readable wording the activity log reads back", () => {
    expect(closedAtNote("7:45 am")).toBe("Closed at 7:45 am.");
    expect(reopenedAtNote("11:40 am")).toBe("Reopened at 11:40 am.");
  });
});

describe("parseWorkOrdersFilters / workOrdersQueryString", () => {
  it("defaults to the Work orders tab with no filters", () => {
    expect(parseWorkOrdersFilters(new URLSearchParams())).toEqual({ tab: "orders", status: undefined, kind: undefined, from: undefined, to: undefined });
  });

  it("reads the Meetings tab and every filter", () => {
    const filters = parseWorkOrdersFilters(new URLSearchParams("tab=meetings&status=done&kind=police&from=2027-05-01&to=2027-05-31"));
    expect(filters).toEqual({ tab: "meetings", status: "done", kind: "police", from: "2027-05-01", to: "2027-05-31" });
  });

  it("round-trips through the query string", () => {
    const filters = parseWorkOrdersFilters(new URLSearchParams("status=scheduled&kind=trash"));
    expect(parseWorkOrdersFilters(new URLSearchParams(workOrdersQueryString(filters)))).toEqual(filters);
  });

  it("drops an invalid kind or status", () => {
    expect(parseWorkOrdersFilters(new URLSearchParams("status=nope&kind=nope"))).toMatchObject({ status: undefined, kind: undefined });
  });
});

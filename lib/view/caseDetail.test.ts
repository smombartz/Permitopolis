import { describe, expect, it } from "vitest";
import { CITY_TASKS } from "@/lib/rules/catalog";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { availableActions, buildSeed, checkCompleteCityTask, checkScheduleMeeting, queueFor, transition, waitingOn } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import {
  activityActors,
  buildOverview,
  caseBackLink,
  CASE_TABS,
  documentGroups,
  filterActivity,
  formRows,
  groupActivityByDay,
  hasNothingToDo,
  headerReviewClock,
  isCaseTab,
  isHoldExpiringTomorrow,
  lastActedAt,
  openKeyForAction,
  openKeyForTask,
  ownTaskRows,
  parseOpenKey,
  resolveOpenKey,
  reviewSummaries,
  seriesSummary,
  sinceLastActedCount,
  unroutedDeptNote,
} from "./caseDetail";

const TODAY = DEFAULT_DEMO_TODAY;
const cases = buildSeed();
const S3 = cases.find((c) => c.id === "PMT-27-0118")!; // Jazz in the Plaza, Needs info
const S4 = cases.find((c) => c.id === "PMT-27-0126")!; // Maple Street block party, Submitted
const S5 = cases.find((c) => c.id === "PMT-27-0097")!; // Riverfront Summer 5K, Quote sent
const S6 = cases.find((c) => c.id === "PMT-27-0031")!; // Main Street Food Truck Festival, Closeout

describe("tabs", () => {
  it("knows its own five tabs", () => {
    expect(CASE_TABS).toEqual(["overview", "reviews", "documents", "conditions", "activity"]);
    for (const tab of CASE_TABS) expect(isCaseTab(tab)).toBe(true);
  });

  it("rejects anything else, including null", () => {
    expect(isCaseTab("timeline")).toBe(false);
    expect(isCaseTab(null)).toBe(false);
  });
});

describe("caseBackLink", () => {
  it("returns to the list the case was opened from, and names it", () => {
    expect(caseBackLink("/city/queue", "pws")).toEqual({ href: "/city/queue", label: "Back to My queue" });
    expect(caseBackLink("/city/active?view=calendar&date=2027-06-07", "hl")).toEqual({
      href: "/city/active?view=calendar&date=2027-06-07",
      label: "Back to Active permits",
    });
    expect(caseBackLink("/city/intake?tab=reviewed", "clerk")).toEqual({ href: "/city/intake?tab=reviewed", label: "Back to Intake" });
  });

  it("keeps a filtered pipeline's filters", () => {
    expect(caseBackLink("/city/cases?view=table&tier=special&sort=due", "clerk")).toEqual({
      href: "/city/cases?view=table&tier=special&sort=due",
      label: "Back to cases",
    });
  });

  it("falls back to the cases pipeline with no list, or one that is not a city list", () => {
    const pipeline = { href: "/city/cases", label: "Back to cases" };
    expect(caseBackLink(null, "clerk")).toEqual(pipeline);
    expect(caseBackLink("not-a-path", "clerk")).toEqual(pipeline);
    expect(caseBackLink("//elsewhere.example/city/queue", "clerk")).toEqual(pipeline);
    expect(caseBackLink("/events", "clerk")).toEqual(pipeline);
  });

  it("does not send another department back to the Clerk's Intake", () => {
    expect(caseBackLink("/city/intake", "pws")).toEqual({ href: "/city/cases", label: "Back to cases" });
  });

  it("returns to each role's own tool page, with that page's tab and filters", () => {
    expect(caseBackLink("/city/payments?tab=received&method=card", "clerk")).toEqual({ href: "/city/payments?tab=received&method=card", label: "Back to Payments" });
    expect(caseBackLink("/city/map?mode=day&from=2027-07-11", "pws")).toEqual({ href: "/city/map?mode=day&from=2027-07-11", label: "Back to Closures and routes" });
    expect(caseBackLink("/city/work-orders?tab=meetings", "pws")).toEqual({ href: "/city/work-orders?tab=meetings", label: "Back to Work orders" });
    expect(caseBackLink("/city/verifications?group=event", "hl")).toEqual({ href: "/city/verifications?group=event", label: "Back to Verifications" });
    expect(caseBackLink("/city/inspections", "hl")).toEqual({ href: "/city/inspections", label: "Back to Inspections" });
  });

  it("does not send a role back to another role's tool page", () => {
    const pipeline = { href: "/city/cases", label: "Back to cases" };
    expect(caseBackLink("/city/payments", "hl")).toEqual(pipeline);
    expect(caseBackLink("/city/map", "clerk")).toEqual(pipeline);
    expect(caseBackLink("/city/work-orders", "hl")).toEqual(pipeline);
    expect(caseBackLink("/city/verifications", "pws")).toEqual(pipeline);
    expect(caseBackLink("/city/inspections", "clerk")).toEqual(pipeline);
  });
});

describe("headerReviewClock", () => {
  it("is null for the applicant", () => {
    expect(headerReviewClock(S3, "applicant", TODAY)).toBeNull();
  });

  it("is the reviewer's own clock for a department, even once it has decided (the clock stopped, not vanished)", () => {
    const clock = headerReviewClock(S3, "pws", TODAY);
    expect(clock).not.toBeNull();
    expect(clock!.paused).toBe(false);
  });

  it("reads Health & Legal's own open clock on S3", () => {
    const clock = headerReviewClock(S3, "hl", TODAY);
    expect(clock).not.toBeNull();
    expect(clock!.paused).toBe(true);
  });

  it("is the slowest open review for the Clerk, on S3 (Public Works & Safety already decided; Health & Legal is still open)", () => {
    const clock = headerReviewClock(S3, "clerk", TODAY);
    expect(clock).not.toBeNull();
    const hl = headerReviewClock(S3, "hl", TODAY);
    expect(clock).toEqual(hl);
  });

  it("is null for the Clerk once every review has decided, as on S5 and S6", () => {
    expect(headerReviewClock(S5, "clerk", TODAY)).toBeNull();
    expect(headerReviewClock(S6, "clerk", TODAY)).toBeNull();
  });
});

describe("buildOverview", () => {
  it("fills every row it can for S5, a route with city services and amplified sound", () => {
    const overview = buildOverview(S5);
    const byLabel = Object.fromEntries(overview.rows.map((r) => [r.label, r.value]));
    expect(byLabel["Event type"]).toBe("Race or parade");
    expect(byLabel["Place"]).toContain("Downtown loop");
    expect(byLabel["Attendance"]).toBe("1,200");
    expect(byLabel["Add-ons"]).toContain("Amplified sound");
    expect(byLabel["Add-ons"]).toContain("City services");
    // A single event, not a series: no Sessions row at all, never "Sessions: Not provided".
    expect("Sessions" in byLabel).toBe(false);
    expect(overview.mapHighlight).not.toBeNull();
    expect(overview.mapHighlight!.status).toBe("held");
    expect(overview.components.length).toBeGreaterThan(0);
  });

  it("what the permit covers is read off the record, not off the tier rules as Settings has them now", () => {
    const s1 = cases.find((c) => c.id === "PMT-27-0109")!;
    const covers = (c: typeof s1) => buildOverview(c).components.map((comp) => `${comp.label} · ${comp.approvedBy}`);
    expect(s1).toMatchObject({ tier: "instant", attendance: 45, triggers: [] });
    expect(covers(s1)).toEqual(["Space reservation · City Clerk (automatic for Instant)"]);
    // Every seeded case past Draft reads the same under a lowered threshold: there is no config to read.
    expect(buildOverview.length).toBe(1);
    // A block party's exception is on the record too (its trigger), whatever the limit is today.
    const s4 = cases.find((c) => c.id === "PMT-27-0126")!;
    expect(s4.triggers.map((t) => t.id)).toContain("block_party");
    expect(covers(s4)).toContain("Block party approval · City Clerk, Public Works & Safety");
    expect(covers(s4).some((line) => line.startsWith("Street closure"))).toBe(false);
  });

  it("while an amendment is pending the list is the plan the permit covers, under the banner that says so", () => {
    const s1 = cases.find((c) => c.id === "PMT-27-0109")!;
    const pending = transition(s1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true }, "applicant", { today: TODAY, cases, cfg: DEFAULT_CONFIG });
    if (!pending.ok) throw new Error(pending.reason);
    expect(pending.case).toMatchObject({ tier: "reviewed", flags: { amendmentPending: true } });
    const overview = buildOverview(pending.case);
    expect(overview.components.map((comp) => comp.label)).toEqual(["Space reservation"]);
    // The rest of the Overview is the record as amended: its add-ons and its triggers.
    expect(overview.triggers.map((t) => t.id)).toEqual(["amplified_sound"]);
    expect(Object.fromEntries(overview.rows.map((r) => [r.label, r.value]))["Add-ons"]).toContain("Amplified sound");
  });

  it("reads 'Not provided' territory as null for what a minimal case leaves out", () => {
    const draft = makeCase({ description: undefined, location: null, schedule: null, attendance: null });
    const overview = buildOverview(draft);
    const byLabel = Object.fromEntries(overview.rows.map((r) => [r.label, r.value]));
    expect(byLabel["Description"]).toBeNull();
    expect(byLabel["Place"]).toBeNull();
    expect(byLabel["Date and hours"]).toBeNull();
    expect(byLabel["Setup and teardown"]).toBeNull();
    expect("Sessions" in byLabel).toBe(false);
    expect(byLabel["Attendance"]).toBeNull();
    // No add-ons is an answer, not a gap.
    expect(byLabel["Add-ons"]).toBe("None");
  });

  it("a series has its Sessions row; tents and stages are counted in the plural", () => {
    const s2 = cases.find((c) => c.id === "PMT-27-0142")!;
    const byLabel = Object.fromEntries(buildOverview(s2).rows.map((r) => [r.label, r.value]));
    expect(byLabel["Sessions"]).toMatch(/^Weekly, 13 sessions/);

    const tents = (count: number) =>
      Object.fromEntries(buildOverview(makeCase({ addOns: { ...S5.addOns, amplifiedSound: false, cityServices: null, tentsStages: { count } } })).rows.map((r) => [r.label, r.value]))["Add-ons"];
    expect(tents(1)).toBe("1 tent or stage");
    expect(tents(3)).toBe("3 tents or stages");
  });
});

describe("unroutedDeptNote: what a department with no review on the case is told on the Reviews tab", () => {
  const ctx = { today: TODAY, cases, cfg: DEFAULT_CONFIG };
  const run = (c: (typeof cases)[number], action: Parameters<typeof transition>[1], actor: Parameters<typeof transition>[2]) => {
    const result = transition(c, action, actor, ctx);
    if (!result.ok) throw new Error(result.reason);
    return result.case;
  };

  it("before routing, a department named on a card is waiting for routing", () => {
    const s4 = cases.find((c) => c.id === "PMT-27-0126")!; // the Maple Street block party, Submitted
    expect(s4).toMatchObject({ state: "submitted", reviews: [] });
    expect(unroutedDeptNote(s4, "hl")).toBe("Named on a card (Certificate of insurance), waiting for routing.");
    expect(unroutedDeptNote(s4, "clerk")).toBe("No license review on this case.");
  });

  it("an amended Instant event is never routed: each department checks the amendment's own card, and the note says where that card is", () => {
    const s1 = cases.find((c) => c.id === "PMT-27-0109")!;
    let c = run(s1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true }, "applicant");
    expect(c.reviews).toEqual([]);
    expect(unroutedDeptNote(c, "pws")).toBe("Checks the amendment's card: Sound details (with the applicant).");
    expect(unroutedDeptNote(c, "hl")).toBe("Checks the amendment's card: Certificate of insurance (with the applicant).");

    c = run(c, { type: "complete_task", taskId: `${c.id}:sound_details`, form: { equipment: "One DJ booth", soundCheckTime: "10:30" } }, "applicant");
    // The same department has "Verify Sound details" in its queue now; nothing here is "waiting for routing".
    expect(queueFor([c], "pws", TODAY).map((row) => row.task.catalogId)).toEqual(["verify:sound_details"]);
    expect(unroutedDeptNote(c, "pws")).toBe("Checks the amendment's card: Sound details (being checked).");
    for (const dept of ["pws", "hl"] as const) expect(unroutedDeptNote(c, dept)).not.toMatch(/routing/);

    c = run(c, { type: "verify_document", taskId: `${c.id}:sound_details` }, "pws");
    expect(unroutedDeptNote(c, "pws")).toBe("Checks the amendment's card: Sound details (checked).");
  });

  it("an ended case, and a department with nothing on the case", () => {
    const s1 = cases.find((c) => c.id === "PMT-27-0109")!;
    expect(unroutedDeptNote(s1, "pws")).toBe("The City Clerk has not routed this case to this department.");
    expect(unroutedDeptNote({ ...s1, ending: "cancelled" }, "pws")).toBe("This case ended before it could be routed here.");
  });
});

describe("openKeyForTask: a meeting card is the city's to schedule and to close", () => {
  const meeting = (payload: Record<string, unknown> = {}, reviewer: "clerk" | "pws" = "pws") =>
    makeTask({ id: "PMT-27-0001:site_walkthrough", catalogId: "site_walkthrough", kind: "meeting", owner: "applicant", reviewer, payload });

  it("the Clerk and the host department schedule it while it has no date, and close it once it has one", () => {
    const c = makeCase({ state: "permitted", tasks: [meeting()] });
    expect(openKeyForTask(c, c.tasks[0], "clerk")).toBe("schedule_meeting:PMT-27-0001:site_walkthrough");
    expect(openKeyForTask(c, c.tasks[0], "pws")).toBe("schedule_meeting:PMT-27-0001:site_walkthrough");

    const scheduled = makeCase({ state: "permitted", tasks: [meeting({ scheduledFor: "2027-05-10" })] });
    expect(openKeyForTask(scheduled, scheduled.tasks[0], "clerk")).toBe("complete_city_task:PMT-27-0001:site_walkthrough");
    expect(openKeyForTask(scheduled, scheduled.tasks[0], "pws")).toBe("complete_city_task:PMT-27-0001:site_walkthrough");
  });

  it("a department that does not hold the meeting still only reminds the applicant", () => {
    const c = makeCase({ state: "permitted", tasks: [meeting()] });
    expect(openKeyForTask(c, c.tasks[0], "hl")).toBe("remind:applicant");
  });

  it("the key it gives is one the engine takes, on every open meeting card of the seed", () => {
    let checked = 0;
    for (const c of cases) {
      if (c.ending !== null || c.state === "closed") continue;
      for (const task of c.tasks) {
        if (task.owner !== "applicant" || task.kind !== "meeting" || task.status === "done" || task.status === "locked") continue;
        const key = openKeyForTask(c, task, "clerk")!;
        const { action, arg } = parseOpenKey(key);
        expect(["schedule_meeting", "complete_city_task"], `${c.id} ${task.title}`).toContain(action);
        expect(arg).toBe(task.id);
        const check = action === "schedule_meeting" ? checkScheduleMeeting(c, task.id, "clerk") : checkCompleteCityTask(c, task.id, "clerk");
        expect(check, `${c.id} ${task.title}`).toEqual({ ok: true });
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("seriesSummary", () => {
  it("is null for a single event", () => {
    expect(seriesSummary(S3)).toBeNull();
  });

  it("describes a series' frequency, count and span", () => {
    const series = makeCase({
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" },
        occurrences: Array.from({ length: 13 }, (_, i) => ({
          date: `2027-0${6 + Math.floor(i / 4)}-0${(i % 4) + 1}`,
          availability: { status: "open" as const },
          billing: "upcoming" as const,
        })),
      },
    });
    const summary = seriesSummary(series)!;
    expect(summary).toContain("Weekly");
    expect(summary).toContain("13 sessions");
  });
});

describe("documentGroups", () => {
  it("groups S3's cards by the department that reviews them", () => {
    const groups = documentGroups(S3);
    const depts = groups.map((g) => g.dept);
    expect(depts).toEqual(["pws", "hl"]); // routing order; the Clerk has no document card on S3
    const hl = groups.find((g) => g.dept === "hl")!;
    expect(hl.cards.some((t) => t.catalogId === "insurance_certificate")).toBe(true);
    expect(hl.cards.some((t) => t.catalogId === "vendor_list")).toBe(true);
    expect(hl.cards.some((t) => t.catalogId === "vendor_health_permit")).toBe(true);
  });

  it("collects all 25 vendor health permits on S6 under Health & Legal", () => {
    const groups = documentGroups(S6);
    const hl = groups.find((g) => g.dept === "hl")!;
    const vendorCards = hl.cards.filter((t) => t.catalogId === "vendor_health_permit");
    expect(vendorCards).toHaveLength(25);
  });

  it("is empty when nothing carries a file or a form yet", () => {
    expect(documentGroups(makeCase())).toEqual([]);
  });
});

describe("reviewSummaries", () => {
  it("lists every department for S3, routed or not, with the viewer's own section flagged", () => {
    const summaries = reviewSummaries(S3, "pws");
    expect(summaries.map((s) => s.dept)).toEqual(["clerk", "pws", "hl"]);
    const clerk = summaries.find((s) => s.dept === "clerk")!;
    expect(clerk.routed).toBe(false);
    expect(clerk.review).toBeNull();
    const pws = summaries.find((s) => s.dept === "pws")!;
    expect(pws.routed).toBe(true);
    expect(pws.isOwn).toBe(true);
    expect(pws.review?.status).toBe("approved_with_conditions");
    expect(pws.conditions.length).toBe(3);
    const hl = summaries.find((s) => s.dept === "hl")!;
    expect(hl.isOwn).toBe(false);
  });

  it("carries S6's fee lines to the department that charged them", () => {
    const summaries = reviewSummaries(S6, "clerk");
    const pws = summaries.find((s) => s.dept === "pws")!;
    expect(pws.feeLines.some((f) => f.label === "Police")).toBe(true);
    expect(pws.feeLines.every((f) => f.kind !== "deposit")).toBe(true);
  });
});

describe("activityActors and filterActivity", () => {
  it("lists S3's activity newest first", () => {
    const items = filterActivity(S3, "all");
    for (let i = 1; i < items.length; i++) expect(items[i - 1].at >= items[i].at).toBe(true);
    expect(items[0].at).toBe(S3.activity.at(-1)!.at);
  });

  it("narrows to one actor", () => {
    const actors = activityActors(S3);
    expect(actors).toContain("applicant");
    expect(actors).toContain("clerk");
    const hlOnly = filterActivity(S3, "hl");
    expect(hlOnly.every((entry) => entry.actor === "hl")).toBe(true);
    expect(hlOnly.length).toBeGreaterThan(0);
  });
});

describe("groupActivityByDay", () => {
  it("groups S3's newest-first activity into consecutive same-day runs, in the same order", () => {
    const items = filterActivity(S3, "all");
    const groups = groupActivityByDay(items);
    expect(groups.flatMap((g) => g.items)).toEqual(items);
    for (const group of groups) for (const item of group.items) expect(item.at.slice(0, 10)).toBe(group.day);
    // Every entry in a group really did fall on that calendar day, and days are never split in two.
    const seenDays = new Set<string>();
    for (const group of groups) {
      expect(seenDays.has(group.day)).toBe(false);
      seenDays.add(group.day);
    }
  });

  it("one entry makes one group of one", () => {
    expect(groupActivityByDay([{ at: "2027-05-03T09:00", actor: "clerk", text: "Noted." }])).toEqual([{ day: "2027-05-03", items: [{ at: "2027-05-03T09:00", actor: "clerk", text: "Noted." }] }]);
  });

  it("empty activity is an empty list of groups", () => {
    expect(groupActivityByDay([])).toEqual([]);
  });
});

describe("lastActedAt and sinceLastActedCount: the 'since you last acted' marker", () => {
  it("S3: the Clerk's own most recent entry, and the entries newer than it", () => {
    const clerkAt = lastActedAt(S3, "clerk");
    expect(clerkAt).not.toBeNull();
    expect(S3.activity.some((a) => a.at === clerkAt && a.actor === "clerk")).toBe(true);

    const items = filterActivity(S3, "all");
    const count = sinceLastActedCount(items, clerkAt);
    expect(count).not.toBeNull();
    // Everything above the marker really is newer than the Clerk's last entry, and everything
    // at or below it is not (newest first, so index 0 is the newest).
    for (let i = 0; i < count!; i++) expect(items[i].at > clerkAt!).toBe(true);
    if (count! < items.length) expect(items[count!].at <= clerkAt!).toBe(true);
  });

  it("a role that never acted on the case gets no marker", () => {
    const neverActed = makeCase({ activity: [{ at: "2027-05-01T09:00", actor: "applicant", text: "Started a draft." }] });
    expect(lastActedAt(neverActed, "hl")).toBeNull();
    expect(sinceLastActedCount(filterActivity(neverActed, "all"), null)).toBeNull();
  });

  it("acting most recently leaves nothing new: the count is 0, not null", () => {
    const c = makeCase({
      activity: [
        { at: "2027-05-01T09:00", actor: "applicant", text: "Submitted." },
        { at: "2027-05-02T09:00", actor: "clerk", text: "Accepted as complete." },
      ],
    });
    expect(sinceLastActedCount(filterActivity(c, "all"), lastActedAt(c, "clerk"))).toBe(0);
  });
});

describe("isHoldExpiringTomorrow", () => {
  it("true only while held and expiring on the day right after today", () => {
    expect(isHoldExpiringTomorrow({ status: "held", placedOn: "2027-04-20", expiresOn: "2027-05-04" }, TODAY)).toBe(true);
    expect(isHoldExpiringTomorrow({ status: "held", placedOn: "2027-04-20", expiresOn: "2027-05-10" }, TODAY)).toBe(false);
    expect(isHoldExpiringTomorrow({ status: "held", placedOn: "2027-04-20", expiresOn: null }, TODAY)).toBe(false);
    expect(isHoldExpiringTomorrow({ status: "expired", placedOn: "2027-04-20", expiresOn: "2027-05-04" }, TODAY)).toBe(false);
    expect(isHoldExpiringTomorrow({ status: "none", placedOn: null, expiresOn: null }, TODAY)).toBe(false);
  });

  it("the seed carries at least one case worth checking and never throws for any of them", () => {
    for (const c of cases) expect(() => isHoldExpiringTomorrow(c.dateHold, TODAY)).not.toThrow();
  });
});

describe("openKeyForAction and parseOpenKey", () => {
  it("round-trips a whole-case action with no argument", () => {
    const key = openKeyForAction("issue_permit");
    expect(key).toBe("issue_permit");
    expect(parseOpenKey(key)).toEqual({ action: "issue_permit" });
  });

  it("splits an action from its argument", () => {
    expect(parseOpenKey("review_decide:pws")).toEqual({ action: "review_decide", arg: "pws" });
    expect(parseOpenKey("verify_document:PMT-27-0118:vendor_health_permit:1")).toEqual({
      action: "verify_document",
      arg: "PMT-27-0118:vendor_health_permit:1",
    });
  });
});

describe("openKeyForTask: which panel an action maps to", () => {
  it("maps the Clerk's own confirm_routing task to the confirm_routing panel", () => {
    const task = S4.tasks.find((t) => t.catalogId === "confirm_routing");
    // S4 has not been accepted yet, so there is no confirm_routing task; use S3's instead for a
    // case that has moved past routing, and assert the task is already done (so this exercises
    // the id mapping, not the state).
    expect(task).toBeUndefined();
    const routed = S3.tasks.find((t) => t.catalogId === "confirm_routing")!;
    expect(openKeyForTask(S3, routed, "clerk")).toBe("confirm_routing");
  });

  it("maps a department's own review task to review_decide, with its dept as the argument", () => {
    const review = S5.tasks.find((t) => t.catalogId === "review:hl")!;
    expect(openKeyForTask(S5, review, "hl")).toBe("review_decide:hl");
  });

  it("maps a verify task to the applicant card it checks", () => {
    const c = makeCase({
      id: "PMT-27-0001",
      tasks: [
        makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", owner: "applicant", status: "submitted", reviewer: "hl" }),
        makeTask({ id: "PMT-27-0001:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review" }),
      ],
    });
    const verify = c.tasks[1];
    expect(openKeyForTask(c, verify, "hl")).toBe("verify_document:PMT-27-0001:insurance_certificate");
  });

  it("maps the Clerk's consolidate task to send_quote, or to deny once a reviewer has denied", () => {
    const consolidate = makeTask({ id: "x:consolidate", catalogId: "consolidate", owner: "clerk" });
    expect(openKeyForTask(makeCase(), consolidate, "clerk")).toBe("send_quote");
    const denied = makeTask({ id: "x:consolidate", catalogId: "consolidate", owner: "clerk", payload: { denied: true } });
    expect(openKeyForTask(makeCase(), denied, "clerk")).toBe("deny");
  });

  it("maps a work order to complete_city_task, by its own id", () => {
    const workOrder = S6.tasks.find((t) => t.catalogId.startsWith("work_order:"));
    // S6's work orders are already done by the time the seed replays to May 3, but the mapping
    // only reads the catalogId, so it still resolves.
    expect(workOrder).toBeDefined();
    expect(openKeyForTask(S6, workOrder!, "pws")).toBe(`complete_city_task:${workOrder!.id}`);
  });

  it("opens a reminder for a task that belongs to the applicant or to another department", () => {
    const applicantCard = S5.tasks.find((t) => t.owner === "applicant" && t.status !== "done")!;
    expect(openKeyForTask(S5, applicantCard, "clerk")).toBe("remind:applicant");

    const pwsReview = S5.tasks.find((t) => t.catalogId === "review:pws")!;
    expect(openKeyForTask(S5, pwsReview, "hl")).toBe("remind:pws");
  });
});

describe("resolveOpenKey: what ?task= opens", () => {
  it("takes a task's id, as a link from a list or from Who's up carries it", () => {
    expect(resolveOpenKey(S5, "PMT-27-0097:verify:insurance_certificate", "hl")).toBe("verify_document:PMT-27-0097:insurance_certificate");
    expect(resolveOpenKey(S4, "PMT-27-0126:intake_check", "clerk")).toBe("accept_complete");
  });

  it("takes one of the screen's own open keys as it is", () => {
    expect(resolveOpenKey(S5, "issue_permit", "clerk")).toBe("issue_permit");
    expect(resolveOpenKey(S3, "verify_document:PMT-27-0118:vendor_health_permit:1", "hl")).toBe("verify_document:PMT-27-0118:vendor_health_permit:1");
  });

  it("opens a reminder when the task belongs to somebody else", () => {
    expect(resolveOpenKey(S5, "PMT-27-0097:verify:insurance_certificate", "clerk")).toBe("remind:hl");
  });

  it("opens nothing for a param that is neither", () => {
    expect(resolveOpenKey(S5, null, "clerk")).toBeNull();
    expect(resolveOpenKey(S5, "", "clerk")).toBeNull();
    expect(resolveOpenKey(S5, "PMT-27-0097:no_such_task", "clerk")).toBeNull();
    expect(resolveOpenKey(S5, "not_an_action", "clerk")).toBeNull();
  });

  it("every row of every role's opening queue opens a panel", () => {
    for (const role of ["clerk", "pws", "hl"] as const) {
      for (const row of queueFor(cases, role, TODAY)) {
        expect(resolveOpenKey(row.case, row.task.id, role), `${role}: ${row.task.id}`).not.toBeNull();
      }
    }
  });

  it("the Clerk's Instant exception opens Reconcile and close", () => {
    const picnic = cases.find((c) => c.id === "PMT-27-0017")!; // Brightline Logistics company picnic
    expect(resolveOpenKey(picnic, "PMT-27-0017:instant_exception", "clerk")).toBe("reconcile_close");
  });
});

describe("ownTaskRows: the viewer's open tasks that Your actions has no row for", () => {
  const ctx = { today: TODAY, cases, cfg: DEFAULT_CONFIG };
  const rowsFor = (c: (typeof cases)[number], role: "clerk" | "pws" | "hl") => {
    const open = waitingOn(c, TODAY).find((p) => p.party === role)?.openTasks ?? [];
    return ownTaskRows(c, role, open, availableActions(c, role, ctx)).map((t) => t.title);
  };

  it("S5: Health & Legal's one real action is its check of the insurance; the Clerk's and Public Works & Safety's lists are as they were", () => {
    expect(rowsFor(S5, "hl")).toEqual(["Verify Certificate of insurance"]);
    expect(rowsFor(S5, "clerk")).toEqual([]);
    expect(rowsFor(S5, "pws")).toEqual([]);
  });

  it("a task whose panel a row already opens is not listed twice: a review, an intake check, the closeout log", () => {
    expect(rowsFor(S4, "clerk")).toEqual([]);
    expect(rowsFor(S6, "pws")).toEqual([]);
    const farmersMarket = cases.find((c) => c.id === "PMT-27-0070")!;
    expect(waitingOn(farmersMarket, TODAY).find((p) => p.party === "pws")?.openTasks.map((t) => t.catalogId)).toEqual(["review:pws"]);
    expect(rowsFor(farmersMarket, "pws")).toEqual([]);
  });

  it("work orders after the permit, and the Clerk's meeting to schedule after accepting a Special event", () => {
    const ultra = cases.find((c) => c.id === "PMT-27-0030")!; // Cascade Trail Runners: Permitted, three work orders open
    expect(rowsFor(ultra, "pws")).toEqual(["Deliver barricades", "Staff police officers", "Close the street"]);
    const f1 = cases.find((c) => c.id === "PMT-27-0121")!; // Downtown Art Walk: Special, Submitted
    const accepted = transition(f1, { type: "accept_complete" }, "clerk", { ...ctx, now: `${TODAY}T09:00` });
    if (!accepted.ok) throw new Error(accepted.reason);
    expect(rowsFor(accepted.case, "clerk")).toEqual(["Schedule the pre-application meeting"]);
  });

  it("on the seed, every open task of a city role is one click away in Your actions: through a row, or through its own button", () => {
    let own = 0;
    for (const c of cases.filter((candidate) => candidate.state !== "draft")) {
      for (const role of ["clerk", "pws", "hl"] as const) {
        const actions = availableActions(c, role, ctx);
        const open = waitingOn(c, TODAY).find((p) => p.party === role)?.openTasks ?? [];
        const rows = ownTaskRows(c, role, open, actions);
        own += rows.length;
        for (const task of open) {
          const key = openKeyForTask(c, task, role);
          if (key === null) continue;
          const byRow = actions.some((a) => a.type === parseOpenKey(key).action);
          expect(byRow !== rows.includes(task), `${c.id} ${role}: ${task.title}`).toBe(true);
        }
      }
    }
    // S5's insurance check, another case's, and Cascade's three work orders.
    expect(own).toBeGreaterThanOrEqual(5);
  });
});

describe("one name per step: a city task starts with the words on the button that finishes it", () => {
  const ctx = { today: TODAY, cases, cfg: DEFAULT_CONFIG };
  const STEPS: [catalogId: keyof typeof CITY_TASKS, button: string][] = [
    ["intake_check", "Accept as complete"],
    ["confirm_routing", "Confirm routing"],
    ["consolidate", "Send quote"],
    ["issue_permit", "Issue permit"],
    ["cleanup_inspection", "Log closeout"],
    ["log_actual_hours", "Log closeout"],
    ["reconcile", "Reconcile and close"],
    ["instant_exception", "Reconcile and close"],
  ];

  it.each(STEPS)("%s is titled for \"%s\"", (catalogId, button) => {
    expect(CITY_TASKS[catalogId].title.startsWith(button), CITY_TASKS[catalogId].title).toBe(true);
  });

  it("on the seed, each of those tasks carries the catalogue's title, and its owner's Your actions has a row with those words", () => {
    const seen = new Set<string>();
    for (const c of cases.filter((candidate) => candidate.ending === null)) {
      for (const [catalogId, button] of STEPS) {
        const task = c.tasks.find((t) => t.catalogId === catalogId && t.status !== "done");
        if (!task || task.payload.denied === true) continue;
        expect(task.title, `${c.id} ${catalogId}`).toBe(CITY_TASKS[catalogId].title);
        expect(availableActions(c, task.owner, ctx).map((a) => a.label), `${c.id} ${catalogId}`).toContain(button);
        seen.add(catalogId);
      }
    }
    // Every step but routing is open somewhere on the seed; routing follows an acceptance.
    expect([...seen].sort()).toEqual(STEPS.map(([id]) => id).filter((id) => id !== "confirm_routing").sort());
    const f1 = cases.find((c) => c.id === "PMT-27-0121")!;
    const accepted = transition(f1, { type: "accept_complete" }, "clerk", { ...ctx, now: `${TODAY}T09:00` });
    if (!accepted.ok) throw new Error(accepted.reason);
    expect(accepted.case.tasks.find((t) => t.catalogId === "confirm_routing")?.title).toBe("Confirm routing: reviewers and due dates");
    expect(availableActions(accepted.case, "clerk", ctx).map((a) => a.label)).toContain("Confirm routing");
  });
});

describe("hasNothingToDo", () => {
  it("is true only for an empty action list", () => {
    expect(hasNothingToDo([])).toBe(true);
    expect(hasNothingToDo([{ type: "add_note", label: "Add a note", enabled: true }])).toBe(false);
  });
});

describe("formRows: a card's form as the applicant would read it back", () => {
  it("no card of any seeded case prints a raw object, a raw key or a raw boolean", () => {
    let rows = 0;
    for (const c of cases) {
      for (const group of documentGroups(c)) {
        for (const card of group.cards) {
          for (const row of formRows(card)) {
            rows += 1;
            const where = `${c.id} ${card.title}: ${row.label}`;
            expect(row.value, where).not.toContain("[object");
            for (const item of row.items ?? []) expect(item, where).not.toContain("[object");
            expect(row.value, where).not.toMatch(/^(true|false|undefined|null)$/);
            // A label is words, never a camelCase key.
            expect(row.label, where).toMatch(/^[A-Z]/);
            expect(row.label, where).not.toMatch(/[a-z][A-Z]/);
          }
        }
      }
    }
    expect(rows).toBeGreaterThan(20);
  });

  it("S3's vendor list reads as a list of vendors, in the Health & Legal group", () => {
    const hl = documentGroups(S3).find((g) => g.dept === "hl")!;
    const vendorList = hl.cards.find((t) => t.catalogId === "vendor_list")!;
    expect(formRows(vendorList)).toEqual([
      { label: "Vendors", value: "Rolling Dumpling Co. · Dumplings and noodle bowls", items: ["Rolling Dumpling Co. · Dumplings and noodle bowls"] },
    ]);
  });

  it("S6's vendor list has one line per vendor", () => {
    const vendorList = S6.tasks.find((t) => t.catalogId === "vendor_list")!;
    const [row] = formRows(vendorList);
    expect(row.label).toBe("Vendors");
    expect(row.items).toHaveLength(25);
  });

  it("uses the form's own field labels, 12-hour times and Yes or No", () => {
    const sound = S3.tasks.find((t) => t.catalogId === "sound_details")!;
    expect(formRows(sound)).toEqual([
      { label: "Sound equipment", value: "Two powered speakers on stands, one wireless handheld mic" },
      { label: "Sound check time", value: "5 pm" },
    ]);

    const services = makeTask({
      id: "PMT-27-0001:city_services_request",
      catalogId: "city_services_request",
      kind: "form",
      payload: { form: { barricades: 30, policeOfficers: 6, policeHours: 4, trash: false, power: true } },
    });
    expect(formRows(services)).toEqual([
      { label: "Barricades", value: "30" },
      { label: "Police officers", value: "6" },
      { label: "Police hours", value: "4" },
      { label: "Trash collection", value: "No" },
      { label: "Power hookup", value: "Yes" },
    ]);
  });

  it("a key nobody labelled falls back to its words, and an empty answer says so", () => {
    const card = makeTask({ id: "PMT-27-0001:site_plan", catalogId: "site_plan", kind: "form", payload: { form: { fireExtinguishersOnSite: 2, notes: "" } } });
    expect(formRows(card)).toEqual([
      { label: "Fire extinguishers on site", value: "2" },
      { label: "Site plan notes", value: "Not provided" },
    ]);
  });

  it("a card with no form has no rows", () => {
    expect(formRows(makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate" }))).toEqual([]);
  });
});

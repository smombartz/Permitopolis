import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { buildSeed, checkCompleteCityTask, checkScheduleMeeting, queueFor } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import {
  activityActors,
  buildOverview,
  caseBackLink,
  CASE_TABS,
  documentGroups,
  filterActivity,
  formRows,
  hasNothingToDo,
  headerReviewClock,
  isCaseTab,
  openKeyForAction,
  openKeyForTask,
  parseOpenKey,
  resolveOpenKey,
  reviewSummaries,
  seriesSummary,
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
    const overview = buildOverview(S5, DEFAULT_CONFIG);
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

  it("reads 'Not provided' territory as null for what a minimal case leaves out", () => {
    const draft = makeCase({ description: undefined, location: null, schedule: null, attendance: null });
    const overview = buildOverview(draft, DEFAULT_CONFIG);
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
    const byLabel = Object.fromEntries(buildOverview(s2, DEFAULT_CONFIG).rows.map((r) => [r.label, r.value]));
    expect(byLabel["Sessions"]).toMatch(/^Weekly, 13 sessions/);

    const tents = (count: number) =>
      Object.fromEntries(buildOverview(makeCase({ addOns: { ...S5.addOns, amplifiedSound: false, cityServices: null, tentsStages: { count } } }), DEFAULT_CONFIG).rows.map((r) => [r.label, r.value]))["Add-ons"];
    expect(tents(1)).toBe("1 tent or stage");
    expect(tents(3)).toBe("3 tents or stages");
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

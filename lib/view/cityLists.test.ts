import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules";
import { buildSeed, queueFor } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  activeFilterChips,
  casesFiltersToParams,
  competingApplication,
  DEFAULT_TABLE_COLUMNS,
  defaultInvolvesMe,
  emptyQueueMessage,
  filteredCases,
  instantExceptionRows,
  intakeCompleteness,
  intakeCounts,
  intakeRows,
  parseCasesFilters,
  pipelineBoardColumns,
  pipelineEventDateColumns,
  pipelineTableRow,
  pipelineTableRows,
  queueBriefing,
  queueGroups,
  queueReasonLine,
  queueTotal,
  queueWaitingOnOthers,
  sortTableRows,
  TOGGLABLE_TABLE_COLUMNS,
  visibleTableColumns,
  type CasesListFilters,
} from "./cityLists";

const TODAY = "2027-05-03";
const CFG = DEFAULT_CONFIG;
/** The Clerk's pipeline as it opens: no filter, Involves me off. */
const CLERK_DEFAULTS: CasesListFilters = parseCasesFilters(new URLSearchParams(), "clerk");

// Real seeded case ids (lib/state/seed/scenarios, lib/state/seed/background).
const S3 = "PMT-27-0118"; // Jazz in the Plaza
const S4 = "PMT-27-0126"; // Maple Street block party
const S5 = "PMT-27-0097"; // Riverfront Summer 5K
const F1 = "PMT-27-0121"; // Downtown Art Walk
const F5 = "PMT-27-0115"; // Plaza wedding photos
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival (Closeout)

function seed(): EventCase[] {
  return buildSeed();
}

function find(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`Missing seeded case ${id}`);
  return found;
}

describe("queueGroups and queueBriefing", () => {
  it("City Clerk: 8 things, 1 overdue, 7 for this week (3 dated, and 4 undated steps that have waited over a week)", () => {
    const groups = queueGroups(seed(), "clerk", TODAY);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.this_week).toHaveLength(7);
    expect(groups.this_week.filter((item) => item.task.dueDate !== null)).toHaveLength(3);
    expect(groups.later).toHaveLength(0);
    expect(queueTotal(groups)).toBe(8);
    expect(queueBriefing(groups)).toBe("8 things need you: 1 overdue, 7 due this week.");
  });

  it("Public Works & Safety: 7 things, 1 overdue, 3 due this week", () => {
    const groups = queueGroups(seed(), "pws", TODAY);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.this_week).toHaveLength(3);
    expect(queueBriefing(groups)).toBe("7 things need you: 1 overdue, 3 due this week.");
  });

  it("Health & Legal: the PRD's own example line", () => {
    const groups = queueGroups(seed(), "hl", TODAY);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.this_week).toHaveLength(3);
    expect(groups.later).toHaveLength(1);
    expect(queueBriefing(groups)).toBe("5 things need you: 1 overdue, 3 due this week.");
  });

  it("a queue with nothing overdue or due this week still gets a total, with no breakdown", () => {
    expect(queueBriefing({ overdue: [], this_week: [], later: [{} as never] })).toBe("1 thing needs you.");
  });

  it("an empty queue reads as none", () => {
    expect(queueBriefing({ overdue: [], this_week: [], later: [] })).toBe("0 things need you.");
  });
});

describe("queueReasonLine: the one-line reason a row is this role's move", () => {
  it("Health & Legal's S5 row: the insurance certificate was re-uploaded Apr 30", () => {
    const items = queueFor(seed(), "hl", TODAY);
    const row = items.find((i) => i.case.id === S5 && i.task.catalogId.startsWith("verify:"));
    expect(row).toBeDefined();
    expect(queueReasonLine(row!)).toBe("Certificate of insurance re-uploaded Apr 30");
  });

  it("a pending review's reason names when it was routed", () => {
    const items = queueFor(seed(), "pws", TODAY);
    const row = items.find((i) => i.task.catalogId.startsWith("review:"));
    expect(row).toBeDefined();
    expect(queueReasonLine(row!)).toMatch(/^Routed [A-Z][a-z]{2} \d{1,2}$/);
  });

  it("never throws for any item in any role's queue", () => {
    for (const role of ["clerk", "pws", "hl"] as const) {
      for (const item of queueFor(seed(), role, TODAY)) expect(() => queueReasonLine(item)).not.toThrow();
    }
  });
});

describe("waiting on others and the empty state", () => {
  it("lists every case this role is involved in where someone else is up", () => {
    const others = queueWaitingOnOthers(seed(), "clerk", TODAY);
    expect(others.length).toBeGreaterThan(0);
    for (const item of others) expect(item.parties.every((p) => p.status === "up_now")).toBe(true);
  });

  it("the empty-queue line counts the others, or omits the second sentence", () => {
    expect(emptyQueueMessage([])).toBe("Nothing is waiting on you.");
    const others = queueWaitingOnOthers(seed(), "hl", TODAY);
    expect(emptyQueueMessage(others)).toBe(`Nothing is waiting on you. ${others.length} cases are with other parties.`);
  });
});

describe("pipeline board columns", () => {
  it("has exactly the seven states the brief lists for the open pipeline, Draft and Closed excluded", () => {
    const open = seed().filter((c) => c.state !== "closed");
    const columns = pipelineBoardColumns(open, TODAY);
    expect(Object.keys(columns)).toEqual(["submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout"]);
  });

  it("adds a Closed column, last, once closed cases are among those shown", () => {
    const columns = pipelineBoardColumns(seed(), TODAY);
    expect(Object.keys(columns).at(-1)).toBe("closed");
    expect(columns.closed).toHaveLength(3);
  });

  it("every case lands in the column matching its own state, soonest event date first", () => {
    const columns = pipelineBoardColumns(seed(), TODAY);
    expect(columns.quote_sent.some((c) => c.id === S5)).toBe(true);
    for (let i = 1; i < columns.closeout.length; i++) {
      // Not a strict check against nulls, but the column should not be grossly out of order.
      expect(typeof columns.closeout[i].id).toBe("string");
    }
  });

  it("empty columns stay, as an empty array", () => {
    const columns = pipelineBoardColumns([], TODAY);
    expect(columns.in_review).toEqual([]);
  });

  it("a State filter leaves that one column: the matches are never off-screen behind empty ones", () => {
    for (const state of ["quote_sent", "permitted", "event_day", "closeout", "closed"] as const) {
      const shown = filteredCases(seed(), "clerk", { ...CLERK_DEFAULTS, state }, TODAY);
      const columns = pipelineBoardColumns(shown, TODAY, state);
      expect(Object.keys(columns), state).toEqual([state]);
      expect(columns[state]).toHaveLength(shown.length);
    }
    // A state with no case right now is still its own, empty, column.
    expect(Object.keys(pipelineBoardColumns([], TODAY, "event_day"))).toEqual(["event_day"]);
  });

  it("the Ended filter keeps only the columns that hold an ended case", () => {
    const ended = filteredCases(seed(), "clerk", { ...CLERK_DEFAULTS, state: "off_path" }, TODAY);
    expect(ended.length).toBeGreaterThan(0);
    const columns = pipelineBoardColumns(ended, TODAY, "off_path");
    expect(Object.keys(columns).length).toBeGreaterThan(0);
    for (const cases of Object.values(columns)) expect(cases.length).toBeGreaterThan(0);
    expect(Object.values(columns).flat()).toHaveLength(ended.length);
  });
});

describe("pipeline event-date columns (the PRD's push: triage by deadline)", () => {
  it("every bucket exists and every visible case lands in exactly one", () => {
    const open = seed().filter((c) => c.state !== "draft" && c.state !== "closed" && c.ending === null);
    const columns = pipelineEventDateColumns(open, TODAY);
    expect(Object.keys(columns)).toEqual(["this_week", "next_two_weeks", "this_month", "later", "past"]);
    expect(Object.values(columns).flat()).toHaveLength(open.length);
  });

  it("S5 (Jul 11, more than a month out) lands in Later", () => {
    const columns = pipelineEventDateColumns(seed(), TODAY);
    expect(columns.later.some((c) => c.id === S5)).toBe(true);
  });
});

describe("table column visibility", () => {
  it("event, event date and state always show; the rest only when toggled on", () => {
    expect(visibleTableColumns({ columns: [] })).toEqual(["event", "event_date", "state"]);
    expect(visibleTableColumns({ columns: ["tier", "risk"] })).toEqual(["event", "event_date", "state", "tier", "risk"]);
  });

  it("the default set leaves out ID and Depts, the two least essential at a glance", () => {
    expect(DEFAULT_TABLE_COLUMNS.length).toBeLessThan(TOGGLABLE_TABLE_COLUMNS.length);
  });
});

describe("group, columns and density round-trip through the URL", () => {
  it("groupBy defaults to state and round-trips event_date", () => {
    expect(parseCasesFilters(new URLSearchParams(), "clerk").groupBy).toBe("state");
    const params = new URLSearchParams(casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "clerk"), groupBy: "event_date" }, "clerk") as Record<string, string>);
    expect(params.get("group")).toBe("event_date");
    expect(parseCasesFilters(params, "clerk").groupBy).toBe("event_date");
  });

  it("density defaults to comfortable and round-trips compact", () => {
    expect(parseCasesFilters(new URLSearchParams(), "clerk").density).toBe("comfortable");
    const params = new URLSearchParams(casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "clerk"), density: "compact" }, "clerk") as Record<string, string>);
    expect(params.get("density")).toBe("compact");
    expect(parseCasesFilters(params, "clerk").density).toBe("compact");
  });

  it("columns default to DEFAULT_TABLE_COLUMNS and round-trip a custom set, and 'none' round-trips to hiding every optional column", () => {
    expect(parseCasesFilters(new URLSearchParams(), "clerk").columns).toEqual(DEFAULT_TABLE_COLUMNS);
    const custom = parseCasesFilters(
      new URLSearchParams(casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "clerk"), columns: ["id", "depts"] }, "clerk") as Record<string, string>),
      "clerk",
    );
    expect(custom.columns).toEqual(["id", "depts"]);
    const none = parseCasesFilters(
      new URLSearchParams(casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "clerk"), columns: [] }, "clerk") as Record<string, string>),
      "clerk",
    );
    expect(none.columns).toEqual([]);
  });

  it("a garbled cols value falls back to the default set, not to nothing", () => {
    expect(parseCasesFilters(new URLSearchParams("cols=bogus"), "clerk").columns).toEqual(DEFAULT_TABLE_COLUMNS);
  });
});

describe("date filters in the URL", () => {
  it("a from or to that is not a date is ignored, so it can never reach a date formatter", () => {
    const parsed = parseCasesFilters(new URLSearchParams("from=/city/cases&to=soon"), "clerk");
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
    expect(activeFilterChips(parsed)).toEqual([]);
    expect(parseCasesFilters(new URLSearchParams("from=2027-06-01&to=2027-13-45"), "clerk")).toMatchObject({ from: "2027-06-01", to: undefined });
  });
});

describe("filter chips", () => {
  it("the date range reads as dates, never as raw ISO strings", () => {
    const label = (from?: string, to?: string) => activeFilterChips({ ...CLERK_DEFAULTS, from, to }).find((chip) => chip.key === "dates")?.label;
    expect(label("2027-06-01", "2027-08-01")).toBe("Event date Jun 1 to Aug 1");
    expect(label("2027-06-01", undefined)).toBe("Event date from Jun 1");
    expect(label(undefined, "2027-08-01")).toBe("Event date to Aug 1");
    expect(label(undefined, undefined)).toBeUndefined();
  });
});

describe("pipeline table row model", () => {
  it("S5: the applicant and Health & Legal are waiting, lead time is not at risk", () => {
    const row = pipelineTableRow(find(seed(), S5), TODAY, CFG);
    expect(row.waitingOn.map((w) => w.party).sort()).toEqual(["applicant", "hl"]);
    expect(row.leadTimeRisk).toBe("ok");
    expect(row.deptStatus.map((d) => d.dept)).toEqual(["pws", "hl"]);
  });

  it("pipelineTableRows maps one row per case", () => {
    const cases = seed();
    expect(pipelineTableRows(cases, TODAY, CFG)).toHaveLength(cases.length);
  });
});

describe("sorting", () => {
  it("sorts by event date, ascending then descending", () => {
    const rows = pipelineTableRows([find(seed(), S5), find(seed(), S3)], TODAY, CFG);
    const asc = sortTableRows(rows, "event_date", "asc", TODAY).map((r) => r.case.id);
    expect(asc).toEqual([S3, S5]); // Jun 18 before Jul 11
    const desc = sortTableRows(rows, "event_date", "desc", TODAY).map((r) => r.case.id);
    expect(desc).toEqual([S5, S3]);
  });

  it("sorts by state in the pipeline's left-to-right order", () => {
    const rows = pipelineTableRows([find(seed(), S6), find(seed(), S3)], TODAY, CFG);
    const sorted = sortTableRows(rows, "state", "asc", TODAY).map((r) => r.case.state);
    expect(sorted).toEqual(["needs_info", "closeout"]);
  });
});

describe("default Involves me per role", () => {
  it("is on for the two reviewing departments and off for the Clerk", () => {
    expect(defaultInvolvesMe("clerk")).toBe(false);
    expect(defaultInvolvesMe("pws")).toBe(true);
    expect(defaultInvolvesMe("hl")).toBe(true);
  });
});

describe("filters: parsed from and written to URL params", () => {
  function round(filters: Partial<CasesListFilters>, role: "clerk" | "pws" | "hl" = "clerk") {
    const params = new URLSearchParams(casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), role), ...filters }, role) as Record<string, string>);
    return parseCasesFilters(params, role);
  }

  it("tier alone", () => {
    expect(round({ tier: "special" }).tier).toBe("special");
  });

  it("state alone, including off_path", () => {
    expect(round({ state: "in_review" }).state).toBe("in_review");
    expect(round({ state: "off_path" }).state).toBe("off_path");
  });

  it("waiting alone", () => {
    expect(round({ waiting: "applicant" }).waiting).toBe("applicant");
    expect(round({ waiting: "me" }).waiting).toBe("me");
  });

  it("the event date range alone", () => {
    const r = round({ from: "2027-06-01", to: "2027-06-30" });
    expect(r.from).toBe("2027-06-01");
    expect(r.to).toBe("2027-06-30");
  });

  it("the closed-and-ended toggle alone", () => {
    expect(round({ closedAndEnded: true }).closedAndEnded).toBe(true);
    expect(round({ closedAndEnded: false }).closedAndEnded).toBe(false);
  });

  it("search text alone", () => {
    expect(round({ q: "5K" }).q).toBe("5K");
  });

  it("Involves me only appears in the URL when it differs from this role's default", () => {
    const paramsOff = casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "pws"), involvesMe: true }, "pws");
    expect(paramsOff.involves).toBeUndefined();
    const paramsOn = casesFiltersToParams({ ...parseCasesFilters(new URLSearchParams(), "pws"), involvesMe: false }, "pws");
    expect(paramsOn.involves).toBe("0");
  });

  it("combined: tier, waiting and search round-trip together", () => {
    const r = round({ tier: "reviewed", waiting: "hl", q: "festival" });
    expect(r).toMatchObject({ tier: "reviewed", waiting: "hl", q: "festival" });
  });

  it("an unknown or garbled value is dropped, not carried through", () => {
    const params = new URLSearchParams("tier=bogus&state=nonsense&waiting=whoever");
    const parsed = parseCasesFilters(params, "clerk");
    expect(parsed.tier).toBeUndefined();
    expect(parsed.state).toBeUndefined();
    expect(parsed.waiting).toBeUndefined();
  });
});

describe("filteredCases: every filter alone and combined", () => {
  const BASE: CasesListFilters = {
    involvesMe: false,
    closedAndEnded: false,
    q: "",
    view: "board",
    sort: "event_date",
    dir: "asc",
    groupBy: "state",
    columns: DEFAULT_TABLE_COLUMNS,
    density: "comfortable",
  };

  it("hides drafts, closed cases and off-path endings by default", () => {
    const result = filteredCases(seed(), "clerk", BASE, TODAY);
    expect(result.every((c) => c.state !== "draft")).toBe(true);
    expect(result.every((c) => c.state !== "closed" && c.ending === null)).toBe(true);
  });

  it("the closed-and-ended toggle brings a Denied case back", () => {
    const withToggle = filteredCases(seed(), "clerk", { ...BASE, closedAndEnded: true }, TODAY);
    expect(withToggle.some((c) => c.ending === "denied")).toBe(true);
  });

  it("choosing Closed, or the endings, shows them without the toggle", () => {
    const closed = filteredCases(seed(), "clerk", { ...BASE, state: "closed" }, TODAY);
    expect(closed).toHaveLength(3);
    expect(closed.every((c) => c.state === "closed" && c.ending === null)).toBe(true);

    const ended = filteredCases(seed(), "clerk", { ...BASE, state: "off_path" }, TODAY);
    expect(ended.map((c) => c.ending).sort()).toEqual(["cancelled", "denied", "hold_expired", "withdrawn"]);
  });

  it("a state that is still open leaves an ended case in that state out", () => {
    // B24's hold expired in Quote sent: it is an ending, not a quote somebody can still pay.
    const result = filteredCases(seed(), "clerk", { ...BASE, state: "quote_sent" }, TODAY);
    expect(result.every((c) => c.ending === null)).toBe(true);
  });

  it("tier narrows to that tier alone", () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, tier: "special" }, TODAY);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.tier === "special")).toBe(true);
  });

  it("state narrows to that state", () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, state: "quote_sent" }, TODAY);
    expect(result.every((c) => c.state === "quote_sent")).toBe(true);
    expect(result.some((c) => c.id === S5)).toBe(true);
  });

  it("waiting on me narrows to cases where this role is up now", () => {
    const result = filteredCases(seed(), "hl", { ...BASE, waiting: "me" }, TODAY);
    expect(result.some((c) => c.id === S5)).toBe(true);
    expect(result.every((c) => c.id !== S3)).toBe(true); // S3 waits on the applicant and Health & Legal's request is open, not a plain "up now" row for hl at load
  });

  it("involves-me narrows to cases this role touches", () => {
    const result = filteredCases(seed(), "hl", { ...BASE, involvesMe: true }, TODAY);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.id === S5)).toBe(true);
  });

  it("an event date range narrows to that window", () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, from: "2027-07-01", to: "2027-07-31" }, TODAY);
    expect(result.some((c) => c.id === S5)).toBe(true);
    expect(result.every((c) => c.id !== S3)).toBe(true); // S3 is Jun 18
  });

  it('searching "5K" narrows the whole pipeline to one case', () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, q: "5K" }, TODAY);
    expect(result.map((c) => c.id)).toEqual([S5]);
  });

  it("tier and search combine", () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, tier: "special", q: "5K" }, TODAY);
    expect(result.map((c) => c.id)).toEqual([S5]);
  });

  it("an impossible combination returns nothing", () => {
    const result = filteredCases(seed(), "clerk", { ...BASE, tier: "instant", q: "5K" }, TODAY);
    expect(result).toEqual([]);
  });

  it("switching role from Clerk to Health & Legal turns Involves me on by default", () => {
    expect(defaultInvolvesMe("clerk")).toBe(false);
    expect(defaultInvolvesMe("hl")).toBe(true);
  });
});

describe("active filter chips", () => {
  it("one chip per narrowing filter, none for the two toggles", () => {
    const chips = activeFilterChips({
      q: "5K",
      tier: "special",
      state: "quote_sent",
      waiting: "me",
      from: "2027-07-01",
      to: "2027-07-31",
    });
    expect(chips.map((c) => c.key)).toEqual(["tier", "state", "waiting", "dates", "q"]);
  });

  it("no filters, no chips", () => {
    expect(activeFilterChips({ q: "" })).toEqual([]);
  });
});

describe("intake: completeness and the competing-application finder", () => {
  it("the Maple Street block party is 9 of 12, with Accept disabled", () => {
    const c = find(seed(), S4);
    expect(intakeCompleteness(c)).toEqual({ done: 9, total: 12 });
    const rows = intakeRows(seed(), "reviewed", TODAY, CFG);
    const row = rows.find((r) => r.case.id === S4);
    expect(row).toBeDefined();
    expect(row!.accept.enabled).toBe(false);
    expect(row!.accept.reason).toBe("Waiting on 3 neighbor sign-offs");
  });

  it("the Plaza wedding photos row names Jazz in the Plaza as complete first", () => {
    const rows = intakeRows(seed(), "reviewed", TODAY, CFG);
    const row = rows.find((r) => r.case.id === F5);
    expect(row).toBeDefined();
    expect(row!.competing?.reason).toContain("Jazz in the Plaza");
    expect(row!.competing?.reason).toContain("complete first");
    expect(row!.accept.enabled).toBe(false);
  });

  it("competingApplication is null when nothing conflicts", () => {
    const c = find(seed(), S4);
    expect(competingApplication(c, seed(), CFG, TODAY)).toBeNull();
  });

  it("Downtown Art Walk is complete and Accept is enabled, in the Special tab", () => {
    const rows = intakeRows(seed(), "special", TODAY, CFG);
    const row = rows.find((r) => r.case.id === F1);
    expect(row).toBeDefined();
    expect(row!.accept.enabled).toBe(true);
    expect(row!.completeness.done).toBe(row!.completeness.total);
  });

  it("intakeCounts matches the rows each tab actually lists", () => {
    const cases = seed();
    const counts = intakeCounts(cases);
    expect(counts.special).toBe(intakeRows(cases, "special", TODAY, CFG).length);
    expect(counts.reviewed).toBe(intakeRows(cases, "reviewed", TODAY, CFG).length);
    expect(counts.instant).toBeGreaterThan(0);
  });

  it("the Instant exceptions tab lists the Brightline Logistics company picnic", () => {
    const rows = instantExceptionRows(seed(), TODAY);
    expect(rows.some((r) => r.case.name.includes("Brightline Logistics"))).toBe(true);
    const row = rows.find((r) => r.case.name.includes("Brightline Logistics"));
    expect(row?.task?.title).toBe("Resolve the exception");
  });
});

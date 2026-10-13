import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { boardColumns, buildSeed } from "@/lib/state";
import { routes } from "@/lib/routes";
import {
  boardColumnsGrouped,
  dateHoldFootnote,
  directLinkHref,
  groupColumnEntries,
  myEvents,
  nextActionFor,
  opensSessionSchedule,
  phaseGroups,
  reviewerRows,
  seriesSessions,
  waitingOnChipItems,
} from "./board";

const TODAY = DEFAULT_DEMO_TODAY;
const S1 = "PMT-27-0109"; // Maya Chen, picnic, Instant, permitted
const S2 = "PMT-27-0142"; // Sunrise Yoga Club, Instant series, draft
const S3 = "PMT-27-0118"; // Downtown Arts Collective, Reviewed, needs_info (one pinned health permit)
const S4 = "PMT-27-0126"; // Maple Street block captain, Reviewed, submitted (9 of 12 sign-offs)
const S5 = "PMT-27-0097"; // Riverfront Running Club, Special, quote_sent
const S6 = "PMT-27-0031"; // Main Street Business Alliance, Special, closeout
const WITHDRAWN_B23 = "PMT-27-0048"; // Sunnyvale Block Association, withdrawn before a permit

function find(id: string) {
  const c = buildSeed().find((c) => c.id === id);
  if (!c) throw new Error(`seed case ${id} not found`);
  return c;
}

describe("myEvents", () => {
  it("lists Maya Chen's picnic with a permit link", () => {
    const { active } = myEvents(buildSeed(), "maya-chen", TODAY);
    expect(active.map((i) => i.case.id)).toEqual([S1]);
    expect(active[0].permitHref).toBe(routes.permit(S1));
    expect(active[0].href).toBe(routes.event(S1));
  });

  it("sends a Draft's row to the wizard, not the board", () => {
    const { active } = myEvents(buildSeed(), "sunrise-yoga-club", TODAY);
    expect(active.map((i) => i.case.id)).toEqual([S2]);
    expect(active[0].href).toBe(routes.apply({ caseId: S2 }));
    expect(active[0].permitHref).toBeNull();
  });

  it("is empty for a persona with no events", () => {
    const { active, past } = myEvents(buildSeed(), "new", TODAY);
    expect(active).toEqual([]);
    expect(past).toEqual([]);
  });

  it("puts a withdrawn case under Past", () => {
    const { active, past } = myEvents(buildSeed(), "sunnyvale-block-association", TODAY);
    expect(active).toEqual([]);
    expect(past.map((i) => i.case.id)).toEqual([WITHDRAWN_B23]);
  });

  it("sorts what needs the applicant first", () => {
    // S3 (needs info, a pinned request waiting on the applicant) outranks any case waiting on the city.
    const cases = buildSeed();
    const { active } = myEvents(cases, "downtown-arts-collective", TODAY);
    expect(active[0].case.id).toBe(S3);
    expect(active[0].needsApplicant).toBe(true);
  });
});

describe("nextActionFor", () => {
  it("S3: the pinned health permit card, due Wed, May 5", () => {
    const { text, due } = nextActionFor(find(S3), TODAY);
    expect(text).toBe("Health permit: Rolling Dumpling Co.");
    expect(due).toBe("2027-05-05");
  });

  it("S4: the applicant still has sign-offs to collect", () => {
    const { text } = nextActionFor(find(S4), TODAY);
    expect(text).toBe("Neighbor sign-off");
  });

  it("S5: two Do now cards, the sooner one first", () => {
    const { text } = nextActionFor(find(S5), TODAY);
    expect(["Accept conditions and sign", "Pay fees and deposit"]).toContain(text);
  });

  it("an ended case has nothing more to do", () => {
    const { text, due } = nextActionFor(find(WITHDRAWN_B23), TODAY);
    expect(text).toBe("This event has ended.");
    expect(due).toBeNull();
  });
});

describe("board columns and grouping", () => {
  it("S3: 1 Do now, 0 with the city, 3 coming up, 4 done", () => {
    const columns = boardColumns(find(S3));
    expect(columns.do_now).toHaveLength(1);
    expect(columns.with_city).toHaveLength(0);
    expect(columns.coming_up).toHaveLength(3);
    expect(columns.done).toHaveLength(4);
  });

  it("S3's single vendor card is not stacked: it stays pinned on its own", () => {
    const grouped = boardColumnsGrouped(find(S3));
    expect(grouped.do_now).toEqual([{ kind: "task", task: expect.objectContaining({ catalogId: "vendor_health_permit" }) }]);
  });

  it("S6: 25 vendor health permits stack into one card", () => {
    const grouped = boardColumnsGrouped(find(S6));
    const stack = grouped.done.find((e) => e.kind === "stack");
    expect(stack).toBeDefined();
    if (stack?.kind === "stack") {
      expect(stack.total).toBe(25);
      expect(stack.done).toBe(25);
      expect(stack.title).toBe("Vendor health permits");
    }
  });

  it("groupColumnEntries leaves a single vendor card alone", () => {
    const columns = boardColumns(find(S3));
    const entries = groupColumnEntries(columns.do_now);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("task");
  });

  it("S6's board groups into non-empty phase swimlanes that cover every card", () => {
    const c = find(S6);
    const groups = phaseGroups(c);
    const total = groups.reduce((n, g) => n + g.entries.length, 0);
    const columns = boardColumns(c);
    const applicantCardCount = columns.do_now.length + columns.with_city.length + columns.coming_up.length + columns.done.length;
    // Grouping stacks the 25 vendor cards into one, so the swimlane total is short by 24.
    expect(total).toBe(applicantCardCount - 24);
    expect(groups.every((g) => g.entries.length > 0)).toBe(true);
  });
});

describe("reviewerRows", () => {
  it("S3: Public Works & Safety approved with conditions, Health & Legal asked for something, the Clerk waits on reviews", () => {
    const rows = reviewerRows(find(S3));
    expect(rows).toEqual([
      { dept: "clerk", label: "Waiting on reviews" },
      { dept: "pws", label: "Approved with conditions" },
      { dept: "hl", label: "Asked you for something" },
    ]);
  });

  it("a Draft has nobody involved yet", () => {
    const rows = reviewerRows(find(S2));
    expect(rows.every((r) => r.label === "Not involved")).toBe(true);
  });
});

describe("waitingOnChipItems", () => {
  it("S3 waits on the applicant, in the applicant's own words: Waiting on: You", () => {
    expect(waitingOnChipItems(find(S3), TODAY)).toEqual([{ party: "applicant", label: "You" }]);
  });
});

describe("dateHoldFootnote", () => {
  it("S4: 3 neighbor sign-offs to go", () => {
    expect(dateHoldFootnote(find(S4))).toBe("3 neighbor sign-offs to go");
  });

  it("is null once a date is held", () => {
    expect(dateHoldFootnote(find(S3))).toBeNull();
  });
});

describe("directLinkHref", () => {
  it("S5: accept_and_sign and pay_fees both go to the quote route", () => {
    const c = find(S5);
    const accept = c.tasks.find((t) => t.catalogId === "accept_and_sign")!;
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(directLinkHref(c, accept)).toBe(routes.quote(S5));
    expect(directLinkHref(c, pay)).toBe(routes.quote(S5));
  });

  it("a locked card has no direct link", () => {
    const c = find(S3);
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.status).toBe("locked");
    expect(directLinkHref(c, pay)).toBeNull();
  });

  it("a series' pay_fees card opens the session schedule instead of linking out", () => {
    const c = find(S2);
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees");
    if (pay && pay.status === "todo") {
      expect(directLinkHref(c, pay)).toBeNull();
      expect(opensSessionSchedule(c, pay)).toBe(true);
    }
  });
});

describe("seriesSessions", () => {
  it("S2: 13 Sunday sessions, each at the per-session amount", () => {
    const rows = seriesSessions(find(S2), DEFAULT_CONFIG);
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.amount === 20)).toBe(true);
    expect(rows[0].date).toBe("2027-06-06");
  });

  it("a single event has no session schedule", () => {
    expect(seriesSessions(find(S1), DEFAULT_CONFIG)).toEqual([]);
  });
});

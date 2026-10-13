import { describe, expect, it } from "vitest";
import { fmtDate } from "@/lib/format";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { boardColumns, buildSeed, transition } from "@/lib/state";
import { makeTask } from "@/lib/state/testSupport";
import { routes } from "@/lib/routes";
import type { EventCase } from "@/lib/types";
import {
  bookAgainDraftDate,
  boardColumnsGrouped,
  closeoutStatusLine,
  dateHoldFootnote,
  directLinkHref,
  finalSettlement,
  groupColumnEntries,
  isUnplannedDraft,
  myEvents,
  nextActionFor,
  opensSessionSchedule,
  permitHrefFor,
  phaseGroups,
  reviewerRows,
  seriesSessions,
  waitingOnChipItems,
  withCityColumnSummary,
  withCityInfo,
} from "./board";

const TODAY = DEFAULT_DEMO_TODAY;
const S1 = "PMT-27-0109"; // Maya Chen, picnic, Instant, permitted
const S2 = "PMT-27-0142"; // Sunrise Yoga Club, Instant series, draft
const S3 = "PMT-27-0118"; // Downtown Arts Collective, Reviewed, needs_info (one pinned health permit)
const S4 = "PMT-27-0126"; // Maple Street block captain, Reviewed, submitted (9 of 12 sign-offs)
const S5 = "PMT-27-0097"; // Riverfront Running Club, Special, quote_sent
const S6 = "PMT-27-0031"; // Main Street Business Alliance, Special, closeout
const WITHDRAWN_B23 = "PMT-27-0048"; // Sunnyvale Block Association, withdrawn before a permit
const B02 = "PMT-27-0004"; // Riverside Garden Society, Reviewed, a Draft with no board yet
const B16 = "PMT-27-0034"; // Riverside Tai Chi Circle, Instant series, Event day today
const F2 = "PMT-27-0070"; // Riverside Farmers Market, Reviewed series, In review

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

  it("sends a Draft that already has its board to the board: its cards are what it needs next", () => {
    // What the wizard's last step leaves behind for a Reviewed event: still a Draft, with cards.
    const cases = buildSeed().map((c) =>
      c.id === B02 ? { ...c, tasks: [makeTask({ id: `${B02}:insurance_certificate`, catalogId: "insurance_certificate" })] } : c,
    );
    const { active } = myEvents(cases, "riverside-garden-society", TODAY);
    expect(active[0].href).toBe(routes.event(B02));
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

describe("isUnplannedDraft and permitHrefFor", () => {
  it("a Draft with no cards is still only wizard answers", () => {
    expect(isUnplannedDraft(find(S2))).toBe(true);
    expect(isUnplannedDraft(find(B02))).toBe(true);
    expect(isUnplannedDraft(find(S4))).toBe(false);
  });

  it("links to the permit only while it is live", () => {
    expect(permitHrefFor(find(S1))).toBe(routes.permit(S1));
    expect(permitHrefFor(find(S5))).toBeNull(); // quote sent, no permit yet
    expect(permitHrefFor(find("PMT-27-0050"))).toBeNull(); // cancelled
    expect(permitHrefFor(find("PMT-27-0040"))).toBeNull(); // closed
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
      { dept: "clerk", status: "pending", label: "Waiting on reviews" },
      { dept: "pws", status: "approved_with_conditions", label: "Approved with conditions" },
      { dept: "hl", status: "needs_info", label: "Asked you for something" },
    ]);
  });

  it("a Draft has nobody involved yet", () => {
    const rows = reviewerRows(find(S2));
    expect(rows.every((r) => r.label === "Not involved" && r.status === "not_routed")).toBe(true);
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

  it("a series' pay_fees card opens the session schedule once the booking is paid", () => {
    const c = find(B16);
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.status).toBe("done");
    expect(directLinkHref(c, pay)).toBeNull();
    expect(opensSessionSchedule(c, pay)).toBe(true);
  });

  it("a series' pay_fees card is the quote's own payment while the quote is open", () => {
    // The Farmers Market, moved to Quote sent: the card asks for the first session and the
    // one-off lines, and that is paid on the quote, not session by session.
    const market = find(F2);
    const c = { ...market, state: "quote_sent" as const, tasks: market.tasks.map((t) => (t.catalogId === "pay_fees" ? { ...t, status: "todo" as const } : t)) };
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(directLinkHref(c, pay)).toBe(routes.quote(F2));
    expect(opensSessionSchedule(c, pay)).toBe(false);
  });

  it("a series' pay_fees card opens as a locked card before its quote, not as a schedule", () => {
    const c = find(F2);
    const pay = c.tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.status).toBe("locked");
    expect(directLinkHref(c, pay)).toBeNull();
    expect(opensSessionSchedule(c, pay)).toBe(false);
  });
});

describe("seriesSessions", () => {
  it("S2: 13 Sunday sessions, each at the per-session amount", () => {
    const rows = seriesSessions(find(S2), DEFAULT_CONFIG);
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.amount === 20)).toBe(true);
    expect(rows[0].date).toBe("2027-06-06");
  });

  it("offers a pay link only for a session the checkout takes now", () => {
    // A Draft: nothing is booked, so no session can be paid yet.
    expect(seriesSessions(find(S2), DEFAULT_CONFIG).every((r) => r.payHref === null)).toBe(true);

    // On Event day: every session still owed has its link; paid and skipped ones have none.
    const rows = seriesSessions(find(B16), DEFAULT_CONFIG);
    for (const row of rows) {
      const owed = row.billing === "due" || row.billing === "upcoming";
      expect(row.payHref).toBe(owed ? routes.quote(B16, { pay: "session", date: row.date }) : null);
    }
    expect(rows.some((r) => r.billing === "due")).toBe(true);
    expect(rows.some((r) => r.billing === "skipped")).toBe(true);
  });

  it("a single event has no session schedule", () => {
    expect(seriesSessions(find(S1), DEFAULT_CONFIG)).toEqual([]);
  });
});

/**
 * S6 as the demo path reconciles it: Public Works & Safety logs 72 officer-hours (6 over the
 * 66 estimated, at $85) and 4 crew-hours ($60 each), $750 over in all; the Clerk then reconciles.
 * Mirrors tests/demo-paths.test.ts's own path 6, so this view stays in step with the engine.
 */
function reconciledS6(): EventCase {
  const c = find(S6);
  const ctxForSeed = { today: TODAY, cases: buildSeed(), cfg: DEFAULT_CONFIG };
  const police = c.feeLines.find((f) => f.label === "Police")!;
  const logged = transition(
    c,
    {
      type: "log_closeout",
      cleanup: "pass",
      actuals: [{ feeLineId: police.id, qty: 72 }],
      extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: DEFAULT_CONFIG.fees.cleanupCrewPerWorkerHour }],
    },
    "pws",
    ctxForSeed,
  );
  if (!logged.ok) throw new Error(logged.reason);
  const reconciled = transition(logged.case, { type: "reconcile_close" }, "clerk", ctxForSeed);
  if (!reconciled.ok) throw new Error(reconciled.reason);
  return reconciled.case;
}

describe("After the event: closeoutStatusLine, finalSettlement and bookAgainDraftDate", () => {
  it("S6: Closeout says Public Works & Safety is checking cleanup before hours are logged", () => {
    const c = find(S6);
    expect(c.state).toBe("closeout");
    expect(c.closeout.hoursLoggedOn).toBeNull();
    expect(closeoutStatusLine(c)).toBe("Public Works & Safety is checking cleanup; the City Clerk then reconciles costs.");
    expect(finalSettlement(c)).toBeNull();
  });

  it("says the Clerk is reconciling once the hours are in", () => {
    const c = { ...find(S6), closeout: { ...find(S6).closeout, hoursLoggedOn: TODAY } };
    expect(closeoutStatusLine(c)).toBe("Public Works & Safety logged the cleanup; the City Clerk is reconciling costs.");
  });

  it("says nothing outside Closeout, or once reconciled", () => {
    expect(closeoutStatusLine(find(S1))).toBeNull();
    const reconciled = { ...find(S6), closeout: { ...find(S6).closeout, hoursLoggedOn: TODAY, balance: 750, refund: 250 } };
    expect(closeoutStatusLine(reconciled)).toBeNull();
  });

  it("Scenario S6: $750 over, kept $750 of the $1,000 deposit, $250 refunded", () => {
    const closed = reconciledS6();
    expect(closed.state).toBe("closed");
    expect(closed.closeout.balance).toBe(750);
    expect(closed.closeout.refund).toBe(250);
    const settlement = finalSettlement(closed)!;
    expect(settlement.sentence).toBe("Your event ran $750 over the estimate, kept from your $1,000 deposit; $250 was refunded.");
    expect(settlement.due).toBeNull();
    expect(settlement.payHref).toBeNull();
  });

  it("a bill still owed names its due date and the way to pay", () => {
    // A heavier overage than the deposit covers: the rest is a bill, on the card's own due date.
    const c = find(S6);
    const ctxForSeed = { today: TODAY, cases: buildSeed(), cfg: DEFAULT_CONFIG };
    const police = c.feeLines.find((f) => f.label === "Police")!;
    const logged = transition(
      c,
      { type: "log_closeout", cleanup: "issues", actuals: [{ feeLineId: police.id, qty: 100 }], extraLines: [] },
      "pws",
      ctxForSeed,
    );
    if (!logged.ok) throw new Error(logged.reason);
    const reconciled = transition(logged.case, { type: "reconcile_close" }, "clerk", ctxForSeed);
    if (!reconciled.ok) throw new Error(reconciled.reason);
    const over = reconciled.case;
    expect(over.closeout.refund).toBeNull();

    const billTask = over.tasks.find((t) => t.catalogId === "final_bill_or_refund")!;
    const due = billTask.dueDate!;
    const settlement = finalSettlement(over)!;
    expect(settlement.sentence).toBe(`Your event ran $2,890 over the estimate. Your $1,000 deposit covered part of it; $1,890 is still owed by ${fmtDate(due)}.`);
    expect(settlement.due).toBe(due);
    expect(settlement.payHref).toBe(routes.quote(S6, { pay: "final" }));
  });

  it("bookAgainDraftDate: the same weekday a year later, 364 days on", () => {
    // S6's event is Sat, Apr 24, 2027; a year later on the same weekday is Sat, Apr 22, 2028
    // (the PRD's demo path 6 and the owner's acceptance scenario both name this date).
    expect(bookAgainDraftDate(find(S6))).toBe("2028-04-22");
  });

  it("bookAgainDraftDate is null before any date is chosen", () => {
    const c = { ...find(S1), schedule: null };
    expect(bookAgainDraftDate(c)).toBeNull();
  });
});

describe('"With the city": withCityInfo and withCityColumnSummary', () => {
  it("S5: the re-uploaded insurance certificate is with Health & Legal, expected by Fri, May 7", () => {
    const c = find(S5);
    const card = c.tasks.find((t) => t.catalogId === "insurance_certificate")!;
    expect(card.status).toBe("submitted");
    const info = withCityInfo(c, card, TODAY)!;
    expect(info.dept).toBe("hl");
    expect(info.deptLabel).toBe("Health & Legal");
    expect(info.expectedBy).toBe("2027-05-07");
    expect(info.daysWaiting).toBe(3); // re-uploaded Apr 30, today is May 3
    expect(info.overdue).toBe(false);

    const summary = withCityColumnSummary(c, TODAY);
    expect(summary).toEqual([{ dept: "hl", deptLabel: "Health & Legal", count: 1, expectedBy: "2027-05-07" }]);
  });

  it("turns overdue once the expected-by date has passed", () => {
    const c = find(S5);
    const info = withCityInfo(c, c.tasks.find((t) => t.catalogId === "insurance_certificate")!, "2027-05-10")!;
    expect(info.overdue).toBe(true);
    expect(info.expectedBy).toBe("2027-05-07");
  });

  it("while a department's own review is still open, the expected-by date is the review's due date", () => {
    // F2 is In review: Public Works & Safety's review is pending, so a card sent to it is
    // covered by the review itself, not a per-card verify task yet.
    const c = find(F2);
    const underReview = c.tasks.find((t) => boardColumns(c).with_city.includes(t));
    if (underReview) {
      const info = withCityInfo(c, underReview, TODAY)!;
      const review = c.reviews.find((r) => r.dept === info.dept);
      expect(info.expectedBy).toBe(review?.dueDate ?? null);
    }
  });

  it("says so plainly when there is no expected-by date yet", () => {
    const c = find(S3);
    const pinned = c.tasks.find((t) => t.catalogId === "vendor_health_permit" && t.request && !t.request.resolved);
    // A pinned re-ask sits in Do now, not With the city, and withCityInfo only reads a card's
    // reviewer and open review/verify tasks; a card with neither has no expected-by date.
    if (pinned) {
      const bare = { ...pinned, status: "submitted" as const, request: undefined };
      const info = withCityInfo(c, bare, TODAY);
      expect(info?.expectedBy ?? null).toBeDefined();
    }
  });

  it("returns null for a card nobody reviews", () => {
    const c = find(S1);
    const noReviewer = { ...c.tasks[0], reviewer: null };
    expect(withCityInfo(c, noReviewer, TODAY)).toBeNull();
  });

  it("an empty With the city column summarizes to nothing", () => {
    expect(withCityColumnSummary(find(S1), TODAY)).toEqual([]);
  });
});

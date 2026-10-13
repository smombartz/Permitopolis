/**
 * The shared building blocks against the real seed: every one of the 38 seeded cases is put
 * through the components a screen will build its views from, fed straight from the selectors
 * in "@/lib/state". The components were built against hand-made fixtures and the seed against
 * the engine; this is where the two meet, including the stress rows (a 101-character name, a
 * Draft with only a name, 25 vendor cards, a case with one activity entry and one with 30).
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ActivityTimeline,
  CaseHeader,
  ConditionList,
  DeptStatusDots,
  EndingBanner,
  EventTitle,
  FeeTable,
  LeadTimeRisk,
  TaskCard,
  WhoIsUp,
} from "@/components/domain";
import { PERSONA_BY_ID } from "@/lib/data/people";
import { fmtDateShort, fmtMoney } from "@/lib/format";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { boardColumns, buildSeed, caseTotals, eventDate, leadTimeRisk, nextMove, reviewClock, waitingOn, whoIsUp } from "@/lib/state";
import { SEED_SCRIPTS } from "@/lib/state/seed";
import { DEPTS, PARTY_LABEL, type EventCase } from "@/lib/types";

const TODAY = DEFAULT_DEMO_TODAY;
const seed = buildSeed();

function seeded(key: string): EventCase {
  const id = SEED_SCRIPTS.find((script) => script.key === key)?.id;
  const found = seed.find((c) => c.id === id);
  if (!found) throw new Error(`no seeded case for ${key}`);
  return found;
}

const applicantName = (c: EventCase) => PERSONA_BY_ID[c.applicantId].name;

/** The first department with a running review clock, mapped to CaseHeader's prop. */
function headerClock(c: EventCase) {
  for (const dept of DEPTS) {
    const clock = reviewClock(c, dept, TODAY);
    if (clock) return { dayCount: clock.day, allowedDays: clock.of, paused: clock.paused, pausedDays: clock.pausedDays };
  }
  return null;
}

function CaseView({ c }: { c: EventCase }) {
  const columns = boardColumns(c);
  return (
    <>
      <CaseHeader
        name={c.name}
        tier={c.tier}
        caseId={c.id}
        applicantName={applicantName(c)}
        eventDate={eventDate(c, TODAY)}
        today={TODAY}
        state={c.state}
        ending={c.ending}
        hold={c.dateHold}
        reviewClock={headerClock(c)}
      />
      {c.ending ? <EndingBanner ending={c.ending} reason={c.endingReason} /> : null}
      <EventTitle name={c.name} applicantName={applicantName(c)} />
      <LeadTimeRisk risk={leadTimeRisk(c, TODAY, DEFAULT_CONFIG)} />
      <DeptStatusDots items={c.reviews.map((review) => ({ dept: review.dept, status: review.status }))} />
      <WhoIsUp items={waitingOn(c, TODAY)} today={TODAY} nextMove={nextMove(c, TODAY, applicantName(c))} applicantName={applicantName(c)} />
      <div data-testid="board">
        {[...columns.do_now, ...columns.with_city, ...columns.coming_up, ...columns.done].map((task) => (
          <TaskCard key={task.id} task={task} today={TODAY} />
        ))}
      </div>
      <FeeTable lines={c.feeLines} showActual={c.state === "closeout" || c.state === "closed"} />
      <ConditionList conditions={c.conditions} />
      <ActivityTimeline items={c.activity} collapsedCount={5} />
    </>
  );
}

describe("shared components against every seeded case", () => {
  it.each(seed.map((c) => [c.id, c.name, c] as const))("%s %s", (_id, _name, c) => {
    const { container } = render(<CaseView c={c} />);

    // Header: the event, its id and the state it is in.
    expect(screen.getByRole("heading", { level: 1, name: c.name })).toBeInTheDocument();
    expect(within(container.querySelector('[data-slot="case-header"]') as HTMLElement).getByText(c.id)).toBeInTheDocument();

    // Who's up: under its heading, four rows, the same parties highlighted as the selector names
    // and listed first.
    expect(screen.getByRole("heading", { level: 2, name: "Who's up" })).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Who's up" }))
      .getAllByRole("listitem")
      .filter((row) => row.hasAttribute("data-status"));
    const upRows = rows.filter((row) => row.getAttribute("data-status") === "up_now");
    expect(rows).toHaveLength(4);
    expect(upRows.map((row) => row.getAttribute("data-party"))).toEqual(whoIsUp(c, TODAY));
    expect(rows.slice(0, upRows.length)).toEqual(upRows);
    for (const party of whoIsUp(c, TODAY)) {
      expect(upRows.some((row) => within(row).queryAllByText(PARTY_LABEL[party]).length > 0), party).toBe(true);
    }
    // The applicant's row says who the applicant is.
    const applicantRow = rows.find((row) => row.getAttribute("data-party") === "applicant") as HTMLElement;
    expect(within(applicantRow).getByText(applicantName(c))).toBeInTheDocument();
    expect(screen.getByText(nextMove(c, TODAY, applicantName(c)))).toBeInTheDocument();
    // A waiting party's row names the task that waits, over what it waits for.
    for (const party of waitingOn(c, TODAY)) {
      if (!party.nextTask) continue;
      const row = rows.find((candidate) => candidate.getAttribute("data-party") === party.party) as HTMLElement;
      expect(within(row).getByText(party.nextTask.title), party.party).toBeInTheDocument();
      expect(within(row).getByText(party.note), party.party).toBeInTheDocument();
    }

    // The board: one card for each of the applicant's tasks. A case that ended keeps only what was done.
    const applicantTasks = c.tasks.filter((task) => task.owner === "applicant" && (c.ending === null || task.status === "done"));
    expect(container.querySelectorAll('[data-slot="task-card"]')).toHaveLength(applicantTasks.length);
    if (c.ending) expect(container.querySelectorAll('[data-slot="task-card"]:not([data-status="done"])')).toHaveLength(0);

    // Reviews: one marker per routed department, with the words behind it.
    expect(container.querySelectorAll('[data-slot="dept-status-dots"] [data-dept]')).toHaveLength(c.reviews.length);

    // Fees: a row per fee line, and no NaN anywhere on the page.
    expect(container.querySelectorAll('[data-slot="fee-table"] tbody tr')).toHaveLength(c.feeLines.filter((line) => line.kind !== "deposit").length);
    expect(container.textContent).not.toMatch(/NaN|undefined|Invalid/);

    // An ended case says how it ended.
    if (c.ending && c.endingReason) expect(screen.getAllByText(c.endingReason).length).toBeGreaterThan(0);
  });
});

describe("what the scenarios show through the shared components", () => {
  it("S5: Who's up lists both of the applicant's open actions and Health & Legal's check, each with its due date", () => {
    const s5 = seeded("S5");
    render(<WhoIsUp items={waitingOn(s5, TODAY)} today={TODAY} nextMove={nextMove(s5, TODAY, applicantName(s5))} applicantName={applicantName(s5)} />);

    // The two parties that are up come first, as in the wireframe; then the Clerk, then Public Works & Safety.
    const rows = screen.getAllByRole("listitem").filter((row) => row.hasAttribute("data-status"));
    expect(rows.map((row) => row.getAttribute("data-party"))).toEqual(["applicant", "hl", "clerk", "pws"]);
    const [applicant, hl, clerk, pws] = rows;
    expect(screen.getByText("Waiting on: applicant, Health & Legal")).toBeInTheDocument();

    expect(within(applicant).getByText("Up now")).toBeInTheDocument();
    expect(within(applicant).getByText("Riverfront Running Club")).toBeInTheDocument();
    expect(within(applicant).getAllByRole("listitem")).toHaveLength(2);
    expect(within(applicant).getAllByText(new RegExp(fmtDateShort("2027-05-14"))).length).toBeGreaterThan(0);
    expect(within(applicant).getByText("3 days holding")).toBeInTheDocument();
    expect(within(hl).getByText("Up now")).toBeInTheDocument();
    expect(within(hl).getByText(new RegExp(fmtDateShort("2027-05-07")))).toBeInTheDocument();
    // "Issue permit / Unlocks when paid and verified", and the Clerk as the owner of the case.
    expect(within(clerk).getByText("Waiting")).toBeInTheDocument();
    expect(within(clerk).getByText("Issue permit")).toBeInTheDocument();
    expect(within(clerk).getByText("Unlocks when paid and verified")).toBeInTheDocument();
    expect(within(clerk).getByText("Intake, routing, quote, permit and closeout")).toBeInTheDocument();
    expect(within(pws).getByText("Done for now")).toBeInTheDocument();
    expect(within(pws).getByText("Approved with conditions")).toBeInTheDocument();
  });

  it("S3: the Clerk is waiting on reviews, and the applicant has held the request for 3 days", () => {
    const s3 = seeded("S3");
    render(<WhoIsUp items={waitingOn(s3, TODAY)} today={TODAY} nextMove={nextMove(s3, TODAY, applicantName(s3))} applicantName={applicantName(s3)} />);

    const row = (party: string) => screen.getAllByRole("listitem").find((candidate) => candidate.getAttribute("data-party") === party) as HTMLElement;
    expect(screen.getByText("Waiting on: applicant")).toBeInTheDocument();
    expect(within(row("applicant")).getByText("Downtown Arts Collective")).toBeInTheDocument();
    expect(within(row("applicant")).getByText("3 days holding")).toBeInTheDocument();
    expect(within(row("clerk")).getByText("Waiting")).toBeInTheDocument();
    expect(within(row("clerk")).getByText("Send quote: consolidate the reviews")).toBeInTheDocument();
    expect(within(row("clerk")).getByText("Unlocks when every review is in")).toBeInTheDocument();
  });

  it("S4: the applicant's row reads 20 days holding", () => {
    const s4 = seeded("S4");
    render(<WhoIsUp items={waitingOn(s4, TODAY)} today={TODAY} nextMove={nextMove(s4, TODAY, applicantName(s4))} applicantName={applicantName(s4)} />);
    const applicant = screen.getAllByRole("listitem").find((candidate) => candidate.getAttribute("data-party") === "applicant") as HTMLElement;
    expect(within(applicant).getByText("Maple Street block captain")).toBeInTheDocument();
    expect(within(applicant).getByText("20 days holding")).toBeInTheDocument();
  });

  it("S5: coming up shows the coordination meeting on Mon, Jun 21 and the walkthrough on Fri, Jul 2", () => {
    const s5 = seeded("S5");
    const comingUp = boardColumns(s5).coming_up;
    const { container } = render(
      <>
        {comingUp.map((task) => (
          <TaskCard key={task.id} task={task} today={TODAY} unlockHint="Unlocks when your permit is issued" />
        ))}
      </>,
    );
    const cardOf = (title: string) => [...container.querySelectorAll<HTMLElement>('[data-slot="task-card"]')].find((card) => within(card).queryByText(title)) as HTMLElement;
    expect(within(cardOf("Coordination meeting")).getByText("Scheduled for Mon, Jun 21")).toBeInTheDocument();
    expect(within(cardOf("Site walkthrough")).getByText("Scheduled for Fri, Jul 2")).toBeInTheDocument();
    // The plan's default date for the meeting (Fri, Jun 18) is gone from the card.
    expect(within(cardOf("Coordination meeting")).queryByText(/Jun 18/)).not.toBeInTheDocument();
    // "Carry your permit" is for the day of the race.
    expect(within(cardOf("Carry your permit")).getByText("Sun, Jul 11")).toBeInTheDocument();
  });

  it("S3: a locked card shows its day and a done card the day it was done, as in the wireframe", () => {
    const s3 = seeded("S3");
    const columns = boardColumns(s3);
    const { container } = render(
      <>
        {[...columns.coming_up, ...columns.done].map((task) => (
          <TaskCard key={task.id} task={task} today={TODAY} />
        ))}
      </>,
    );
    const cardOf = (title: string) => [...container.querySelectorAll<HTMLElement>('[data-slot="task-card"]')].find((card) => within(card).queryByText(title)) as HTMLElement;
    expect(within(cardOf("Carry your permit")).getByText("Fri, Jun 18")).toBeInTheDocument();
    expect(within(cardOf("Submit application")).getByText("Done Apr 16")).toBeInTheDocument();
    expect(within(cardOf("Certificate of insurance")).getByText("Done Apr 21")).toBeInTheDocument();
    expect(within(cardOf("Sound details")).getByText("Done Apr 28")).toBeInTheDocument();
    expect(within(cardOf("Vendor list")).getByText("Done Apr 30")).toBeInTheDocument();
  });

  it("S3: the review markers say in words what each department decided, without leaning on color", async () => {
    const s3 = seeded("S3");
    render(<DeptStatusDots items={s3.reviews.map((review) => ({ dept: review.dept, status: review.status }))} />);
    expect(screen.getByRole("img", { name: "Reviews: Public Works & Safety: Approved with conditions; Health & Legal: Asked for more information" })).toBeInTheDocument();
  });

  it("S3: the pinned request card shows Health & Legal's message and the request's own due date", () => {
    const s3 = seeded("S3");
    const [pinned] = boardColumns(s3).do_now;
    render(<TaskCard task={pinned} today={TODAY} />);

    expect(screen.getByText("Health & Legal asks:")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(fmtDateShort("2027-05-05")))).toBeInTheDocument();
  });

  it("S4: the sign-off card shows 9 of 12 neighbors", () => {
    const s4 = seeded("S4");
    const signoff = boardColumns(s4).do_now.find((task) => task.kind === "sign_off");
    render(<TaskCard task={signoff!} today={TODAY} />);
    expect(screen.getByText("9 of 12 neighbors")).toBeInTheDocument();
  });

  it("S5: the fee table's total is the quote the engine asks for", () => {
    const s5 = seeded("S5");
    const { container } = render(<FeeTable lines={s5.feeLines} />);
    expect(fmtMoney(caseTotals(s5).total)).toBe("$6,530");
    expect(container.textContent).toContain("Total$6,530");
  });

  it("B01: a Draft with only a name has a header with no date", () => {
    const b01 = seeded("B01");
    expect(eventDate(b01, TODAY)).toBeNull();
    render(<CaseView c={b01} />);
    expect(screen.getByText("No date yet")).toBeInTheDocument();
  });
});

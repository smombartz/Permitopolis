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
      <WhoIsUp items={waitingOn(c, TODAY)} today={TODAY} nextMove={nextMove(c, TODAY, applicantName(c))} />
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

    // Who's up: four rows, the same parties highlighted as the selector names.
    const rows = within(screen.getByRole("list", { name: "Who's up" })).getAllByRole("listitem");
    const upRows = rows.filter((row) => row.getAttribute("data-status") === "up_now");
    expect(rows.filter((row) => row.hasAttribute("data-status"))).toHaveLength(4);
    expect(upRows).toHaveLength(whoIsUp(c, TODAY).length);
    for (const party of whoIsUp(c, TODAY)) {
      expect(upRows.some((row) => within(row).queryAllByText(PARTY_LABEL[party]).length > 0), party).toBe(true);
    }
    expect(screen.getByText(nextMove(c, TODAY, applicantName(c)))).toBeInTheDocument();

    // The board: one card for each of the applicant's tasks.
    const applicantTasks = c.tasks.filter((task) => task.owner === "applicant");
    expect(container.querySelectorAll('[data-slot="task-card"]')).toHaveLength(applicantTasks.length);

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
    render(<WhoIsUp items={waitingOn(s5, TODAY)} today={TODAY} nextMove={nextMove(s5, TODAY, applicantName(s5))} />);

    const [applicant, clerk, pws, hl] = screen.getAllByRole("listitem").filter((row) => row.hasAttribute("data-status"));
    expect(within(applicant).getByText("Up now")).toBeInTheDocument();
    expect(within(applicant).getAllByRole("listitem")).toHaveLength(2);
    expect(within(applicant).getAllByText(new RegExp(fmtDateShort("2027-05-14"))).length).toBeGreaterThan(0);
    expect(within(hl).getByText("Up now")).toBeInTheDocument();
    expect(within(hl).getByText(new RegExp(fmtDateShort("2027-05-07")))).toBeInTheDocument();
    expect(within(clerk).getByText("Waiting")).toBeInTheDocument();
    expect(within(pws).getByText("Done for now")).toBeInTheDocument();
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

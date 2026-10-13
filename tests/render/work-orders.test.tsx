/**
 * Render tests for /city/work-orders (workstream 5C), owned here along with
 * lib/view/workOrders.ts.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { CityShell } from "@/components/shell/CityShell";
import { WorkOrdersScreen } from "@/components/city/workorders/WorkOrdersScreen";
import { routes } from "@/lib/routes";
import { checkScheduleMeeting, useDemo } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { singleSchedule, streetsLocation } from "@/lib/state/seed/helpers";
import { renderScreen, storedCase } from "./harness";

const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent before demo path 5
const B14 = "PMT-27-0030"; // Four Bridges Ultra: Special, Permitted, three open work orders, Aug 14

describe("/city/work-orders: the Work orders tab", () => {
  it("lists B14's three open work orders, grouped under its event, with their quantities and due date", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });

    expect(screen.getByRole("heading", { name: "Work orders" })).toBeInTheDocument();
    const group = within(screen.getByRole("list", { name: "Four Bridges Ultra's work orders" }));
    expect(group.getByText("Deliver barricades")).toBeInTheDocument();
    expect(group.getByText(/30 barricades/)).toBeInTheDocument();
    expect(group.getByText(/6 officers × 4h/)).toBeInTheDocument();
    expect(group.getByText("Close the street")).toBeInTheDocument();
    expect(group.getAllByText("Mark done")).toHaveLength(3);
  });

  it("demo path 5: once S5 is permitted, its barricades, police and closure orders appear", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });

    expect(screen.queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();

    act(() => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S5, { type: "verify_document", taskId: `${S5}:insurance_certificate` }, "hl");
      dispatch(S5, { type: "accept_and_sign", signature: "Simone Dubois" }, "applicant");
      dispatch(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant");
      dispatch(S5, { type: "issue_permit" }, "clerk");
    });

    const group = within(screen.getByRole("list", { name: "Riverfront Summer 5K's work orders" }));
    expect(group.getByText("Deliver barricades")).toBeInTheDocument();
    expect(group.getByText("Staff police officers")).toBeInTheDocument();
    expect(group.getByText("Close the street")).toBeInTheDocument();
  });

  it("the summary line counts open, overdue and due this week", async () => {
    const overdue = makeTask({ id: "a:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action", dueDate: "2027-04-01" });
    const dueThisWeek = makeTask({ id: "b:work_order:police", catalogId: "work_order:police", owner: "pws", kind: "action", dueDate: "2027-05-05" });
    const done = makeTask({ id: "c:work_order:closure", catalogId: "work_order:closure", owner: "pws", kind: "action", status: "done", dueDate: "2027-04-20" });
    await renderScreen(<WorkOrdersScreen />, {
      role: "pws",
      path: routes.city.workOrders(),
      cases: [
        { ...makeCase({ id: "PMT-27-7001", state: "permitted" }), tasks: [overdue] },
        { ...makeCase({ id: "PMT-27-7002", state: "permitted" }), tasks: [dueThisWeek] },
        { ...makeCase({ id: "PMT-27-7003", state: "permitted" }), tasks: [done] },
      ],
    });

    expect(screen.getByText("2 open: 1 overdue, 1 due this week")).toBeInTheDocument();
  });

  it("a finished work order is not drawn as overdue: the page's own count and its rows agree, on the seed and months later", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });
    const rows = () => screen.getAllByRole("listitem").filter((row) => row.closest('ul[aria-label$="work orders"]'));
    const doneRows = () => rows().filter((row) => within(row).queryByText("Done"));

    // Seven of the ten seeded work orders are done, all due on a day that has passed.
    expect(screen.getByText("3 open: 0 overdue, 0 due this week")).toBeInTheDocument();
    expect(rows()).toHaveLength(10);
    expect(doneRows()).toHaveLength(7);
    for (const row of doneRows()) {
      expect(row).not.toHaveTextContent(/Overdue/);
      expect(row.querySelector('[data-slot="due-date"]')).toBeNull();
      expect(row).toHaveTextContent(/Was due \w{3}, \w{3} \d+, 2027/);
    }
    expect(document.querySelectorAll("[data-overdue]")).toHaveLength(0);

    act(() => useDemo.getState().setDemoToday("2027-07-11"));
    for (const row of doneRows()) expect(row).not.toHaveTextContent(/Overdue/);
    // An open row still counts down, and goes red when it is late.
    const open = rows().filter((row) => within(row).queryByText("Mark done"));
    expect(open.length).toBeGreaterThan(0);
    for (const row of open) expect(row.querySelector('[data-slot="due-date"]')).not.toBeNull();
  });

  it("a kind filter narrows the list", async () => {
    const { user } = await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });

    await user.click(screen.getByRole("button", { name: "Police" }));
    expect(screen.queryByText("Deliver barricades")).not.toBeInTheDocument();
    expect(screen.getAllByText("Staff police officers").length).toBeGreaterThan(0);
  });

  it("a row's Mark done opens the case, at the task that finishes it", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });

    const group = within(screen.getByRole("list", { name: "Four Bridges Ultra's work orders" }));
    const barricadesTask = storedCase(B14).tasks.find((t) => t.catalogId === "work_order:barricades")!;
    expect(group.getAllByText("Mark done")[0]).toHaveAttribute("href", routes.city.case(B14, { task: barricadesTask.id, from: routes.city.workOrders() }));
  });

  it("marking a work order done through the store drops its Mark done row", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });

    const barricadesTask = storedCase(B14).tasks.find((t) => t.catalogId === "work_order:barricades")!;
    act(() => {
      useDemo.getState().dispatch(B14, { type: "complete_city_task", taskId: barricadesTask.id }, "pws");
    });
    expect(storedCase(B14).tasks.find((t) => t.catalogId === "work_order:barricades")!.status).toBe("done");

    const updatedGroup = within(screen.getByRole("list", { name: "Four Bridges Ultra's work orders" }));
    expect(updatedGroup.getByText("Deliver barricades")).toBeInTheDocument();
    expect(updatedGroup.getAllByText("Mark done")).toHaveLength(2);
  });

  it("is empty for a case list with no open work orders", async () => {
    const done = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action", status: "done" });
    await renderScreen(<WorkOrdersScreen />, {
      role: "pws",
      path: `${routes.city.workOrders()}?status=scheduled`,
      cases: [{ ...makeCase({ id: "PMT-27-7010", state: "permitted" }), tasks: [done] }],
    });

    expect(screen.getByText("0 open: 0 overdue, 0 due this week")).toBeInTheDocument();
    // A filter is on (Scheduled), so the empty list says it is the filters', and the bar offers to clear them.
    expect(screen.getByText("No work orders match these filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });
});

describe("/city/work-orders: Walkthroughs and meetings", () => {
  it("B14's coordination meeting and walkthrough show as scheduled", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: `${routes.city.workOrders()}?tab=meetings` });

    const coordination = screen.getByText("Coordination meeting · Scheduled for Fri, Jul 23, 2027");
    const walkthrough = screen.getByText("Site walkthrough · Scheduled for Fri, Aug 6, 2027");
    // The walkthrough is Public Works & Safety's to move; the coordination meeting is the Clerk's, and the row says so.
    expect(within(walkthrough.closest("li") as HTMLElement).getByRole("link", { name: /^Reschedule: / })).toBeInTheDocument();
    const clerks = within(coordination.closest("li") as HTMLElement);
    expect(clerks.queryByRole("link", { name: /^Reschedule: / })).not.toBeInTheDocument();
    expect(clerks.getByText("Only the City Clerk can schedule this meeting.")).toBeInTheDocument();
    // One reason, and no dead Mark held button beside it saying the same thing again.
    expect(clerks.queryByRole("button", { name: /^Mark held: / })).not.toBeInTheDocument();
    expect(clerks.queryByText(/can close this meeting/)).not.toBeInTheDocument();
  });

  it("a meeting with no date yet reads 'Not yet scheduled' and offers Schedule, not Mark held", async () => {
    const task = makeTask({ id: "x:site_walkthrough", catalogId: "site_walkthrough", owner: "applicant", kind: "meeting", status: "locked", reviewer: "pws" });
    await renderScreen(<WorkOrdersScreen />, {
      role: "pws",
      path: `${routes.city.workOrders()}?tab=meetings`,
      cases: [{ ...makeCase({ id: "PMT-27-7020", tier: "special" }), tasks: [task] }],
    });

    expect(screen.getByText(/Not yet scheduled/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Schedule: / })).toBeInTheDocument();
    expect(screen.queryByText("Mark held")).not.toBeInTheDocument();
  });

  it("every Schedule or Reschedule link opens a panel that can schedule: none for a meeting already held, none for a meeting somebody else hosts", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: `${routes.city.workOrders()}?tab=meetings` });
    const rows = within(screen.getByRole("list", { name: "Walkthroughs and meetings" })).getAllByRole("listitem");
    expect(rows).toHaveLength(10);

    const cases = useDemo.getState().cases;
    let links = 0;
    for (const row of rows) {
      const link = within(row).queryByRole("link", { name: /^(Schedule|Reschedule): / });
      const held = /· Held$/.test(row.querySelector("p")?.textContent ?? "");
      const clerks = row.textContent?.includes("Coordination meeting") ?? false;
      // Four were held, and of the six still to come the three coordination meetings are the City Clerk's: seven rows with no link.
      expect([row.textContent, link !== null]).toEqual([row.textContent, !held && !clerks]);
      if (held) expect(row).not.toHaveTextContent(/Only the City Clerk|already been held/);
      if (!held && clerks) expect(row).toHaveTextContent("Only the City Clerk can schedule this meeting.");
      if (!link) continue;
      links += 1;
      // The link's own panel agrees: the engine lets this role schedule that meeting.
      const [, caseId, taskId] = /\/city\/cases\/([^?]+)\?.*task=schedule_meeting%3A([^&]+)/.exec(link.getAttribute("href") ?? "") ?? [];
      const c = cases.find((candidate) => candidate.id === caseId)!;
      expect(checkScheduleMeeting(c, decodeURIComponent(taskId), "pws")).toEqual({ ok: true });
    }
    expect(links).toBe(3);
  });

  it("the City Clerk can schedule either kind, and still gets no link for a meeting that was held", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "clerk", path: `${routes.city.workOrders()}?tab=meetings` });
    const rows = within(screen.getByRole("list", { name: "Walkthroughs and meetings" })).getAllByRole("listitem");
    const linked = rows.filter((row) => within(row).queryByRole("link", { name: /^(Schedule|Reschedule): / }));
    expect(linked).toHaveLength(6);
    expect(rows.filter((row) => /· Held$/.test(row.querySelector("p")?.textContent ?? ""))).toHaveLength(4);
    expect(document.body).not.toHaveTextContent("Only the City Clerk");
  });

  it("scheduling a walkthrough through the hand-off refuses a date after the event, with the engine's reason", async () => {
    const c = {
      ...makeCase({ id: "PMT-27-7030", tier: "special", state: "permitted", schedule: singleSchedule("2027-06-01", "09:00", "12:00") }),
      tasks: [makeTask({ id: "PMT-27-7030:site_walkthrough", catalogId: "site_walkthrough", owner: "applicant", kind: "meeting", status: "locked", reviewer: "pws" })],
    };
    await renderScreen(<CaseDetailScreen />, { role: "pws", path: routes.city.case(c.id, { task: "schedule_meeting:PMT-27-7030:site_walkthrough" }), cases: [c] });

    const dialog = within(screen.getByRole("dialog"));
    // Who attends is the calendar's list for this meeting: Public Works & Safety walks the site with the applicant. The Clerk is not on it.
    expect(dialog.getByText("Attends:").parentElement).toHaveTextContent("Attends: Applicant, Public Works & Safety");
    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2027-06-15" } });
    expect(dialog.getByText("Choose a date before Tue, Jun 1, 2027.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Schedule" })).toBeDisabled();
  });
});

describe("/city/work-orders: Today panel", () => {
  it("shows nothing when no street closure is on Event day", async () => {
    await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders() });
    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
  });

  it("an event day street closure gets a checklist and records Closed at / Reopened at notes", async () => {
    const barricades = makeTask({ id: "x:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action" });
    const c = {
      ...makeCase({ id: "PMT-27-7040", name: "Founders Day parade", state: "event_day", location: streetsLocation(["main-1-2"], "Main Street, 1st to 2nd Avenue"), schedule: singleSchedule("2027-05-03", "09:00", "17:00") }),
      tasks: [barricades],
    };
    const { user } = await renderScreen(<WorkOrdersScreen />, { role: "pws", path: routes.city.workOrders(), cases: [c] });

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Founders Day parade's closure checklist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record closed at" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "07:45" } });
    await user.click(screen.getByRole("button", { name: "Record closed at" }));
    expect(storedCase(c.id).activity.at(-1)?.text).toBe("Closed at 7:45 am.");

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "11:40" } });
    await user.click(screen.getByRole("button", { name: "Record reopened at" }));
    expect(storedCase(c.id).activity.at(-1)?.text).toBe("Reopened at 11:40 am.");
  });
});

describe("/city/work-orders: another city role", () => {
  it("sees the shell's built-for panel, not the screen", async () => {
    await renderScreen(
      <CityShell>
        <WorkOrdersScreen />
      </CityShell>,
      { role: "hl", path: routes.city.workOrders() },
    );

    expect(screen.getByText("This screen is built for Public Works & Safety.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Work orders" })).not.toBeInTheDocument();
  });
});

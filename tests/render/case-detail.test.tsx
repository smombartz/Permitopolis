import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { fmtMoney } from "@/lib/format";
import { closeoutSettlement, nextMove, useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { navigate, renderScreen, storedCase, switchRole } from "./harness";

const TODAY = DEFAULT_DEMO_TODAY;
const S3 = "PMT-27-0118"; // Jazz in the Plaza, Needs info
const S4 = "PMT-27-0126"; // Maple Street block party, Submitted
const S5 = "PMT-27-0097"; // Riverfront Summer 5K, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival, Closeout
const F1 = "PMT-27-0121"; // Downtown Art Walk, Submitted and ready to accept

/** The sheet's own submit button, scoped away from the sticky panel's row of the same label. */
function sheetButton(name: string) {
  return within(screen.getByRole("dialog")).getByRole("button", { name });
}

describe("case detail: S5, two parties up at once", () => {
  it("as the Clerk, shows the applicant and Health & Legal up, Issue permit disabled with both reasons, and names both in the next-move sentence", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5), role: "clerk" });

    expect(screen.getByRole("heading", { level: 1, name: "Riverfront Summer 5K" })).toBeInTheDocument();
    expect(screen.getAllByText("Up now")).toHaveLength(2);

    const issueButton = screen.getByRole("button", { name: "Issue permit" });
    expect(issueButton).toBeDisabled();
    expect(screen.getByText("Needs: signature (applicant), payment (applicant), insurance (Health & Legal)")).toBeInTheDocument();

    const sentence = nextMove(storedCase(S5), TODAY, "Riverfront Running Club");
    expect(sentence).toMatch(/Riverfront Running Club/);
    expect(sentence).toMatch(/Health & Legal/);
    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it("switching to Health & Legal and verifying the insurance card marks it done", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5), role: "clerk" });
    switchRole("hl");

    await user.click(screen.getByRole("tab", { name: "Documents" }));
    const card = screen.getByTestId(`document-card-${S5}:insurance_certificate`);
    await user.click(within(card).getByRole("button", { name: "Verify" }));
    await user.click(sheetButton("Verify"));

    const task = storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate");
    expect(task?.status).toBe("done");
  });

  it("deep links to a panel through ?task=", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: "issue_permit" }), role: "clerk" });
    expect(screen.getByRole("heading", { level: 2, name: "Issue permit" })).toBeInTheDocument();
  });
});

describe("case detail: the Documents tab reads a card's form back in words", () => {
  it("S3's vendor list names its vendor, and Sound details shows labels and a 12-hour time", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "documents" }), role: "hl" });

    const vendorList = screen.getByTestId(`document-card-${S3}:vendor_list`);
    expect(within(vendorList).getByText("Rolling Dumpling Co. · Dumplings and noodle bowls")).toBeInTheDocument();
    expect(vendorList).not.toHaveTextContent("[object");
    expect(within(vendorList).queryByText("vendors")).not.toBeInTheDocument();

    const sound = screen.getByTestId(`document-card-${S3}:sound_details`);
    expect(within(sound).getByText("Sound check time")).toBeInTheDocument();
    expect(within(sound).getByText("5 pm")).toBeInTheDocument();
    expect(within(sound).queryByText("soundCheckTime")).not.toBeInTheDocument();
  });

  it("S6 lists its 25 vendors once each, with Yes and No for the city services it asked for", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "documents" }), role: "hl" });

    const vendorList = screen.getByTestId(`document-card-${S6}:vendor_list`);
    expect(vendorList).not.toHaveTextContent("[object");
    expect(within(vendorList).getAllByRole("listitem")).toHaveLength(25);

    const services = screen.getByTestId(`document-card-${S6}:city_services_request`);
    expect(within(services).getByText("Power hookup").nextElementSibling).toHaveTextContent("Yes");
    expect(services).not.toHaveTextContent(/true|false/);
  });
});

describe("case detail: S3, answering a request", () => {
  it("Health & Legal verifies the health permit and approves, then the Clerk sends the $715 quote", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "hl" });

    // The applicant's answer is set up with the store: the Board surface owns that screen.
    await act(async () => {
      useDemo.getState().dispatch(
        S3,
        { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] },
        "applicant",
      );
    });
    expect(storedCase(S3).state).toBe("in_review");

    await user.click(screen.getByRole("tab", { name: "Documents" }));
    const card = screen.getByTestId(`document-card-${S3}:vendor_health_permit:1`);
    await user.click(within(card).getByRole("button", { name: "Verify" }));
    await user.click(sheetButton("Verify"));
    expect(storedCase(S3).tasks.find((t) => t.catalogId === "vendor_health_permit")?.status).toBe("done");

    await user.click(screen.getByRole("tab", { name: "Reviews" }));
    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    await user.click(sheetButton("Approve"));
    expect(storedCase(S3).reviews.find((r) => r.dept === "hl")?.status).toBe("approved");

    switchRole("clerk");
    navigate(routes.city.case(S3));
    await user.click(screen.getByRole("button", { name: "Send quote" }));
    await user.click(sheetButton("Send quote"));

    const quoted = storedCase(S3);
    expect(quoted.state).toBe("quote_sent");
    const total = quoted.feeLines.reduce((s, l) => s + l.estimate, 0);
    expect(total).toBe(715);
  });
});

describe("case detail: S4, neighbors and the date hold", () => {
  it("after three more sign-offs, the Clerk accepts (the hold appears) and confirms routing: the case moves to In review", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4), role: "clerk" });

    await act(async () => {
      for (let i = 0; i < 3; i++) useDemo.getState().dispatch(S4, { type: "simulate_signoff" }, "neighbor");
    });
    expect(storedCase(S4).tasks.find((t) => t.catalogId === "neighbor_signoff")?.status).toBe("done");
    expect(screen.getByText("No date hold yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept as complete" }));
    await user.click(sheetButton("Accept as complete"));
    expect(storedCase(S4).dateHold.status).toBe("held");
    expect(screen.getByText("Date held")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm routing" }));
    await user.click(sheetButton("Confirm routing"));
    expect(storedCase(S4).state).toBe("in_review");
  });
});

describe("case detail: S6, closeout", () => {
  it("Public Works & Safety passes cleanup and logs hours, then the Clerk reconciles $750 over with a $250 refund and closes", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6), role: "pws" });

    await user.click(screen.getByRole("button", { name: "Log closeout" }));
    const policeInput = screen.getByRole("spinbutton", { name: "Actual: Police" });
    await user.clear(policeInput);
    await user.type(policeInput, "72");
    const crewInput = screen.getByRole("spinbutton", { name: /Cleanup crew hours/ });
    await user.clear(crewInput);
    await user.type(crewInput, "4");
    await user.click(sheetButton("Log closeout"));

    const logged = storedCase(S6);
    expect(logged.state).toBe("closeout");
    expect(logged.feeLines.find((l) => l.label === "Police")?.actual).toBe(6120);
    expect(logged.feeLines.find((l) => l.label === "Cleanup crew")?.actual).toBe(240);

    switchRole("clerk");
    navigate(routes.city.case(S6));
    // One name for the step: Who's up lists the task "Reconcile and close" and Your actions has the button.
    expect(screen.getAllByRole("button", { name: "Reconcile and close" })).toHaveLength(2);
    await user.click(within(screen.getByLabelText("Your actions")).getByRole("button", { name: "Reconcile and close" }));
    await user.click(sheetButton("Reconcile and close"));

    const closed = storedCase(S6);
    expect(closed.state).toBe("closed");
    expect(closed.closeout).toMatchObject({ balance: 750, refund: 250 });
  });
});

describe("case detail: S6 once the hours are in", () => {
  async function logHours() {
    const view = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6), role: "pws" });
    const { user } = view;
    await user.click(screen.getByRole("button", { name: "Log closeout" }));
    const policeInput = screen.getByRole("spinbutton", { name: "Actual: Police" });
    await user.clear(policeInput);
    await user.type(policeInput, "72");
    await user.type(screen.getByRole("spinbutton", { name: /Cleanup crew hours/ }), "4");
    await user.click(sheetButton("Log closeout"));
    return view;
  }

  const statValue = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling;

  it("Log closeout is taken once: the row is disabled and says the Clerk has the case, with no dead review row above it", async () => {
    await logHours();

    expect(screen.getByRole("button", { name: "Log closeout" })).toBeDisabled();
    expect(screen.getByText("Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling.")).toBeInTheDocument();
    // Public Works & Safety approved weeks ago: nothing left to decide.
    expect(screen.queryByRole("button", { name: "Decide your review" })).not.toBeInTheDocument();
    expect(storedCase(S6).feeLines.filter((l) => l.label === "Cleanup crew")).toHaveLength(1);
  });

  it("a line whose field is cleared keeps its estimate: it is never logged as 0", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6), role: "pws" });
    await user.click(screen.getByRole("button", { name: "Log closeout" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Actual: Police" }));
    await user.click(sheetButton("Log closeout"));

    const police = storedCase(S6).feeLines.find((l) => l.label === "Police")!;
    expect(police.actual).toBe(police.estimate);
  });

  it("the Conditions and fees tab says how it settles ($750 over, from the deposit, $250 back), not \"Due $750\"", async () => {
    await logHours();
    switchRole("clerk");
    navigate(routes.city.case(S6, { tab: "conditions" }));

    const tab = screen.getByRole("tabpanel");
    expect(statValue(tab, "Over estimate")).toHaveTextContent("$750");
    expect(statValue(tab, "From deposit")).toHaveTextContent("$750");
    expect(statValue(tab, "Refund")).toHaveTextContent("$250");
    expect(statValue(tab, "Deposit held")).toHaveTextContent("$1,000");
    expect(within(tab).queryByText("Due")).not.toBeInTheDocument();
  });

  it("the Reconcile and close panel shows the same three figures above its button, and then does exactly that", async () => {
    const { user } = await logHours();
    switchRole("clerk");
    navigate(routes.city.case(S6));

    await user.click(within(screen.getByLabelText("Your actions")).getByRole("button", { name: "Reconcile and close" }));
    const sheet = screen.getByRole("dialog");
    expect(statValue(sheet, "Over estimate")).toHaveTextContent("$750");
    expect(statValue(sheet, "From deposit")).toHaveTextContent("$750");
    expect(statValue(sheet, "Refund")).toHaveTextContent("$250");
    expect(within(sheet).queryByText(/will show the actual figures/)).not.toBeInTheDocument();

    await user.click(sheetButton("Reconcile and close"));
    expect(storedCase(S6).closeout).toMatchObject({ balance: 750, refund: 250 });
    expect(storedCase(S6).payments.at(-1)).toMatchObject({ kind: "refund", amount: -250 });
  });

  it("a seeded case already in Closeout with its hours in (PMT-27-0038) opens on its settlement, not on an amount due", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0038", { tab: "conditions" }), role: "clerk" });

    const settlement = closeoutSettlement(storedCase("PMT-27-0038"));
    expect(settlement.bill).toBeNull();
    const tab = screen.getByRole("tabpanel");
    expect(statValue(tab, "From deposit")).toHaveTextContent(fmtMoney(settlement.fromDeposit));
    expect(statValue(tab, "Refund")).toHaveTextContent(fmtMoney(settlement.refund!));
    expect(within(tab).queryByText("Due")).not.toBeInTheDocument();
  });
});

describe("case detail: Your actions lists the role's own open tasks, on every tab", () => {
  const actions = () => within(screen.getByLabelText("Your actions"));
  const labels = () => actions().getAllByRole("button").map((b) => b.textContent);

  it("S5 as Health & Legal: \"Verify Certificate of insurance\" is there, first, and opens the check from the Documents tab", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { tab: "activity" }), role: "hl" });
    // Who's up is on Overview only; on any other tab this panel is where the role's action is.
    expect(labels()).toEqual(["Verify Certificate of insurance", "Send a reminder", "Add a note"]);

    await user.click(actions().getByRole("button", { name: "Verify Certificate of insurance" }));
    await user.click(sheetButton("Verify"));
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate")?.status).toBe("done");
    // Done: the button goes with the task.
    expect(labels()).toEqual(["Send a reminder", "Add a note"]);
  });

  it("Public Works & Safety's work orders after the permit, each closed from here", async () => {
    const ULTRA = "PMT-27-0030"; // Cascade Trail Runners: Permitted, three work orders open
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(ULTRA, { tab: "reviews" }), role: "pws" });
    expect(labels()).toEqual(["Deliver barricades", "Staff police officers", "Close the street", "Send a reminder", "Add a note"]);

    await user.click(actions().getByRole("button", { name: "Deliver barricades" }));
    await user.click(sheetButton("Mark done"));
    expect(storedCase(ULTRA).tasks.find((t) => t.catalogId === "work_order:barricades")?.status).toBe("done");
    expect(labels()).toEqual(["Staff police officers", "Close the street", "Send a reminder", "Add a note"]);
  });

  it("the Clerk on F1 once it is accepted: Schedule the pre-application meeting, beside Confirm routing", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(F1), role: "clerk" });
    expect(labels()).toEqual(["Accept as complete", "Request information", "Deny"]);
    await act(async () => {
      useDemo.getState().dispatch(F1, { type: "accept_complete" }, "clerk");
    });
    expect(labels()).toEqual(["Schedule the pre-application meeting", "Confirm routing"]);

    await user.click(actions().getByRole("button", { name: "Schedule the pre-application meeting" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" })).toBeInTheDocument();
  });

  it("a task a row already opens is not there twice: a reviewer has one Decide your review", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0070"), role: "pws" });
    expect(labels()).toEqual(["Decide your review", "Request information", "Send a reminder", "Add a note"]);
  });
});

describe("case detail: the Conditions and fees tab", () => {
  it("marks the conditions the Clerk's quote carried as Merged, for city staff", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0030", { tab: "conditions" }), role: "clerk" });
    expect(within(screen.getByRole("tabpanel", { name: "Conditions and fees" })).getAllByText("Merged")).toHaveLength(2);
  });
});

describe("case detail: an action that can no longer be taken says why", () => {
  const actions = () => within(screen.getByLabelText("Your actions"));

  it("S3 in Needs info: the Clerk's Send quote names whose answer it waits for", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "clerk" });

    expect(actions().getByRole("button", { name: "Send quote" })).toBeDisabled();
    expect(actions().getByText("Waiting on the applicant's response to Health & Legal's request.")).toBeInTheDocument();
    expect(actions().queryByText(/This case is/)).not.toBeInTheDocument();
  });

  it("a case asked for information at intake (PMT-27-0020) keeps the intake actions", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0020"), role: "clerk" });

    expect(actions().getByRole("button", { name: "Accept as complete" })).toBeDisabled();
    expect(actions().getByText("Waiting on the applicant's response to your request")).toBeInTheDocument();
    expect(actions().queryByRole("button", { name: "Send quote" })).not.toBeInTheDocument();
    expect(actions().queryByRole("button", { name: "Send to commission" })).not.toBeInTheDocument();
    expect(actions().getByRole("button", { name: "Request information" })).toBeEnabled();
  });

  it("a quote already paid in full (PMT-27-0024): Record an in-person payment is disabled and says so", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0024"), role: "clerk" });

    expect(actions().getByRole("button", { name: "Record an in-person payment" })).toBeDisabled();
    expect(actions().getByText("The quote is paid in full.")).toBeInTheDocument();
  });

  it("Send to commission is sent once", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "clerk" });

    await user.click(actions().getByRole("button", { name: "Send to commission" }));
    await user.click(sheetButton("Send to commission"));
    expect(storedCase(S3).flags.sentToCommission).toBe(true);

    expect(actions().getByRole("button", { name: "Send to commission" })).toBeDisabled();
    expect(actions().getByText("Already sent to commission.")).toBeInTheDocument();
    expect(storedCase(S3).activity.filter((a) => /commission/i.test(a.text))).toHaveLength(1);
  });
});

describe("case detail: Confirm routing needs a due date for every reviewer it routes", () => {
  it("a cleared date, or one already passed, disables Confirm routing and says which row", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(F1), role: "clerk" });
    await user.click(screen.getByRole("button", { name: "Accept as complete" }));
    await user.click(sheetButton("Accept as complete"));
    await user.click(screen.getByRole("button", { name: "Confirm routing" }));

    const sheet = within(screen.getByRole("dialog"));
    expect(sheetButton("Confirm routing")).toBeEnabled();
    const firstDate = sheet.getAllByLabelText("Due date")[0];

    fireEvent.change(firstDate, { target: { value: "" } });
    expect(sheet.getByText("Choose a due date.")).toBeInTheDocument();
    expect(sheetButton("Confirm routing")).toBeDisabled();

    fireEvent.change(firstDate, { target: { value: "2027-04-30" } });
    expect(sheet.getByText("The due date has passed; choose today or later.")).toBeInTheDocument();
    expect(sheetButton("Confirm routing")).toBeDisabled();

    fireEvent.change(firstDate, { target: { value: "2027-05-24" } });
    expect(sheetButton("Confirm routing")).toBeEnabled();
    await user.click(sheetButton("Confirm routing"));
    const routed = storedCase(F1);
    expect(routed.state).toBe("in_review");
    for (const review of routed.reviews) expect(Number.isFinite(review.clock.allowedDays)).toBe(true);
  });
});

describe("case detail: the Reviews tab on a case the Clerk has no license review on", () => {
  it("says so in the Clerk's own section, not that the Clerk has not routed the case to itself", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "reviews" }), role: "clerk" });

    expect(storedCase(S3).reviews.some((r) => r.dept === "clerk")).toBe(false);
    expect(screen.getByText("No license review on this case.")).toBeInTheDocument();
    expect(screen.queryByText("The City Clerk has not routed this case to this department.")).not.toBeInTheDocument();
  });

  it("\"Not routed yet\" is only said while routing is still to come: S4 before it, never S3 or S5 after", async () => {
    const reviews = () => within(screen.getByRole("tabpanel", { name: "Reviews" }));
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4, { tab: "reviews" }), role: "clerk" });
    expect(reviews().getAllByText("Not routed yet")).toHaveLength(3);

    for (const id of [S3, S5]) {
      navigate(routes.city.case(id, { tab: "reviews" }));
      expect(storedCase(id).reviews.some((r) => r.dept === "clerk"), id).toBe(false);
      expect(reviews().queryByText("Not routed yet"), id).not.toBeInTheDocument();
      expect(reviews().getAllByText("Not routed"), id).toHaveLength(1);
    }
  });
});

describe("case detail: Activity tab", () => {
  it("lists S3's history newest first", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "activity" }), role: "clerk" });
    const c = storedCase(S3);
    const newest = c.activity.at(-1)!;
    expect(screen.getByText(newest.text)).toBeInTheDocument();
  });

  it("groups entries by day, under a day heading each", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4, { tab: "activity" }), role: "clerk" });
    const c = storedCase(S4);
    const days = new Set(c.activity.map((a) => a.at.slice(0, 10)));
    // Every distinct day the case's history touches gets its own heading, newest first.
    expect(days.size).toBeGreaterThan(1);
    const headings = screen.getAllByText(/^\w{3}, \w{3} \d{1,2}, \d{4}$/);
    expect(headings.length).toBe(days.size);
  });

  it("filters by party", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "activity" }), role: "clerk" });
    const c = storedCase(S3);
    const hlEntry = c.activity.find((a) => a.actor === "hl");
    const clerkOnlyEntry = c.activity.find((a) => a.actor === "clerk" && !c.activity.some((other) => other.text === a.text && other.actor === "hl"));
    expect(hlEntry).toBeDefined();

    await user.click(screen.getByRole("combobox", { name: "Filter by party" }));
    await user.click(screen.getByRole("option", { name: "Health & Legal" }));

    expect(screen.getByText(hlEntry!.text)).toBeInTheDocument();
    if (clerkOnlyEntry) expect(screen.queryByText(clerkOnlyEntry.text)).not.toBeInTheDocument();
  });

  it("marks what happened since the viewing role last acted", async () => {
    const c = makeCase({
      id: "PMT-27-0501",
      state: "needs_info",
      activity: [
        { at: "2027-04-20T09:00", actor: "applicant", text: "Submitted the application." },
        { at: "2027-04-21T09:00", actor: "clerk", text: "Accepted as complete." },
        { at: "2027-05-02T09:00", actor: "hl", text: "Asked a question." },
        { at: "2027-05-03T09:00", actor: "applicant", text: "Answered the question." },
      ],
    });
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0501", { tab: "activity" }), role: "clerk", cases: [c] });

    expect(screen.getByRole("separator", { name: "Since you last acted" })).toBeInTheDocument();
  });

  it("no marker for a role that has never acted on the case", async () => {
    const c = makeCase({
      id: "PMT-27-0502",
      state: "needs_info",
      activity: [
        { at: "2027-04-20T09:00", actor: "applicant", text: "Submitted the application." },
        { at: "2027-04-21T09:00", actor: "clerk", text: "Accepted as complete." },
      ],
    });
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0502", { tab: "activity" }), role: "hl", cases: [c] });
    expect(screen.queryByRole("separator", { name: "Since you last acted" })).not.toBeInTheDocument();
  });
});

describe("case detail: edge states", () => {
  it("shows CaseNotFound for an unknown id", async () => {
    await renderScreen(<CaseDetailScreen />, { path: "/city/cases/PMT-27-9999", role: "clerk" });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });

  it("shows a withdrawn case's banner and offers only Add a note", async () => {
    const withdrawn = makeCase({
      id: "PMT-27-0500",
      name: "Cancelled picnic",
      state: "submitted",
      ending: "withdrawn",
      endingReason: "The organizer withdrew before review.",
    });
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case("PMT-27-0500"), role: "clerk", cases: [withdrawn] });

    expect(screen.getByText("The organizer withdrew before review.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a note" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept as complete" })).not.toBeInTheDocument();
  });
});

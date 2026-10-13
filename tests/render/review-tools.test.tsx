/**
 * Render tests for workstream 4C (reviewer tools): the shared review-decide panel (serving
 * Public Works & Safety, Health & Legal and the Clerk's own license review), Public Works &
 * Safety's closeout, and work orders and meetings. Clicked through CaseDetailScreen, on the
 * real seed.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { navigate, renderScreen, storedCase } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza: Needs info, pending on Health & Legal's vendor health permit
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Quote sent, walkthrough already scheduled Jul 2 (event Jul 11)
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Closeout, Public Works & Safety's hours not yet logged
const FARMERS_MARKET = "PMT-27-0070"; // Riverside Farmers Market: In review, freshly routed to Public Works & Safety
const CASCADE_ULTRA = "PMT-27-0030"; // Cascade Trail Runners: Permitted, its three work orders still open

/** The open sheet's own button or field, apart from one of the same name on the page behind it. */
function sheet() {
  return within(screen.getByRole("dialog"));
}

describe("review decide: S3 as Health & Legal, after the applicant answers and the document is verified", () => {
  it("approves in one decision, and the Clerk's consolidate task opens", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "hl" });

    await act(async () => {
      useDemo.getState().dispatch(
        S3,
        { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] },
        "applicant",
      );
    });

    await user.click(screen.getByRole("tab", { name: "Documents" }));
    const card = screen.getByTestId(`document-card-${S3}:vendor_health_permit:1`);
    await user.click(within(card).getByRole("button", { name: "Verify" }));
    await user.click(sheet().getByRole("button", { name: "Verify" }));

    await user.click(screen.getByRole("tab", { name: "Reviews" }));
    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    // The submitted material is in front of the reviewer before the click: the file just attached.
    expect(sheet().getByText("health-permit.pdf")).toBeInTheDocument();
    expect(sheet().getByRole("radio", { name: "Approve" })).toBeChecked();
    await user.click(sheet().getByRole("button", { name: "Approve" }));

    const decided = storedCase(S3);
    expect(decided.reviews.find((r) => r.dept === "hl")?.status).toBe("approved");
    // Public Works & Safety had already decided in the seed: the last approval opens the Clerk's task.
    expect(decided.tasks.find((t) => t.catalogId === "consolidate")?.status).toBe("todo");
  });
});

describe("review decide: a fresh routed case (the Farmers Market filler)", () => {
  it("as Public Works & Safety: approves with two template conditions and one fee line, and they appear on the Reviews tab", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(FARMERS_MARKET), role: "pws" });

    await user.click(screen.getByRole("tab", { name: "Reviews" }));
    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    await user.click(sheet().getByRole("radio", { name: "Approve with conditions" }));
    await user.click(sheet().getByRole("button", { name: "Generators placed at least 10 feet from any structure" }));
    await user.click(sheet().getByRole("button", { name: "Tents secured with weighted ballast, no stakes in paved areas" }));
    await user.click(sheet().getByRole("button", { name: "Add line" }));
    // A new line's fields are plainly named; once it has a label they are named for it.
    fireEvent.change(sheet().getByLabelText("Label"), { target: { value: "Extra barricade watch" } });
    fireEvent.change(sheet().getByLabelText("Quantity: Extra barricade watch"), { target: { value: "2" } });
    fireEvent.change(sheet().getByLabelText("Unit price: Extra barricade watch"), { target: { value: "50" } });
    await user.click(sheet().getByRole("button", { name: "Approve with conditions" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const decided = storedCase(FARMERS_MARKET);
    expect(decided.reviews.find((r) => r.dept === "pws")?.status).toBe("approved_with_conditions");
    expect(screen.getByText("Generators placed at least 10 feet from any structure")).toBeInTheDocument();
    expect(screen.getByText("Tents secured with weighted ballast, no stakes in paved areas")).toBeInTheDocument();
    expect(screen.getByText("Extra barricade watch")).toBeInTheDocument();
  });

  it("deny asks for a reason", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(FARMERS_MARKET), role: "hl" });

    await user.click(screen.getByRole("button", { name: "Decide your review" }));
    await user.click(sheet().getByRole("radio", { name: "Deny" }));
    expect(sheet().getByText("Reason, shown to the applicant")).toBeInTheDocument();
    fireEvent.change(sheet().getByLabelText("Reason, shown to the applicant"), { target: { value: "Vendor list is missing two vendors' names." } });
    await user.click(sheet().getByRole("button", { name: "Deny" }));

    const decided = storedCase(FARMERS_MARKET);
    expect(decided.reviews.find((r) => r.dept === "hl")?.status).toBe("denied");
    expect(decided.tasks.find((t) => t.catalogId === "consolidate")?.title).toBe("Decide: a reviewer denied");
  });
});

describe("closeout: S6 as Public Works & Safety", () => {
  it("passes the cleanup check, logs 72 officer-hours and 4 crew-hours, reads $750 over, and the panel is read-only once reopened", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6), role: "pws" });

    await user.click(screen.getByRole("button", { name: "Log closeout" }));
    const policeInput = sheet().getByRole("spinbutton", { name: "Actual: Police" });
    await user.clear(policeInput);
    await user.type(policeInput, "72");
    await user.type(sheet().getByRole("spinbutton", { name: /Cleanup crew hours/ }), "4");
    expect(sheet().getByText("$750 over")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Log closeout" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(storedCase(S6).feeLines.find((l) => l.label === "Police")?.actual).toBe(72 * 85);
    expect(storedCase(S6).feeLines.find((l) => l.label === "Cleanup crew")?.actual).toBe(4 * 60);

    navigate(routes.city.case(S6, { task: "log_closeout" }));
    expect(sheet().getByText("Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling.")).toBeInTheDocument();
    expect(sheet().queryByRole("spinbutton")).not.toBeInTheDocument();
    // Read-only, in the table the Clerk reconciles from: 72 officer-hours is $6,120, $510 over.
    const police = within(sheet().getByRole("cell", { name: "Police" }).closest("tr")!);
    expect(police.getByText("$6,120")).toBeInTheDocument();
    expect(police.getByText("$510")).toBeInTheDocument();
    expect(sheet().getByText("Pass")).toBeInTheDocument();
  });
});

describe("work orders and meetings", () => {
  it("a work order is marked done, with its own quantity, event and due date", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, {
      path: routes.city.case(CASCADE_ULTRA, { task: `${CASCADE_ULTRA}:work_order:barricades` }),
      role: "pws",
    });

    expect(sheet().getByText("30 barricades")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Mark done" }));

    expect(storedCase(CASCADE_ULTRA).tasks.find((t) => t.catalogId === "work_order:barricades")?.status).toBe("done");
  });

  it("a walkthrough cannot be scheduled after the event", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5), role: "pws" });
    await user.click(screen.getByRole("tab", { name: "Reviews" }));
    await user.click(screen.getByRole("button", { name: "Reschedule" }));

    const dateInput = sheet().getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2027-07-20" } });

    expect(sheet().getByText(/Choose a date before/)).toBeInTheDocument();
    expect(sheet().getByRole("button", { name: "Schedule" })).toBeDisabled();
  });
});

describe("review decide: a fee line with no quantity is not dropped in silence", () => {
  it("a preset starts at 1; cleared to 0 it stops the decision and says which line; with a quantity it goes out", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "reviews" }), role: "hl" });
    // The applicant answers, so Health & Legal's review is open to decide. S3 asked for no police.
    await act(async () => {
      useDemo.getState().dispatch(S3, { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
    });
    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    await user.click(sheet().getByRole("button", { name: "Food or vendor permit" }));
    expect(sheet().getByLabelText("Quantity: Food or vendor permit")).toHaveValue(1);

    fireEvent.change(sheet().getByLabelText("Quantity: Food or vendor permit"), { target: { value: "0" } });
    expect(sheet().getByText("Give Food or vendor permit a quantity, or remove the line.")).toBeInTheDocument();
    expect(sheet().getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(storedCase(S3).reviews.find((r) => r.dept === "hl")?.status).toBe("pending");

    fireEvent.change(sheet().getByLabelText("Quantity: Food or vendor permit"), { target: { value: "2" } });
    await user.click(sheet().getByRole("button", { name: "Approve" }));
    const decided = storedCase(S3);
    expect(decided.reviews.find((r) => r.dept === "hl")?.status).toBe("approved");
    expect(decided.feeLines.filter((l) => l.dept === "hl").at(-1)).toMatchObject({ label: "Food or vendor permit", qty: 2, estimate: 150 });
  });
});

describe("meetings on the Reviews tab: Mark held asks the engine before it is offered", () => {
  const meetingRow = (title: string) => within(screen.getByText(title).closest('[data-slot="meeting-row"]') as HTMLElement);

  it("S5 before the permit: the walkthrough's Mark held is off for the Clerk and for Public Works & Safety, and says what unlocks it", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { tab: "reviews" }), role: "clerk" });
    for (const role of ["clerk", "pws"] as const) {
      act(() => useDemo.getState().setRole(role));
      const row = meetingRow("Site walkthrough");
      expect(row.getByText("Scheduled for Fri, Jul 2, 2027")).toBeInTheDocument();
      expect(row.getByRole("button", { name: "Mark held" })).toBeDisabled();
      expect(row.getByText("Unlocks when the permit is issued")).toBeInTheDocument();
      // Moving the date is still open to both.
      expect(row.getByRole("button", { name: "Reschedule" })).toBeEnabled();
    }
  });

  it("S5 once the permit is out: still off, weeks before Fri, Jul 2, and on from that day", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { tab: "reviews" }), role: "pws" });
    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S5, { type: "verify_document", taskId: `${S5}:insurance_certificate` }, "hl");
      dispatch(S5, { type: "accept_and_sign", signature: "Priya Raman" }, "applicant");
      dispatch(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant");
      dispatch(S5, { type: "issue_permit" }, "clerk");
    });
    expect(storedCase(S5).state).toBe("permitted");
    const row = () => meetingRow("Site walkthrough");
    expect(row().getByRole("button", { name: "Mark held" })).toBeDisabled();
    expect(row().getByText("Scheduled for Fri, Jul 2; mark it held on or after that day.")).toBeInTheDocument();

    await act(async () => {
      useDemo.getState().setDemoToday("2027-07-02");
    });
    expect(row().getByRole("button", { name: "Mark held" })).toBeEnabled();
    await user.click(row().getByRole("button", { name: "Mark held" }));
    await user.click(sheet().getByRole("button", { name: "Mark held" }));
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "site_walkthrough")?.status).toBe("done");
  });
});

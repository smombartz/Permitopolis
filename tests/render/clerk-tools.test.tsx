/**
 * Render tests for workstream 4A's Clerk panels (lib/view/clerkTools.ts has the pure logic).
 * Each clicks through the real sheet, as the demo would.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { navigate, renderScreen, storedCase, switchRole } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza, Needs info (becomes In review once answered)
const S4 = "PMT-27-0126"; // Maple Street block party, Submitted, 3 of 12 sign-offs
const S5 = "PMT-27-0097"; // Riverfront Summer 5K, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival, Closeout, hours not yet logged

/** The sheet's own submit button, scoped away from the sticky panel's row of the same label. */
function sheetButton(name: string) {
  return within(screen.getByRole("dialog")).getByRole("button", { name });
}

function sheet() {
  return screen.getByRole("dialog");
}

/** The sticky "Your actions" panel, scoped away from a matching link in Who's up or elsewhere on the page. */
function actions() {
  return within(screen.getByLabelText("Your actions"));
}

describe("4A: Consolidation and quote builder (send_quote)", () => {
  it("S3 once Health & Legal approves: the consolidation shows Public Works & Safety's three conditions, the quote totals $715, and sending moves the case to Quote sent", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "clerk" });

    // Answer the pinned request, then Health & Legal verifies and approves (set up through the store).
    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S3, { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
      dispatch(S3, { type: "verify_document", taskId: `${S3}:vendor_health_permit:1` }, "hl");
      dispatch(S3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl");
    });

    await user.click(actions().getByRole("button", { name: "Send quote" }));
    const panel = sheet();

    expect(within(panel).getByText("Sound ends at 9 pm")).toBeInTheDocument();
    expect(within(panel).getByText("Speakers face away from the residences on Elm Street")).toBeInTheDocument();
    expect(within(panel).getByText("No more than 85 dB at 50 feet")).toBeInTheDocument();

    const totalRow = within(panel).getByText("Total").closest("div") as HTMLElement;
    expect(within(totalRow).getByText("$715")).toBeInTheDocument();

    await user.click(sheetButton("Send quote"));

    const quoted = storedCase(S3);
    expect(quoted.state).toBe("quote_sent");
    expect(quoted.feeLines.reduce((sum, l) => sum + l.estimate, 0)).toBe(715);
  });

  it("editing a line's unit price changes the total and what the quote carries once sent", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "clerk" });

    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S3, { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
      dispatch(S3, { type: "verify_document", taskId: `${S3}:vendor_health_permit:1` }, "hl");
      dispatch(S3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl");
    });

    await user.click(actions().getByRole("button", { name: "Send quote" }));
    const panel = sheet();

    const soundPrice = within(panel).getByRole("spinbutton", { name: "Unit price: Amplified sound" });
    await user.clear(soundPrice);
    await user.type(soundPrice, "80");

    const totalRow = within(panel).getByText("Total").closest("div") as HTMLElement;
    expect(within(totalRow).getByText("$755")).toBeInTheDocument();

    await user.click(sheetButton("Send quote"));
    const quoted = storedCase(S3);
    expect(quoted.feeLines.find((l) => l.label === "Amplified sound")).toMatchObject({ unitPrice: 80, estimate: 80 });
    expect(quoted.feeLines.reduce((sum, l) => sum + l.estimate, 0)).toBe(755);
  });

  it("when a review is not yet approved, the panel says exactly what blocks sending", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3), role: "clerk" });
    const button = actions().getByRole("button", { name: "Send quote" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Waiting on the applicant's response to Health & Legal's request.")).toBeInTheDocument();
  });
});

describe("4A: Confirm routing (confirm_routing)", () => {
  it("S4 once its sign-offs and Accept are in: routing is prefilled with Public Works & Safety and Health & Legal and their reasons, and confirming moves the case to In review", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4), role: "clerk" });

    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      for (let i = 0; i < 9; i++) dispatch(S4, { type: "simulate_signoff" }, "applicant");
      dispatch(S4, { type: "accept_complete" }, "clerk");
    });

    await user.click(actions().getByRole("button", { name: "Confirm routing" }));
    const panel = sheet();

    expect(within(panel).getAllByText("Public Works & Safety").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Health & Legal").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/Block party/)).toBeInTheDocument();
    expect(within(panel).getByText(/Insurance verification/)).toBeInTheDocument();
    // Lead time left after the latest due date: a line is shown, not blank.
    expect(within(panel).getByText(/lead time left after the latest due date/)).toBeInTheDocument();

    await user.click(sheetButton("Confirm routing"));

    const routed = storedCase(S4);
    expect(routed.state).toBe("in_review");
    expect(routed.reviews.map((r) => r.dept).sort()).toEqual(["hl", "pws"]);
  });

  it("refuses to drop Health & Legal while the plan carries an insurance card", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4), role: "clerk" });

    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      for (let i = 0; i < 9; i++) dispatch(S4, { type: "simulate_signoff" }, "applicant");
      dispatch(S4, { type: "accept_complete" }, "clerk");
    });

    await user.click(actions().getByRole("button", { name: "Confirm routing" }));
    const panel = sheet();

    await user.click(within(panel).getByRole("checkbox", { name: "Route to Health & Legal" }));
    expect(within(panel).getByText(/route Health & Legal or nobody checks it/)).toBeInTheDocument();
    expect(sheetButton("Confirm routing")).toBeDisabled();
  });
});

describe("4A: Issue permit checklist", () => {
  it("S5: two items unmet once Health & Legal has verified, then none once the applicant signs and pays, and issuing works", async () => {
    // Issue permit is disabled at first (nothing is done yet), so it is opened by its deep
    // link, as a My queue or Who's up row would: clicking a disabled row does nothing.
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: "issue_permit" }), role: "clerk" });

    let panel = sheet();
    expect(within(panel).getByText("Accepted the conditions and signed")).toBeInTheDocument();
    expect(within(panel).getByText("Paid the quote in full")).toBeInTheDocument();
    expect(within(panel).getByText("Insurance certificate verified")).toBeInTheDocument();
    await user.click(sheetButton("Cancel"));

    // Health & Legal verifies (through the store): one item is now met, two remain.
    await act(async () => {
      useDemo.getState().dispatch(S5, { type: "verify_document", taskId: `${S5}:insurance_certificate` }, "hl");
    });

    navigate(routes.city.case(S5, { task: "issue_permit" }));
    panel = sheet();
    expect(within(panel).getByText("Needs: signature (applicant), payment (applicant)")).toBeInTheDocument();
    await user.click(sheetButton("Cancel"));

    // The applicant signs and pays (through the store): nothing left unmet.
    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S5, { type: "accept_and_sign", signature: "Simone Dubois" }, "applicant");
      dispatch(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant");
    });

    await user.click(actions().getByRole("button", { name: "Issue permit" }));
    panel = sheet();
    expect(within(panel).getByText("Everything this needs is in place.")).toBeInTheDocument();
    await user.click(sheetButton("Issue permit"));

    expect(storedCase(S5).state).toBe("permitted");
  });
});

describe("4A: Closeout reconciliation (reconcile_close)", () => {
  it("S6 once Public Works & Safety logs hours: reads $750 over and a $250 refund, and closing works", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6), role: "pws" });

    const police = storedCase(S6).feeLines.find((l) => l.label === "Police")!;
    await act(async () => {
      useDemo.getState().dispatch(
        S6,
        {
          type: "log_closeout",
          cleanup: "pass",
          notes: "Street swept and reopened by 11 pm.",
          actuals: [{ feeLineId: police.id, qty: 72 }],
          extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: useDemo.getState().cfg.fees.cleanupCrewPerWorkerHour }],
        },
        "pws",
      );
    });

    switchRole("clerk");
    await user.click(actions().getByRole("button", { name: "Reconcile and close" }));
    const panel = sheet();

    expect(within(panel).getByText("Over estimate").nextElementSibling).toHaveTextContent("$750");
    expect(within(panel).getByText("Refund").nextElementSibling).toHaveTextContent("$250");
    expect(within(panel).getByText("Pass")).toBeInTheDocument();
    expect(within(panel).getByText("Street swept and reopened by 11 pm.")).toBeInTheDocument();

    await user.click(sheetButton("Reconcile and close"));

    const closed = storedCase(S6);
    expect(closed.state).toBe("closed");
    expect(closed.closeout).toMatchObject({ balance: 750, refund: 250 });
  });
});

describe("4A: Deny", () => {
  it("asks for a reason and, once confirmed, ends the case", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S4), role: "clerk" });

    await user.click(actions().getByRole("button", { name: "Deny" }));
    const panel = sheet();
    expect(sheetButton("Deny application")).toBeDisabled();

    await user.type(within(panel).getByRole("textbox", { name: "Reason" }), "The plan does not meet the noise ordinance.");
    await user.click(sheetButton("Deny application"));

    // A confirm dialog opens on top of the sheet, which stays mounted behind it: the confirm
    // button is the topmost of the two now matching "Deny application".
    const dialogs = screen.getAllByRole("dialog");
    await user.click(within(dialogs[dialogs.length - 1]).getByRole("button", { name: "Deny application" }));

    const denied = storedCase(S4);
    expect(denied.ending).toBe("denied");
    expect(denied.endingReason).toBe("The plan does not meet the noise ordinance.");
    expect(denied.dateHold.status).not.toBe("held");
  });
});

import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectionsScreen } from "@/components/city/inspections/InspectionsScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { renderScreen, storedCase } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza

/** Walks S3 through Path 3 (tests/demo-paths.test.ts) to Permitted, through the real store. */
async function permitS3() {
  const healthPermit = `${S3}:vendor_health_permit:1`;
  await act(async () => {
    const dispatch = useDemo.getState().dispatch;
    dispatch(S3, { type: "respond_to_request", taskId: healthPermit, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
    dispatch(S3, { type: "verify_document", taskId: healthPermit }, "hl");
    dispatch(S3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl");
    const reviewed = storedCase(S3);
    dispatch(
      S3,
      {
        type: "send_quote",
        conditions: reviewed.conditions.map((cond) => ({ dept: cond.dept, text: cond.text })),
        feeLines: reviewed.feeLines.map((line) => ({ dept: line.dept, label: line.label, qty: line.qty, unit: line.unit, unitPrice: line.unitPrice, kind: line.kind })),
      },
      "clerk",
    );
    dispatch(S3, { type: "accept_and_sign", signature: "Jordan Alvarez" }, "applicant");
    dispatch(S3, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant");
    dispatch(S3, { type: "issue_permit" }, "clerk");
  });
  expect(storedCase(S3).state).toBe("permitted");
}

describe("Inspections", () => {
  it("on May 3, Jazz in the Plaza (Jun 18) is well outside the 14-day window", async () => {
    await renderScreen(<InspectionsScreen />, { role: "hl", path: routes.city.inspections() });
    expect(screen.queryByText("Jazz in the Plaza")).not.toBeInTheDocument();
    // St. Agnes Parish's festival, May 13, has food vendors and falls in the window: it shows.
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByText(/St\. Agnes Parish/)).toBeInTheDocument();
  });

  it("jumping the demo date to Jun 18, after Jazz in the Plaza is permitted, shows its one booth, under Today", async () => {
    await renderScreen(<InspectionsScreen />, { role: "hl", path: routes.city.inspections() });
    await permitS3();
    await act(async () => {
      useDemo.getState().setDemoToday("2027-06-18");
    });

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Jazz in the Plaza")).toBeInTheDocument();
    expect(screen.getByText("Rolling Dumpling Co.")).toBeInTheDocument();
  });

  it("recording a pass writes the note and shows it", async () => {
    const { user } = await renderScreen(<InspectionsScreen />, { role: "hl", path: routes.city.inspections() });
    await permitS3();
    await act(async () => {
      useDemo.getState().setDemoToday("2027-06-18");
    });

    const booth = screen.getByText("Rolling Dumpling Co.").closest("div")!.parentElement!;
    await user.type(within(booth).getByPlaceholderText("Note (optional)"), "Clean prep surfaces.");
    await user.click(within(booth).getByRole("button", { name: "Record" }));

    expect(screen.getAllByText("Pass").length).toBeGreaterThan(0);
    expect(screen.getByText(/Clean prep surfaces\./)).toBeInTheDocument();
    expect(storedCase(S3).activity.at(-1)?.text).toBe("Food booth inspection: Rolling Dumpling Co.: pass. Clean prep surfaces.");
  });

  it("an empty queue explains itself", async () => {
    await renderScreen(<InspectionsScreen />, { role: "hl", path: routes.city.inspections(), cases: [] });
    expect(screen.getByText("No food booths to inspect")).toBeInTheDocument();
  });
});

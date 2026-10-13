import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { renderScreen, storedCase } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza, Needs info
const S5 = "PMT-27-0097"; // Riverfront Summer 5K, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival, Closeout
const F5 = "PMT-27-0115"; // Plaza wedding photos: insurance is a JPEG, never accepted

describe("S5, Health & Legal: the insurance checklist", () => {
  it("passes all four items and Verify clears it (demo path 5)", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { tab: "documents" }), role: "hl" });

    const card = screen.getByTestId(`document-card-${S5}:insurance_certificate`);
    await user.click(within(card).getByRole("button", { name: /^Verify / }));

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    for (const label of [
      "Named insured matches the applicant",
      "The City of Permitopolis is an additional insured",
      "At least $1,000,000 per occurrence",
      "Coverage covers setup through teardown",
    ]) {
      expect(panel.getByText(label)).toBeInTheDocument();
    }
    expect(panel.getAllByText("Passes")).toHaveLength(4);
    expect(panel.queryByText(/reason the applicant will see/i)).not.toBeInTheDocument();

    const submit = panel.getByRole("button", { name: "Verify" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCase(S5).tasks.find((t) => t.catalogId === "insurance_certificate")?.status).toBe("done");
  });
});

describe("S3, after the applicant answers the health permit request", () => {
  it("verifies cleanly (demo path 3)", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "documents" }), role: "hl" });

    // The applicant's reply is the board's own surface, out of scope here: dispatch it
    // directly, as tests/render/case-detail.test.tsx does for the same step.
    await act(async () => {
      useDemo.getState().dispatch(
        S3,
        { type: "respond_to_request", taskId: `${S3}:vendor_health_permit:1`, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] },
        "applicant",
      );
    });

    const card = screen.getByTestId(`document-card-${S3}:vendor_health_permit:1`);
    await user.click(within(card).getByRole("button", { name: /^Verify / }));

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByText("Vendor name matches the vendor list")).toBeInTheDocument();
    expect(panel.getAllByText(/Rolling Dumpling Co\./).length).toBeGreaterThan(0);
    const submit = panel.getByRole("button", { name: "Verify" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(storedCase(S3).tasks.find((t) => t.id === `${S3}:vendor_health_permit:1`)?.status).toBe("done");
  });
});

describe("the wedding-photos insurance (a JPEG, not a certificate)", () => {
  it("fails the checklist, Send back is the primary action with a prefilled reason, and the applicant's card becomes Changes requested", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(F5, { tab: "documents" }), role: "hl" });

    const card = screen.getByTestId(`document-card-${F5}:insurance_certificate`);
    await user.click(within(card).getByRole("button", { name: /^Verify / }));

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByText("This does not look like a certificate of insurance.")).toBeInTheDocument();
    expect(panel.getByText("Looks like the right kind of document")).toBeInTheDocument();
    expect(panel.getByText("Fails")).toBeInTheDocument();

    const reason = panel.getByLabelText(/Reason the applicant will see/) as HTMLTextAreaElement;
    expect(reason.value).toMatch(/Upload a certificate of insurance/);

    const submit = panel.getByRole("button", { name: "Send back" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const task = storedCase(F5).tasks.find((t) => t.catalogId === "insurance_certificate");
    expect(task?.status).toBe("changes_requested");
    expect(task?.payload.rejectedReason).toMatch(/Upload a certificate of insurance/);
  });
});

describe("a department that is not the card's reviewer", () => {
  it("sees the document read-only, with who checks it", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(F5, { tab: "documents" }), role: "pws" });

    const card = screen.getByTestId(`document-card-${F5}:insurance_certificate`);
    expect(within(card).getByText(/Checked by Health & Legal/)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /^Verify / })).not.toBeInTheDocument();
  });
});

describe("the Documents tab's \"Needs my check\" filter", () => {
  it("narrows S5's documents to the one card Health & Legal still has to check", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { tab: "documents" }), role: "hl" });

    expect(screen.getByTestId(`document-card-${S5}:insurance_certificate`)).toBeInTheDocument();
    expect(screen.getByTestId(`document-card-${S5}:accessibility_plan`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Needs my check" }));

    expect(screen.getByTestId(`document-card-${S5}:insurance_certificate`)).toBeInTheDocument();
    expect(screen.queryByTestId(`document-card-${S5}:accessibility_plan`)).not.toBeInTheDocument();
  });
});

describe("S6's 25 vendor health permits", () => {
  it("collapse into one group with its progress, collapsed by default once every one is verified", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "documents" }), role: "hl" });

    expect(screen.getByText("Vendor health permits")).toBeInTheDocument();
    expect(screen.getByText("25 of 25 vendors verified")).toBeInTheDocument();
    // Collapsed by default: a verified group has nothing left for Health & Legal to check.
    expect(screen.queryByTestId(`document-card-${S6}:vendor_health_permit:1`)).not.toBeInTheDocument();
  });

  it("expands to each vendor's own card", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "documents" }), role: "hl" });
    await user.click(screen.getByRole("button", { name: /Vendor health permits/ }));
    expect(screen.getByTestId(`document-card-${S6}:vendor_health_permit:1`)).toBeInTheDocument();
  });
});

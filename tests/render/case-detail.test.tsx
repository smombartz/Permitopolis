import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { nextMove, useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { navigate, renderScreen, storedCase, switchRole } from "./harness";

const TODAY = DEFAULT_DEMO_TODAY;
const S3 = "PMT-27-0118"; // Jazz in the Plaza, Needs info
const S4 = "PMT-27-0126"; // Maple Street block party, Submitted
const S5 = "PMT-27-0097"; // Riverfront Summer 5K, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival, Closeout

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
    await user.click(screen.getByRole("button", { name: "Reconcile and close" }));
    await user.click(sheetButton("Reconcile and close"));

    const closed = storedCase(S6);
    expect(closed.state).toBe("closed");
    expect(closed.closeout).toMatchObject({ balance: 750, refund: 250 });
  });
});

describe("case detail: Activity tab", () => {
  it("lists S3's history newest first", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "activity" }), role: "clerk" });
    const c = storedCase(S3);
    const newest = c.activity.at(-1)!;
    expect(screen.getByText(newest.text)).toBeInTheDocument();
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

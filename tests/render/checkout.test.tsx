import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { holdNavigation, lastPush, renderScreen, storedCase } from "./harness";

const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S5 = "PMT-27-0097";
const TAI_CHI = "PMT-27-0034"; // Instant series, a session due today
const CARNIVAL = "PMT-27-0042"; // Closed, $50 still owed

async function waitForPending() {
  await new Promise((resolve) => setTimeout(resolve, 750));
}

describe("CheckoutScreen: BOOKING (demo path 1)", () => {
  it("S2: shows 13 sessions at $20 each and $20 due now; paying books it and goes to the permit", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, {
      scenario: "S2",
      path: routes.quote(S2),
    });

    expect(screen.getByText(/13 sessions starting/)).toBeInTheDocument();
    expect(screen.getByText("Field reservation")).toBeInTheDocument();
    const payButton = screen.getByRole("button", { name: "Pay $20" });
    expect(payButton).toBeInTheDocument();
    // What is charged now vs. later: the first session plus fees here, the other 12 on schedule.
    expect(screen.getByText("Then $20 per session for the 12 remaining sessions, billed on their own date.")).toBeInTheDocument();

    await user.click(payButton);
    expect(screen.getByRole("button", { name: "Processing…" })).toBeInTheDocument();
    await waitForPending();

    expect(storedCase(S2).state).toBe("permitted");
    expect(lastPush()).toBe(routes.permit(S2));
  });
});

describe("CheckoutScreen: the moment after paying, before the next page arrives", () => {
  // router.push() is a transition: the payment changes the case at once and the next route
  // arrives later. holdNavigation() keeps the URL where it is, as the browser does meanwhile.
  it("booking: says it is booked and paid, with the way to the permit, never \"Nothing to pay here\"", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, { scenario: "S2", path: routes.quote(S2) });
    holdNavigation();

    await user.click(screen.getByRole("button", { name: "Pay $20" }));
    await waitForPending();

    expect(storedCase(S2).state).toBe("permitted");
    expect(screen.queryByText("Nothing to pay here")).not.toBeInTheDocument();
    expect(screen.queryByText(/already has its permit/)).not.toBeInTheDocument();
    expect(screen.getByText("Booked and paid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View permit" })).toHaveAttribute("href", routes.permit(S2));
  });

  it("a session: says it is paid, with the way back to the board", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, {
      role: "applicant",
      personaId: "riverside-tai-chi-circle",
      path: routes.quote(TAI_CHI, { pay: "session", date: "2027-05-03" }),
    });
    holdNavigation();

    await user.click(screen.getByRole("button", { name: /^Pay \$/ }));
    await waitForPending();

    expect(storedCase(TAI_CHI).schedule!.occurrences.find((o) => o.date === "2027-05-03")!.billing).toBe("paid");
    expect(screen.queryByText("Nothing to pay here")).not.toBeInTheDocument();
    expect(screen.getByText("Session paid")).toBeInTheDocument();
    expect(lastPush()).toBe(routes.event(TAI_CHI));
  });

  it("the final bill: says it is paid", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, {
      role: "applicant",
      personaId: "golden-years-senior-center",
      path: routes.quote(CARNIVAL, { pay: "final" }),
    });
    holdNavigation();

    await user.click(screen.getByRole("button", { name: "Pay $50" }));
    await waitForPending();

    expect(screen.queryByText("Nothing to pay here")).not.toBeInTheDocument();
    expect(screen.getByText("Final bill paid")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Back to your board" })[0]).toHaveAttribute("href", routes.event(CARNIVAL));
  });
});

describe("CheckoutScreen: QUOTE (demo path 5)", () => {
  it("S5: accepting conditions, signing and paying $6,530 leaves 'Waiting on Health & Legal to verify your insurance'", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, {
      role: "applicant",
      personaId: "riverfront-running-club",
      path: routes.quote(S5),
    });

    expect(screen.getByText(/Pay by.*to keep your date/)).toBeInTheDocument();
    // Every condition went through the Clerk's quote. That is not the applicant's to know.
    expect(storedCase(S5).conditions.every((cond) => cond.mergedByClerk)).toBe(true);
    expect(screen.queryByText("Merged")).not.toBeInTheDocument();

    // Step 1: accept every condition, then sign.
    for (const checkbox of screen.getAllByRole("checkbox", { name: /^I accept:/ })) {
      if (checkbox.getAttribute("data-state") !== "checked") await user.click(checkbox);
    }
    await user.type(screen.getByLabelText(/Type your full legal name/), "Simone Dubois");
    await user.click(screen.getByRole("checkbox", { name: /I have read and accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept and sign" }));

    expect(await screen.findByText("Signed and dated.")).toBeInTheDocument();
    expect(storedCase(S5).flags.signed).toBe(true);

    // Step 2: pay.
    const payButton = await screen.findByRole("button", { name: "Pay $6,530" });
    await user.click(payButton);
    await waitForPending();

    expect(await screen.findByText("Paid. Waiting on Health & Legal to verify your insurance.")).toBeInTheDocument();
    const stored = storedCase(S5);
    expect(stored.state).toBe("quote_sent");
    expect(stored.payments.some((p) => p.kind === "quote" && p.amount === 6530)).toBe(true);
  });
});

describe("CheckoutScreen: not ready", () => {
  it("S3: before its quote, says the quote isn't ready yet", async () => {
    await renderScreen(<CheckoutScreen />, {
      scenario: "S3",
      path: routes.quote(S3),
    });

    expect(screen.getByText(/quote isn't ready yet/i)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Back to your board" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", routes.event(S3));
  });

  it("an unknown case id shows CaseNotFound", async () => {
    await renderScreen(<CheckoutScreen />, {
      role: "applicant",
      path: "/events/PMT-00-0000/quote",
      params: { id: "PMT-00-0000" },
    });

    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("CheckoutScreen: role guard", () => {
  it("a city role gets the shell's switch panel, not the checkout screen", async () => {
    const { AppShell } = await import("@/components/shell");
    await renderScreen(
      <AppShell>
        <CheckoutScreen />
      </AppShell>,
      { role: "clerk", path: routes.quote(S5) },
    );
    expect(screen.getByText(/This screen is built for the Applicant/)).toBeInTheDocument();
    expect(useDemo.getState().role).toBe("clerk");
  });
});

describe("FeeTable rendering sanity", () => {
  it("S5's fee table is grouped and totals", async () => {
    await renderScreen(<CheckoutScreen />, {
      role: "applicant",
      personaId: "riverfront-running-club",
      path: routes.quote(S5),
    });
    const totalRow = within(screen.getByText("Total").closest("div")!);
    expect(totalRow.getByText("$6,530")).toBeInTheDocument();
  });
});

describe("CheckoutScreen: an amendment's quote, on a case that already has its permit", () => {
  const S1 = "PMT-27-0109";

  it("a change that only costs more (two more hours) has nothing to sign: the page takes the $50 and goes back to the board", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, { scenario: "S1", path: routes.quote(S1) });
    // Before any change the permitted picnic has nothing to pay here.
    expect(screen.getByText("This event already has its permit.")).toBeInTheDocument();

    act(() => {
      const s1 = storedCase(S1);
      expect(useDemo.getState().dispatch(S1, { type: "amend", answers: { ...s1, schedule: { ...s1.schedule!, end: "18:00" } } }).ok).toBe(true);
    });

    expect(document.querySelector('[data-slot="amendment-quote"]')).toHaveTextContent("Your change is in effect. What it adds to your fees is due here.");
    expect(screen.getByText("Paid so far: $125. Due for your change: $50.")).toBeInTheDocument();
    // Instant, never signed, no conditions: neither section is on the page.
    expect(screen.queryByRole("heading", { name: "Sign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conditions" })).not.toBeInTheDocument();
    expect(screen.queryByText("Signed and dated.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pay $50" }));
    await new Promise((resolve) => setTimeout(resolve, 750));

    expect(storedCase(S1).payments.at(-1)).toMatchObject({ amount: 50, kind: "quote", amendment: true });
    expect(storedCase(S1).tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "done", payload: { amount: 175 } });
    expect(lastPush()).toBe(routes.event(S1));
    // The page holds what was paid until the board arrives, instead of "Nothing to pay here".
    expect(screen.queryByText("Nothing to pay here")).not.toBeInTheDocument();
  });
});

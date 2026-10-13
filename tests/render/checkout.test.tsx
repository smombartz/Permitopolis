import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { lastPush, renderScreen, storedCase } from "./harness";

const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S5 = "PMT-27-0097";

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

    await user.click(payButton);
    expect(screen.getByRole("button", { name: "Processing…" })).toBeInTheDocument();
    await waitForPending();

    expect(storedCase(S2).state).toBe("permitted");
    expect(lastPush()).toBe(routes.permit(S2));
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

    // Step 1: accept every condition, then sign.
    for (const checkbox of screen.getAllByRole("checkbox", { name: /^Accept:/ })) {
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

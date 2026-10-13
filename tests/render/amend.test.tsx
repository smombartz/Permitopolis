import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmendWizardScreen } from "@/components/wizard/amend/AmendWizardScreen";
import { routes } from "@/lib/routes";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { buildSeed, transition } from "@/lib/state";
import { renderScreen, storedCase, switchRole } from "./harness";

const S1 = "PMT-27-0109"; // Maya Chen, picnic, Instant, Permitted, Sat, May 22, 2027

describe("AmendWizardScreen: unknown, Draft and ended cases", () => {
  it("shows CaseNotFound for a case id that isn't in the demo", async () => {
    await renderScreen(<AmendWizardScreen />, { path: "/events/PMT-27-9999/amend" });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });

  it("explains that a Draft is edited in the wizard instead", async () => {
    await renderScreen(<AmendWizardScreen />, { path: routes.amend("PMT-27-0004"), personaId: "riverside-garden-society" });
    expect(screen.getByText("This event cannot be amended")).toBeInTheDocument();
    expect(screen.getByText("Edit your plan in the wizard instead.")).toBeInTheDocument();
  });

  it("explains that a withdrawn case cannot be amended", async () => {
    await renderScreen(<AmendWizardScreen />, { path: routes.amend("PMT-27-0048"), personaId: "sunnyvale-block-association" });
    expect(screen.getByText("This event cannot be amended")).toBeInTheDocument();
    expect(screen.getByText(/withdrawn/)).toBeInTheDocument();
  });
});

/** The live diff panel: on jsdom (no real matchMedia changes) it is always the StickyAside. */
function panel() {
  const node = document.querySelector('[data-slot="amend-result-panel"]');
  if (!node) throw new Error("the amendment's result panel is not on screen");
  return within(node as HTMLElement);
}

describe("AmendWizardScreen: Maya adds a DJ (the PRD's example)", () => {
  it("opens filled in, with everything already answered", async () => {
    await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });
    expect(screen.getByRole("heading", { level: 1, name: "Maya Chen's 40th birthday picnic" })).toBeInTheDocument();
    expect(panel().getByText(/This is an Instant event/)).toBeInTheDocument();
  });

  it("turning on amplified sound shows the tier rise, the new cards and the lead-time gate live", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });

    await user.click(screen.getByRole("button", { name: "Next" })); // what -> where
    await user.click(screen.getByRole("button", { name: "Next" })); // where -> when
    await user.click(screen.getByRole("button", { name: "Next" })); // when -> size

    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));

    expect(panel().getByText(/This is a Reviewed event/)).toBeInTheDocument();
    expect(panel().getByText(/makes your event Reviewed/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" })); // size -> plan (review)
    expect(screen.getByRole("heading", { level: 2, name: "Review your change" })).toBeInTheDocument();
    // In the banner, with its fixes; the wizard's status line said the same sentence once, when the gate tripped.
    expect(within(document.querySelector<HTMLElement>('[data-slot="date-gate-banner"]')!).getByText(/19 days left, 30 needed/)).toBeInTheDocument();
    expect(document.querySelector('[data-slot="wizard-date-announcement"]')).toHaveTextContent(/19 days left, 30 needed/);
    const confirmButton = screen.getByRole("button", { name: "Confirm change" });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Pay a \$53\.75 late fee/ }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    const amended = storedCase(S1);
    expect(amended.flags).toMatchObject({ amendmentPending: true, lateFee: true });
    expect(amended.tier).toBe("reviewed");
  });
});

describe("AmendWizardScreen: a change that needs no review", () => {
  it("a smaller crowd applies at once, with no City Clerk decision to wait for", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });

    await user.click(screen.getByRole("button", { name: "Next" })); // what -> where
    await user.click(screen.getByRole("button", { name: "Next" })); // where -> when
    await user.click(screen.getByRole("button", { name: "Next" })); // when -> size

    const attendance = screen.getByLabelText(/Expected attendance/);
    await user.clear(attendance);
    await user.type(attendance, "20");

    await user.click(screen.getByRole("button", { name: "Next" })); // size -> plan (review)
    expect(screen.getByText(/takes effect right away/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply change" }));

    const amended = storedCase(S1);
    expect(amended.attendance).toBe(20);
    expect(amended.flags.amendmentPending).toBe(false);
  });
});

describe("AmendWizardScreen: entry points", () => {
  it("the board's menu links to it for a Permitted case, before its last session", async () => {
    const { BoardScreen } = await import("@/components/board/BoardScreen");
    const { user } = await renderScreen(<BoardScreen />, { scenario: "S1" });
    await user.click(screen.getByRole("button", { name: "Board menu" }));
    const link = screen.getByRole("menuitem", { name: "Change your event" });
    expect(link).toHaveAttribute("href", routes.amend(S1));
  });
});

describe("AmendWizardScreen: what the applicant is told happens next", () => {
  it("a change that needs a look names the whole way: the cards, the departments' checks, the Clerk's decision, then signing and paying", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByText(
        "This needs a look from the city. Finish the new cards and submit the amendment from your board. The departments check them, the City Clerk decides, and you then sign and pay what the change adds. Your permit keeps covering the original plan until then.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Pay a \$53\.75 late fee/ }));
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    // The Clerk's part is on the case (tests/render/handoffs.test.tsx clicks it through); here
    // the amendment is proposed and nothing is the city's yet.
    switchRole("clerk");
    const pending = storedCase(S1);
    expect(pending.flags.amendmentPending).toBe(true);
    expect(pending.tasks.some((t) => t.owner !== "applicant")).toBe(false);
  });

  it("a change that only costs more says the difference is then due from the board", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    // Two more hours at the shelter: the same tier, the same cards, $50 more.
    fireEvent.change(screen.getByLabelText(/^End/), { target: { value: "18:00" } });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Nothing here needs another look: it takes effect as soon as you confirm, and what it adds to your fees is then due from your board.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply change" }));
    expect(storedCase(S1).tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 50 } });
  });
});

describe("AmendWizardScreen: the fee difference is what the engine then settles", () => {
  const S2 = "PMT-27-0142"; // Sunrise Yoga Club: 13 Sundays at $20, the first paid with the booking
  const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Quote sent, $6,530, nothing paid

  async function toReview(user: Awaited<ReturnType<typeof renderScreen>>["user"]) {
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2, name: "Review your change" })).toBeInTheDocument();
  }
  const fees = () => within(document.querySelector<HTMLElement>('[data-slot="amend-fees"]')!);

  it("a permitted series with nothing changed owes nothing: the later sessions are a line of their own, not \"$240 more will be due\"", async () => {
    // Demo path 1 has run: the series is booked, and its first Sunday paid, before the wizard opens.
    const seed = buildSeed();
    const booked = transition(seed.find((c) => c.id === S2)!, { type: "book_and_pay", method: "card" }, "applicant", { today: DEFAULT_DEMO_TODAY, cases: seed, cfg: DEFAULT_CONFIG });
    if (!booked.ok) throw new Error(booked.reason);
    const { user } = await renderScreen(<AmendWizardScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.amend(S2), cases: seed.map((c) => (c.id === S2 ? booked.case : c)) });
    expect(storedCase(S2).state).toBe("permitted");
    await toReview(user);

    expect(document.querySelector('[data-slot="amend-fees"]')).toHaveTextContent("FeesNew total$260Already paid$20Later sessions, paid on their day$240Difference$0");
    expect(fees().queryByText("To pay")).not.toBeInTheDocument();
    expect(screen.queryByText(/more will be due/)).not.toBeInTheDocument();
    expect(screen.getByText("Nothing here needs another look: it takes effect as soon as you confirm.")).toBeInTheDocument();
  });

  it("before the permit the change is to the fees, not to a balance: S5 without its amplified sound reads $40 off the quote, with no refund and no permit to speak of", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { role: "applicant", personaId: "riverfront-running-club", path: routes.amend(S5) });
    expect(storedCase(S5)).toMatchObject({ state: "quote_sent", permit: null, payments: [] });
    // Nothing changed yet: the quote as it stands, and nothing "more due".
    expect(document.querySelector('[data-slot="amend-fees"]')).toHaveTextContent("FeesCurrent total$6,530New total$6,530Difference$0");

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    expect(document.querySelector('[data-slot="amend-fees"]')).toHaveTextContent("FeesCurrent total$6,530New total$6,490Taken off your fees$40");
    expect(fees().queryByText("Already paid")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Your fees go down by/)).toHaveTextContent("Your fees go down by $40.");
    expect(screen.queryByText(/will be refunded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/more will be due/)).not.toBeInTheDocument();
    // No permit yet, so nothing is said about one.
    expect(screen.queryByText(/permit/i)).not.toBeInTheDocument();
    expect(screen.getByText("Everything you have already entered and every card you have already finished.")).toBeInTheDocument();
    // One card goes: singular.
    expect(screen.getByText(/no longer applies/)).toHaveTextContent("1 card no longer applies.");
  });

  it("a permitted event keeps its permit sentence, and the headline carries the late fee once it is chosen", async () => {
    const { user } = await renderScreen(<AmendWizardScreen />, { scenario: "S1", path: routes.amend(S1) });
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    expect(panel().getByText("This is a Reviewed event: about 3 weeks, $465 estimated")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Your current permit stays valid for the original plan until this is settled\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pay a \$53\.75 late fee/ }));
    // The headline and the total under it are one figure.
    expect(panel().getByText("This is a Reviewed event: about 3 weeks, $518.75 with the $53.75 late fee")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="amend-fees"]')).toHaveTextContent("FeesNew total$518.75Already paid$125To pay$393.75Includes a $53.75 late fee.");

    await user.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(storedCase(S1).activity.at(-1)?.text).toBe("Amended the plan: This is a Reviewed event: about 3 weeks, $518.75 with the $53.75 late fee.");
  });
});

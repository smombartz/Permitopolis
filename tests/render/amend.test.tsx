import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmendWizardScreen } from "@/components/wizard/amend/AmendWizardScreen";
import { routes } from "@/lib/routes";
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

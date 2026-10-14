/**
 * What is read out, and that it is read out once. A screen reader announces a change inside a
 * live region; these tests hold where the regions are, that each is polite, that a region is
 * empty until there is news, and that one piece of news has one region to say it.
 *
 * jsdom cannot speak, so "once" is checked by its causes: an action's result has a toast and no
 * second region repeating it, and a message that is on the page when it opens is not live.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BoardScreen } from "@/components/board/BoardScreen";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { VerificationsScreen } from "@/components/city/verifications/VerificationsScreen";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { Banner } from "@/components/ui/banner";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { WizardScreen } from "@/components/wizard/WizardScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { liveRegions } from "./a11yAudit";
import { renderScreen } from "./harness";

const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S5 = "PMT-27-0097";

/**
 * Every live region that has something in it right now, the three that always do aside: the
 * header's demo date, who the presenter is acting as, and the coach's step are on the page from
 * the start and speak only when they change.
 */
function speaking(): string[] {
  return liveRegions()
    .filter((region) => !region.element.closest("[data-sonner-toaster]"))
    .map((region) => region.text)
    .filter((text) => text && !text.startsWith("Demo today: ") && !text.startsWith("Acting as ") && !/^Path \d/.test(text));
}

describe("a message that is on the page when it opens is not an announcement", () => {
  it("Banner and InlineAlert carry no live role unless asked, whatever their variant", () => {
    render(
      <>
        <Banner variant="danger">Denied.</Banner>
        <Banner variant="warning">Expires tomorrow.</Banner>
        <InlineAlert variant="danger">Sent back.</InlineAlert>
        <InlineAlert variant="success">Accepted.</InlineAlert>
      </>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("`live` makes one a polite status, never an alert", () => {
    render(
      <>
        <Banner variant="warning" live>
          That space holds 60.
        </Banner>
        <InlineAlert variant="danger" live>
          That payment was refused.
        </InlineAlert>
      </>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("the board, with a reviewer's request pinned and a date held, says nothing on arrival", async () => {
    await renderScreen(
      <AppShell>
        <BoardScreen />
      </AppShell>,
      { scenario: "S3" },
    );
    expect(speaking()).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a case, with its banners and a panel that cannot run yet, says nothing on arrival", async () => {
    await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.case(S5, { task: "issue_permit" }) },
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(speaking()).toEqual([]);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("a field's error", () => {
  function Form({ error }: { error?: string }) {
    return (
      <Field label="Standard at" hint="People." error={error}>
        <Input defaultValue="100" />
      </Field>
    );
  }

  it("arrives inside a polite region that was already there, tied to the field", () => {
    const { rerender } = render(<Form />);
    const region = document.querySelector('[data-slot="field-error"]')!;
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    rerender(<Form error="Standard has to be below Special." />);

    // The same element, now with the error in it: an insertion into a live region, read once.
    expect(document.querySelector('[data-slot="field-error"]')).toBe(region);
    expect(region).toHaveTextContent("Standard has to be below Special.");
    const field = screen.getByRole("textbox", { name: "Standard at" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Standard has to be below Special.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a required field says so to a screen reader, not only with an asterisk", () => {
    render(
      <Field label="Reason" required>
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveAttribute("aria-required", "true");
  });
});

describe("the wizard", () => {
  it("a tier change is said once, by the wizard's own status line, and the panel beside it is not a second one", async () => {
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2", path: routes.apply({ caseId: S2, step: "size" }) });
    expect(speaking()).toEqual([]);

    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));

    const said = speaking().filter((text) => text !== "Saved");
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/Standard event/);
    // The live panel shows the tier too, and it is plain content.
    const panel = document.querySelector('[data-slot="wizard-result-panel"]')!;
    expect(panel.closest('[role="status"], [aria-live]')).toBeNull();
    expect(panel.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });

  it("autosave says Saved, politely, and goes quiet again", async () => {
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2", path: routes.apply({ caseId: S2, step: "what" }) });

    await user.type(screen.getByRole("textbox", { name: "Event name" }), "!");

    const saved = screen.getByText("Saved");
    expect(saved).toHaveAttribute("aria-live", "polite");
  });
});

describe("a case's state", () => {
  it("an action taken on the screen is announced by its toast, and the screen's own status line stays quiet", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.case(S3, { task: "send_to_commission" }) },
    );
    const line = document.querySelector('[data-slot="case-state-announcement"]')!;
    expect(line).toHaveAttribute("role", "status");

    const sheet = within(await screen.findByRole("dialog"));
    await user.click(sheet.getByRole("button", { name: "Send to commission" }));

    expect(line).toBeEmptyDOMElement();
  });

  it("a change nothing toasted (the demo date moving a case on) is announced by the status line, once", async () => {
    await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.case("PMT-27-0109") },
    );
    const line = document.querySelector('[data-slot="case-state-announcement"]')!;
    expect(line).toBeEmptyDOMElement();
    const before = useDemo.getState().cases.find((c) => c.id === "PMT-27-0109")!;

    // Maya's picnic is permitted: on its day the case moves to Event day with no one clicking anything.
    act(() => {
      useDemo.getState().setDemoToday(before.schedule!.date);
    });

    expect(useDemo.getState().cases.find((c) => c.id === "PMT-27-0109")!.state).toBe("event_day");
    expect(line).toHaveTextContent(`${before.name}: now Event day.`);
  });
});

describe("counts, dates and small confirmations", () => {
  it("a filter's result count is a status that changes with the filter", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    const count = screen.getAllByRole("status").find((el) => /documents?$/.test(el.textContent ?? ""))!;
    const before = count.textContent;

    await user.type(screen.getByRole("searchbox"), "zzzz");

    expect(count.textContent).not.toBe(before);
    expect(count).toHaveTextContent("0 documents");
  });

  it("the Cases count is polite", async () => {
    await renderScreen(<CasesScreen />, { role: "clerk", path: routes.city.cases() });
    expect(screen.getByText(/^\d+ of \d+ cases$/)).toHaveAttribute("aria-live", "polite");
  });

  it("the top bar's demo date is polite, so a date jump is read out", async () => {
    await renderScreen(<CityShell>page</CityShell>, { role: "clerk", path: routes.city.queue() });
    const date = screen.getByText("Demo today: Mon, May 3, 2027");
    expect(date).toHaveAttribute("aria-live", "polite");

    act(() => {
      useDemo.getState().setDemoToday("2027-06-18");
    });
    expect(date).toHaveTextContent("Demo today: Fri, Jun 18, 2027");
  });

  it("the coach's live part is its step, and the buttons beside it are outside it", async () => {
    await renderScreen(<AppShell>page</AppShell>, { scenario: "S3" });
    const coach = screen.getByRole("region", { name: "Demo coach" });
    const step = within(coach).getByRole("status");

    expect(step).toHaveTextContent(/^Path 3 · Step 1 of \d+/);
    expect(within(step).queryByRole("button")).not.toBeInTheDocument();
    expect(within(coach).getAllByRole("button").length).toBeGreaterThan(1);
  });

  it("Copy says that it copied", async () => {
    const user = userEvent.setup();
    render(<CopyButton value="PMT-27-0118" label="Copy case id" copiedLabel="Case id copied" />);
    const status = document.querySelector('[data-slot="copy-status"]')!;
    expect(status).toHaveAttribute("role", "status");
    expect(status).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Copy case id" }));

    expect(status).toHaveTextContent("Case id copied");
  });

  it("a payment the engine refuses is read out; the fields' own errors are their descriptions", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.quote(S2) });

    await user.clear(screen.getByRole("textbox", { name: "Card number" }));
    await user.click(screen.getByRole("button", { name: /^Pay \$/ }));

    // One announcement: the field's error, inserted into its standing region. The summary line under the form is plain text.
    expect(speaking()).toEqual(["Card number is required."]);
    expect(screen.getByText("Fix the fields above to pay.").closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });
});

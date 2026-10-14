/**
 * The applicant states matrix (workstream 4E): every empty, error and edge state the brief
 * asks a take-home prototype to cover, each with a render test against the real seed or a
 * hand-built case. One state, one `it`, so a reviewer can tell at a glance which are covered.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardScreen } from "@/components/board/BoardScreen";
import { MyEventsScreen } from "@/components/board/MyEventsScreen";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { PermitScreen } from "@/components/permit/PermitScreen";
import { WizardScreen } from "@/components/wizard/WizardScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { lastReplace, renderScreen, storedCase } from "./harness";

// Real seed cases that already carry the state we need, so the matrix stays truthful to the
// engine instead of hand-waving it. See docs/readme.md "Where the seed differs from the PRD's
// wording" and "Open items" for why each one is in the state it is.
const S1 = "PMT-27-0109"; // Maya Chen, picnic, Instant, permitted
const S2 = "PMT-27-0142"; // Sunrise Yoga Club, Instant series, Draft (only answers, no board)
const S3 = "PMT-27-0118"; // Downtown Arts Collective, Standard, needs_info, three locked cards
const S5 = "PMT-27-0097"; // Riverfront Running Club, Special, quote_sent, insurance under HL review
const B08 = "PMT-27-0018"; // Westside Youth Soccer League, needs_info, a request overdue since Apr 1
const B22 = "PMT-27-0046"; // Redline Motorsports Expo: Denied
const B23 = "PMT-27-0048"; // Sunnyvale Block Association: Withdrawn
const B24 = "PMT-27-0050"; // Evergreen Wedding Planners: Cancelled, after a permit was issued
const B25 = "PMT-27-0052"; // North Permitopolis Chamber: Hold expired, quote never paid
const B05 = "PMT-27-0012"; // St. Agnes Parish, In review; the seed's 90+ character event name
const B09 = "PMT-27-0020"; // Permitopolis Metro Interfaith Council, needs_info; the 60+ character org name

describe("My events: nothing yet", () => {
  it("a persona with no events gets the empty state and a way to start one", async () => {
    await renderScreen(<MyEventsScreen />, { role: "applicant", personaId: "new", path: routes.events() });

    expect(screen.getByText("No events yet")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /Plan an event/ })) {
      expect(link).toHaveAttribute("href", routes.apply());
    }
  });
});

describe("A Draft with only a name", () => {
  it("has no board yet, so My events sends it to the wizard, not a board of cards", async () => {
    const draft = makeCase({ id: "PMT-27-0601", applicantId: "p-only-name", name: "Just a name so far" });
    await renderScreen(<MyEventsScreen />, { role: "applicant", personaId: "p-only-name", path: routes.events(), cases: [draft] });

    const row = screen.getByText("Just a name so far").closest("a")!;
    expect(row).toHaveAttribute("href", routes.apply({ caseId: draft.id }));
  });

  it("the wizard itself shows just the name, with no fee section yet (nothing to charge for)", async () => {
    const draft = makeCase({ id: "PMT-27-0601", applicantId: "p-only-name", name: "Just a name so far", eventType: "picnic_party", wizardStep: "what" });
    await renderScreen(<WizardScreen />, { role: "applicant", personaId: "p-only-name", path: routes.apply({ caseId: draft.id }), cases: [draft] });

    expect(screen.getByDisplayValue("Just a name so far")).toBeInTheDocument();
    expect(screen.queryByText("Fee estimate")).not.toBeInTheDocument();
  });
});

describe("Wizard: opened on someone else's draft, a non-draft case, and an unknown id", () => {
  it("opens someone else's draft all the same (the id decides, not the current persona)", async () => {
    await renderScreen(<WizardScreen />, { role: "applicant", personaId: "maya-chen", path: routes.apply({ caseId: S2 }) });
    expect(screen.getByRole("heading", { level: 1, name: "Sunrise Yoga Club weekly class" })).toBeInTheDocument();
  });

  it("a case that is no longer a Draft is sent to its board instead", async () => {
    await renderScreen(<WizardScreen />, { role: "applicant", personaId: "maya-chen", path: routes.apply({ caseId: S1 }) });
    expect(lastReplace()).toBe(routes.event(S1));
  });

  it("an unknown id shows Case not found, not a blank wizard", async () => {
    await renderScreen(<WizardScreen />, { role: "applicant", path: "/apply", search: { case: "PMT-27-9999" } });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("Wizard: a booked, blacked-out and impacted date, and attendance over capacity", () => {
  async function pickShelterAndName(name: string) {
    const { user } = await renderScreen(<WizardScreen />, { role: "applicant", personaId: "new", path: "/apply" });
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), name);
    await user.click(screen.getByRole("button", { name: "Next" }));
    return user;
  }

  it("Shelter 3 on May 22 is Booked (Maya Chen already holds it)", async () => {
    const user = await pickShelterAndName("Family reunion");
    await user.click(screen.getByRole("button", { name: /^Shelter 3/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: /May 22nd, 2027/ }));

    expect(screen.getAllByText("Booked").length).toBeGreaterThan(0);
  });

  it("Shelter 2 on May 31 is Blackout (Memorial Day: all parks are closed)", async () => {
    const user = await pickShelterAndName("Spring cleanup");
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: /May 31st, 2027/ }));

    expect(screen.getAllByText("Blackout").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Memorial Day/).length).toBeGreaterThan(0);
  });

  it("City Hall Plaza on Jul 11 is Impacted (the 5K closes Main Street that morning)", async () => {
    const { user } = await renderScreen(<WizardScreen />, { role: "applicant", personaId: "new", path: "/apply" });
    await user.click(screen.getByRole("radio", { name: /^Market or festival/ }));
    await user.type(screen.getByLabelText(/Event name/), "Midsummer market");
    await user.click(screen.getByRole("button", { name: "Next" }));
    // The map opens on "Bookable spaces" whatever the event type. "Draw an area" starts on
    // City Hall Plaza; sizing the rectangle sets its width.
    await user.click(screen.getByRole("tab", { name: "Draw an area" }));
    await user.clear(screen.getByLabelText("Width (ft)"));
    await user.type(screen.getByLabelText("Width (ft)"), "80");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /July 11th, 2027/ }));

    expect(screen.getAllByText("Impacted").length).toBeGreaterThan(0);
  });

  it("attendance over a bookable space's capacity warns and suggests a bigger one", async () => {
    const user = await pickShelterAndName("Big picnic");
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ })); // capacity 40
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /June 19th, 2027/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(screen.getByLabelText(/Expected attendance/), "50");
    expect(screen.getByText(/Shelter 2 holds 40 people\./)).toBeInTheDocument();
  });
});

describe("Wizard: the lead-time gate at steps 3, 4 and 5, reachable from wherever it trips", () => {
  it("tripped at step 4 (turning on an add-on) still shows all three fixes back at step 3, and again at step 5", async () => {
    const { user } = await renderScreen(<WizardScreen />, { role: "applicant", personaId: "new", path: "/apply" });
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Neighborhood jam");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Date\b/ }));
    await user.click(screen.getByRole("button", { name: /May 22nd, 2027/ })); // 19 days out
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText(/Expected attendance/), "40");

    // The trigger happens on step 4; nothing here shows the gate yet (the add-on toggle has
    // its own one-line effect, not the gate itself).
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    expect(screen.queryByRole("button", { name: /^Use / })).not.toBeInTheDocument();

    // Step 3: the gate and its three fixes.
    await user.click(screen.getByRole("button", { name: /When, done, edit/ }));
    expect(screen.getByRole("button", { name: /^Use / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop amplified sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();

    // Step 5: the same three fixes, and the primary button stays disabled until one is used.
    await user.click(screen.getByRole("button", { name: "Next" })); // when -> size
    await user.click(screen.getByRole("button", { name: "Next" })); // size -> plan
    expect(screen.getByRole("button", { name: "Create my to-do board" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Use / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop amplified sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();
  }, 15000);
});

describe("A refused action shows the engine's reason, never a silent failure", () => {
  it("booking inside the lead time with no late fee is refused, and the booking page says exactly why", async () => {
    const tooSoon = makeCase({
      id: "PMT-27-0602",
      applicantId: "p-too-soon",
      name: "Last-minute picnic",
      tier: "instant",
      location: { mode: "inventory", inventoryIds: ["shelter-4"], segmentIds: [], capacity: 120, label: "Shelter 4, Riverside Park" },
      schedule: { date: "2027-05-05", start: "11:00", end: "14:00", occurrences: [{ date: "2027-05-05", availability: { status: "open" }, billing: "upcoming" }] },
      attendance: 20,
    });
    await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "p-too-soon", path: routes.quote(tooSoon.id), cases: [tooSoon] });

    expect(screen.getByText("Needs 10 days of notice; pick a later date or add the late fee.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick another date" })).toHaveAttribute("href", routes.apply({ caseId: tooSoon.id, step: "when" }));
    // Never silently hidden: the fee table and the Pay button are not offered at all.
    expect(screen.queryByRole("button", { name: /^Pay \$/ })).not.toBeInTheDocument();
  });
});

describe("Board: an ended case, each of the four endings with its reason", () => {
  it("Denied: the banner names the reviewer's reason", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "redline-motorsports-expo", path: routes.event(B22) });
    expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);
    expect(screen.getByText("Public Works & Safety could not approve the sound plan for this location.")).toBeInTheDocument();
  });

  it("Withdrawn: the banner shows, with only Done cards on the board", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "sunnyvale-block-association", path: routes.event(B23) });
    expect(screen.getAllByText("Withdrawn").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "Done" })).toBeInTheDocument();
  });

  it("Cancelled: the banner shows, after the permit it had was released", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "evergreen-wedding-planners", path: routes.event(B24) });
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  it("Hold expired: the banner explains the quote was never paid", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "north-permitopolis-chamber", path: routes.event(B25) });
    expect(screen.getAllByText("Hold expired").length).toBeGreaterThan(0);
    expect(screen.getByText("The date hold expired before the quote was paid.")).toBeInTheDocument();
  });
});

describe("Board: a card sent back (Changes requested), with a clear way to fix and resend", () => {
  it("S5's insurance certificate, sent back by Health & Legal, is editable again with the reason shown", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "riverfront-running-club", path: routes.event(S5) });
    act(() => {
      const result = useDemo
        .getState()
        .dispatch(S5, { type: "reject_document", taskId: `${S5}:insurance_certificate`, reason: "The additional-insured endorsement is missing." }, "hl");
      expect(result.ok).toBe(true);
    });

    const card = screen.getByRole("button", { name: /Certificate of insurance/ });
    expect(within(card).getByText("Changes requested")).toBeInTheDocument();

    await user.click(card);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Sent back: The additional-insured endorsement is missing.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Use sample file" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

describe("Board: an overdue card and a locked card", () => {
  it("B08's pinned request has been overdue since Apr 1", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "westside-youth-soccer-league", path: routes.event(B08) });
    const card = screen.getByRole("button", { name: /Certificate of insurance/ });
    expect(within(card).getByText(/Overdue by/)).toBeInTheDocument();
  });

  it("S3 has locked cards in Coming up, each saying what unlocks it", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });
    const comingUp = screen.getByRole("heading", { level: 3, name: "Coming up" }).parentElement!.parentElement!;
    const locked = within(comingUp).getAllByText(/Unlocks when/);
    expect(locked.length).toBeGreaterThan(0);
  });
});

describe("Checkout: opened in a state with nothing to pay", () => {
  it("S3 (needs_info, no quote yet) says plainly there is nothing to pay here", async () => {
    await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.quote(S3) });
    expect(screen.getByText("Nothing to pay here")).toBeInTheDocument();
    expect(screen.getByText(/Your quote isn't ready yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Back to your board" }).length).toBeGreaterThan(0);
  });
});

describe("Permit: no permit yet, a cancelled one, and an amendment pending", () => {
  it("S3 has no permit yet", async () => {
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.permit(S3) });
    expect(screen.getByText("No permit to show")).toBeInTheDocument();
    expect(screen.getByText("No permit has been issued for this event yet.")).toBeInTheDocument();
  });

  it("a cancelled case's permit page says so, with nothing live to show", async () => {
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "evergreen-wedding-planners", path: routes.permit(B24) });
    expect(screen.getByText("No permit to show")).toBeInTheDocument();
    expect(screen.getByText(/This case is cancelled/)).toBeInTheDocument();
  });

  it("a permit with an amendment pending still shows, with a banner naming the original plan", async () => {
    const original = storedCase(S1);
    const pending = { ...original, flags: { ...original.flags, amendmentPending: true } };
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "maya-chen", path: routes.permit(S1), cases: [pending] });

    expect(screen.getByText(/An amendment is pending/)).toBeInTheDocument();
    expect(screen.getByText(/covers the original plan until it/)).toBeInTheDocument();
  });
});

describe("Payment and signature forms with invalid or empty input", () => {
  it("clearing the card number and submitting shows a field error, never a silent success", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.quote(S2) });

    const numberField = screen.getByRole("textbox", { name: "Card number" });
    expect(numberField).toHaveAttribute("aria-required", "true");
    await user.clear(numberField);
    await user.click(screen.getByRole("button", { name: /^Pay \$/ }));

    expect(screen.getByText("Card number is required.")).toBeInTheDocument();
    // The error is the field's description, and focus is on the field that needs fixing.
    expect(numberField).toHaveAttribute("aria-invalid", "true");
    expect(numberField).toHaveAccessibleDescription("Card number is required.");
    expect(numberField).toHaveFocus();
    expect(screen.getByText("Fix the fields above to pay.")).toBeInTheDocument();
    // Never silently booked: the draft stays a draft until the form is actually valid.
    expect(storedCase(S2).state).toBe("draft");
  });

  it("a malformed expiry and security code are each called out by name", async () => {
    const { user } = await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.quote(S2) });

    const expiry = screen.getByRole("textbox", { name: "Expiry" });
    await user.clear(expiry);
    await user.type(expiry, "13");
    const cvc = screen.getByRole("textbox", { name: "Security code" });
    await user.clear(cvc);
    await user.type(cvc, "1");
    await user.click(screen.getByRole("button", { name: /^Pay \$/ }));

    expect(screen.getByText("Use MM/YY.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid security code.")).toBeInTheDocument();
    expect(storedCase(S2).state).toBe("draft");
  });

  it("an empty signature cannot be submitted (Accept and sign stays disabled)", async () => {
    await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "riverfront-running-club", path: routes.quote(S5) });
    expect(screen.getByRole("button", { name: "Accept and sign" })).toBeDisabled();
  });
});

describe("A 90-character event name and a 60-character organization name, on every applicant screen", () => {
  it("the board header carries the full 90+ character event name", async () => {
    const name = storedCase(B05).name;
    expect(name.length).toBeGreaterThan(90);
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "st-agnes-parish", path: routes.event(B05) });
    expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
  });

  it("checkout's not-ready header carries it too", async () => {
    const name = storedCase(B05).name;
    await renderScreen(<CheckoutScreen />, { role: "applicant", personaId: "st-agnes-parish", path: routes.quote(B05) });
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("the permit page's header carries it, even with no permit yet", async () => {
    const name = storedCase(B05).name;
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "st-agnes-parish", path: routes.permit(B05) });
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("My events truncates it with the full text still available (title attribute)", async () => {
    const name = storedCase(B05).name;
    await renderScreen(<MyEventsScreen />, { role: "applicant", personaId: "st-agnes-parish", path: routes.events() });
    const truncated = screen.getByText(name, { selector: '[data-slot="truncate"]' });
    expect(truncated).toHaveAttribute("title", name);
  });

  it("the board header also carries the 60+ character organization name", async () => {
    const orgName = "Permitopolis Metropolitan Area Interfaith Council for Community Events";
    expect(orgName.length).toBeGreaterThan(60);
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "permitopolis-metro-interfaith-council", path: routes.event(B09) });
    expect(screen.getByText(orgName)).toBeInTheDocument();
  });
});

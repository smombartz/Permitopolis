import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardScreen } from "@/components/board/BoardScreen";
import { MyEventsScreen } from "@/components/board/MyEventsScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { lastPush, renderScreen, storedCase } from "./harness";

const S2 = "PMT-27-0142";
const S3 = "PMT-27-0118";
const S4 = "PMT-27-0126";
const S5 = "PMT-27-0097";
const S6 = "PMT-27-0031";
const B16 = "PMT-27-0034"; // Riverside Tai Chi Circle, Instant series, Event day today
const WITHDRAWN = "PMT-27-0048";

describe("the board (S3): one pinned request stands between it and its quote", () => {
  it("shows exactly 1 card in Do now, 0 with the city, 3 coming up, 4 done, and Waiting on: You", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    expect(screen.getByRole("heading", { level: 1, name: "Jazz in the Plaza" })).toBeInTheDocument();
    expect(screen.getByText("Waiting on")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();

    const columnCount = (name: string) => {
      const heading = screen.getByRole("heading", { level: 3, name });
      return within(heading.parentElement!).getByText(/^\d+$/).textContent;
    };
    expect(columnCount("Do now")).toBe("1");
    expect(columnCount("With the city")).toBe("0");
    expect(columnCount("Coming up")).toBe("3");
    expect(columnCount("Done")).toBe("4");
  });

  it("the pinned card names Health & Legal and is due Wed, May 5", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    const card = screen.getByRole("button", { name: /Health permit: Rolling Dumpling Co\./ });
    expect(within(card).getAllByText(/Health & Legal/).length).toBeGreaterThan(0);
    expect(within(card).getByText(/May 5/)).toBeInTheDocument();
  });

  it("using the sample file and sending moves the card to With the city and the strip to Health & Legal", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    await user.click(screen.getByRole("button", { name: /Health permit: Rolling Dumpling Co\./ }));
    expect(screen.getAllByText(/asks:/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Use sample file" }));
    await user.click(screen.getByRole("button", { name: "Reply and attach" }));

    const updated = storedCase(S3);
    const card = updated.tasks.find((t) => t.catalogId === "vendor_health_permit")!;
    expect(card.status).toBe("submitted");
    expect(card.request?.resolved).toBe(true);

    // The strip now waits on Health & Legal, not the applicant.
    expect(screen.getAllByText("Health & Legal").length).toBeGreaterThan(0);
  });
});

describe("the board (S4): neighbors and the date hold", () => {
  it("shows 9 of 12 and No date hold yet", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "maple-street-block-captain", path: routes.event(S4) });

    expect(screen.getByText("9 of 12 neighbors")).toBeInTheDocument();
    expect(screen.getByText(/No date hold yet/)).toBeInTheDocument();
    expect(screen.getByText(/3 neighbor sign-offs to go/)).toBeInTheDocument();
  });

  it("three clicks on Simulate a sign-off complete the card", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "maple-street-block-captain", path: routes.event(S4) });

    await user.click(screen.getByRole("button", { name: /Neighbor sign-off/ }));
    const button = () => screen.getByRole("button", { name: /Simulate a sign-off/ });

    await user.click(button());
    await user.click(button());
    await user.click(button());

    const updated = storedCase(S4);
    const card = updated.tasks.find((t) => t.catalogId === "neighbor_signoff")!;
    expect(card.status).toBe("done");
    expect(card.payload.progress).toEqual({ done: 12, total: 12 });
    expect(screen.getByText("All neighbors have signed off.")).toBeInTheDocument();
  });
});

describe("the board (S5): sign-off and payment cards link to the quote route", () => {
  it("shows the two Do now cards, each opening the quote route", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "riverfront-running-club", path: routes.event(S5) });

    expect(screen.getByRole("button", { name: /Accept conditions and sign/ })).toBeInTheDocument();
    const payCard = screen.getByRole("button", { name: /Pay fees and deposit/ });

    await user.click(payCard);
    expect(lastPush()).toBe(routes.quote(S5));
  });
});

describe("the board (B16): a series' session schedule", () => {
  it("shows the total paid and outstanding, and a way to pay the session that is due", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "riverside-tai-chi-circle", path: routes.event(B16) });

    // Instant events show the payment card as "Pay and book"; it opens the schedule once paid.
    await user.click(screen.getByRole("button", { name: /Pay and book/ }));

    const dialog = screen.getByRole("dialog");
    const stats = dialog.querySelectorAll('[data-slot="stat"]');
    expect(Array.from(stats).map((s) => s.textContent)).toEqual([expect.stringContaining("Paid"), expect.stringContaining("Outstanding")]);
    expect(within(dialog).getByRole("link", { name: /Pay the session due/ })).toBeInTheDocument();
  });
});

describe('the board (S5): "With the city" is never a black hole', () => {
  it("names Health & Legal, how many days it has waited, and the expected-by date", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "riverfront-running-club", path: routes.event(S5) });

    expect(screen.getByText("1 card with Health & Legal, expected by Fri, May 7")).toBeInTheDocument();
    expect(screen.getByText(/3 days with Health & Legal · expected by Fri, May 7/)).toBeInTheDocument();
  });

  it("S4, not routed yet: the cards are at the City Clerk's intake, and each names the department it goes to next", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "maple-street-block-captain", path: routes.event(S4) });

    // The intake check waits on the neighbors, so no date is promised.
    expect(screen.getByText("2 cards at intake with the City Clerk, no expected date yet")).toBeInTheDocument();
    expect(screen.getByText("31 days at intake with the City Clerk, then Health & Legal · no expected date yet")).toBeInTheDocument();
    expect(screen.getByText("31 days at intake with the City Clerk, then Public Works & Safety · no expected date yet")).toBeInTheDocument();
    expect(screen.queryByText(/days with Health & Legal/)).not.toBeInTheDocument();
  });

  it("a submitted application whose intake check is late says so, with the Clerk's own due date", async () => {
    // B03, Maple Grove Preschool's spring fair: submitted Apr 27, the Clerk's intake check due Fri, Apr 30.
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "maple-grove-preschool", path: routes.event("PMT-27-0006") });

    expect(screen.getByText("2 cards at intake with the City Clerk, expected by Fri, Apr 30")).toBeInTheDocument();
    expect(screen.getByText("Overdue at intake with the City Clerk, then Health & Legal · expected by Fri, Apr 30")).toBeInTheDocument();
  });
});

describe("the board (S6): after the event", () => {
  it("shows the final bill and feedback coming up", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    const comingUpHeading = screen.getByRole("heading", { level: 3, name: "Coming up" });
    const comingUpColumn = comingUpHeading.parentElement!.parentElement!;
    expect(within(comingUpColumn).getByText("Final bill or refund")).toBeInTheDocument();
    expect(within(comingUpColumn).getByText("Tell us how it went")).toBeInTheDocument();
  });

  it("before the hours are logged, the board says plainly who has it", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });
    expect(screen.getByText("Public Works & Safety is checking cleanup; the City Clerk then reconciles costs.")).toBeInTheDocument();
  });

  it("demo path 6's applicant ending: the final refund, feedback, and book again to the Apr 22, 2028 draft", async () => {
    const dialog = () => within(screen.getByRole("dialog"));
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    // Public Works & Safety logs 72 officer-hours and 4 crew-hours; the Clerk then reconciles
    // $750 over the estimate and refunds $250 from the $1,000 deposit (the PRD's path 6).
    const police = storedCase(S6).feeLines.find((f) => f.label === "Police")!;
    act(() => {
      useDemo.getState().dispatch(
        S6,
        {
          type: "log_closeout",
          cleanup: "pass",
          actuals: [{ feeLineId: police.id, qty: 72 }],
          extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: useDemo.getState().cfg.fees.cleanupCrewPerWorkerHour }],
        },
        "pws",
      );
      useDemo.getState().dispatch(S6, { type: "reconcile_close" }, "clerk");
    });
    expect(storedCase(S6).closeout).toMatchObject({ balance: 750, refund: 250 });
    expect(storedCase(S6).state).toBe("closed");

    await user.click(screen.getByRole("button", { name: /Final bill or refund/ }));
    expect(dialog().getByText("Your event ran $750 over the estimate, kept from your $1,000 deposit; $250 was refunded.")).toBeInTheDocument();
    expect(dialog().getAllByRole("columnheader", { name: "Actual" }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: /Tell us how it went/ }));
    await user.click(dialog().getAllByRole("radio")[4]);
    await user.click(dialog().getByRole("button", { name: "Send feedback" }));
    expect(storedCase(S6).closeout.feedback).toMatchObject({ rating: 5 });

    await user.click(screen.getByRole("button", { name: /Book again next year/ }));
    expect(dialog().getByText(/drafted for Sat, Apr 22, 2028/)).toBeInTheDocument();
    await user.click(dialog().getByRole("button", { name: "Book again next year" }));

    const pushed = lastPush();
    expect(pushed).toMatch(/^\/apply\?case=/);
    const newId = new URLSearchParams(pushed!.split("?")[1]).get("case")!;
    const draft = storedCase(newId);
    expect(draft.clonedFrom).toBe(S6);
    expect(draft.state).toBe("draft");
    expect(draft.schedule?.date).toBe("2028-04-22");
  }, 15000); // Many interactions in one flow, end to end; generous under load.
});

describe("the board's card sheet: a card the applicant no longer holds", () => {
  const sheet = () => within(screen.getByRole("dialog"));

  it("S3's accepted Certificate of insurance opens with nothing armed: one click cannot send a verified document back for checking", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });
    const before = storedCase(S3);

    await user.click(screen.getByRole("button", { name: /Certificate of insurance/ }));

    expect(sheet().getByText("Accepted by Health & Legal.")).toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    const replace = sheet().getByRole("button", { name: "Replace this file" });
    expect(replace).toBeDisabled();
    await user.click(replace);
    expect(storedCase(S3)).toBe(before);

    // Choosing a new file is what arms it; the engine then sends it to be checked again.
    await user.click(sheet().getByRole("button", { name: "Use sample file" }));
    await user.click(sheet().getByRole("button", { name: "Replace this file" }));
    const card = storedCase(S3).tasks.find((t) => t.catalogId === "insurance_certificate")!;
    expect(card.status).toBe("submitted");
    expect(card.payload.files).toEqual([{ name: "sample-upload.pdf", size: 240_000, type: "application/pdf" }]);
  });

  it("once the permit is issued an accepted document cannot be replaced at all (S6)", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    await user.click(screen.getByRole("button", { name: /Certificate of insurance/ }));

    expect(sheet().getByText("Accepted by Health & Legal.")).toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Replace this file" })).not.toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Use sample file" })).not.toBeInTheDocument();
  });

  it("S4's City services request, with the city, is read back and has no Send", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "maple-street-block-captain", path: routes.event(S4) });

    await user.click(screen.getByRole("button", { name: /City services request/ }));

    expect(sheet().getByText("With Public Works & Safety. You can't change it while they check it.")).toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(sheet().queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(sheet().getByText("Barricades").nextElementSibling).toHaveTextContent("4");
    expect(sheet().getByText("Trash collection").nextElementSibling).toHaveTextContent("No");
  });

  it("S3's accepted Sound details and Vendor list are read back and have no Send", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    await user.click(screen.getByRole("button", { name: /Sound details/ }));
    expect(sheet().getByText("Accepted by Public Works & Safety.")).toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(sheet().queryByRole("textbox")).not.toBeInTheDocument();
    expect(sheet().getByText("5 pm")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /Vendor list/ }));
    expect(sheet().queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Add a vendor" })).not.toBeInTheDocument();
    expect(sheet().getByText("Rolling Dumpling Co. · Dumplings and noodle bowls")).toBeInTheDocument();
  });

  it("a finished payment card shows what was paid and when, and links to the permit (S6)", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    await user.click(screen.getByRole("button", { name: /Pay fees and deposit/ }));

    const paid = storedCase(S6).payments.filter((p) => p.kind === "quote");
    expect(paid.length).toBeGreaterThan(0);
    expect(sheet().getAllByText(/paid (by card|in person) on /)).toHaveLength(paid.length);
    expect(sheet().getByRole("link", { name: "View permit" })).toHaveAttribute("href", routes.permit(S6));
    // The card's one sentence is in the header once, not again in the body.
    const why = storedCase(S6).tasks.find((t) => t.catalogId === "pay_fees")!.why;
    expect(sheet().getAllByText(why)).toHaveLength(1);
  });

  it("a finished sign-off card shows who signed and when (S6)", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    await user.click(screen.getByRole("button", { name: /Accept conditions and sign/ }));

    expect(sheet().getByText(/^Signed by .+ on \w{3}, \w{3} \d+, 2027$/)).toBeInTheDocument();
    expect(sheet().getByRole("link", { name: "View permit" })).toBeInTheDocument();
  });

  it("each vendor row of a stack says its status in words, not by icon alone (S6)", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    await user.click(screen.getByRole("button", { name: /Health permit|Vendor health permits/ }));

    const rows = sheet().getAllByRole("button", { name: /Health permit:/ });
    expect(rows.length).toBe(25);
    for (const row of rows) expect(row).toHaveTextContent("Done");
  });
});

describe("the board's Cancel dialog", () => {
  it("S2 after Pay and book: today's refund is the $20 that was paid, and cancelling refunds exactly that", async () => {
    const { user } = await renderScreen(<BoardScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.event(S2) });
    act(() => {
      useDemo.getState().dispatch(S2, { type: "book_and_pay", method: "card" }, "applicant");
    });

    await user.click(screen.getByRole("button", { name: "Board menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Today's refund: $20 (");
    expect(dialog).not.toHaveTextContent("$250");

    await user.click(within(dialog).getByRole("button", { name: "Cancel permit" }));
    expect(storedCase(S2).ending).toBe("cancelled");
    expect(storedCase(S2).payments.at(-1)).toMatchObject({ kind: "refund", amount: -20 });
  });
});

describe("the board: an ended case", () => {
  it("a withdrawn background case shows its banner and only Done cards", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "new", path: routes.event(WITHDRAWN) });

    expect(screen.getAllByText("Withdrawn").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Do now" })).not.toBeInTheDocument();
  });
});

describe("the board: unknown case id", () => {
  it("shows Case not found", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "new", path: routes.event("PMT-27-9999") });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("the board: below 768px", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("the columns become tabs with counts, down to 375px", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    expect(screen.getByRole("tab", { name: /Do now/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Done/ })).toBeInTheDocument();

    // Four nowrap tabs with counts need about 450px: two rows of two fit a 335px container.
    const tabList = screen.getByRole("tablist");
    expect(tabList.className).toContain("grid-cols-2");
    expect(tabList.className).not.toContain("h-11");
    expect(within(tabList).getAllByRole("tab")).toHaveLength(4);
  });

  it("the header's stepper is markers and the one current label, not eight labels in a row", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: true, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })),
    );

    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "downtown-arts-collective", path: routes.event(S3) });

    const stepper = screen.getByRole("list", { name: "Case progress" });
    expect(stepper).toHaveAttribute("data-compact", "true");
    // No visible label per step: only the current one, under the markers.
    expect(stepper.querySelectorAll('[aria-hidden="true"].whitespace-nowrap')).toHaveLength(0);
    expect(stepper.parentElement).toHaveTextContent(/Needs info$/);
  });
});

describe("My events", () => {
  it("lists Maya Chen's picnic with a permit link", async () => {
    await renderScreen(<MyEventsScreen />, { role: "applicant", personaId: "maya-chen", path: routes.events() });

    expect(screen.getByText("Maya Chen's 40th birthday picnic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View permit/ })).toHaveAttribute("href", routes.permit("PMT-27-0109"));
  });

  it("a new applicant sees the empty state", async () => {
    await renderScreen(<MyEventsScreen />, { role: "applicant", personaId: "new", path: routes.events() });

    expect(screen.getByText("No events yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Plan an event/ }).length).toBeGreaterThan(0);
  });
});

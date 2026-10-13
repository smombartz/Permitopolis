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

describe("the board (S6): after the event", () => {
  it("shows the final bill and feedback coming up", async () => {
    await renderScreen(<BoardScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.event(S6) });

    const comingUpHeading = screen.getByRole("heading", { level: 3, name: "Coming up" });
    const comingUpColumn = comingUpHeading.parentElement!.parentElement!;
    expect(within(comingUpColumn).getByText("Final bill or refund")).toBeInTheDocument();
    expect(within(comingUpColumn).getByText("Tell us how it went")).toBeInTheDocument();
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

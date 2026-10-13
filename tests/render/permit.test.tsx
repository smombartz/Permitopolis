import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermitScreen } from "@/components/permit/PermitScreen";
import { VerifyScreen } from "@/components/permit/VerifyScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { renderScreen, storedCase } from "./harness";

const S1 = "PMT-27-0109";
const S2 = "PMT-27-0142";
const S5 = "PMT-27-0097";
const S6 = "PMT-27-0031";

describe("PermitScreen", () => {
  it("S1 shows the QR code, Shelter 3, Sat, May 22, 2027, 11 am to 4 pm and a $62.50 refund", async () => {
    await renderScreen(<PermitScreen />, { scenario: "S1" });

    expect(screen.getByRole("heading", { level: 1, name: "Maya Chen's 40th birthday picnic" })).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument(); // the QR code
    expect(screen.getByText(routes.verify(S1))).toBeInTheDocument();
    expect(screen.getAllByText(/Shelter 3/).length).toBeGreaterThan(0);
    expect(screen.getByText("Sat, May 22, 2027, 11 am to 4 pm")).toBeInTheDocument();
    expect(screen.getByText("$62.50")).toBeInTheDocument();
    expect(screen.getByText(/refund\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });

  it("S2 after Pay and book (demo path 1): cancelling today refunds $10, the $20 paid minus the $10 processing fee of the band marked \"Applies today\", not the $250 the 13 sessions come to", async () => {
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "sunrise-yoga-club", path: routes.permit(S2) });
    act(() => {
      useDemo.getState().dispatch(S2, { type: "book_and_pay", method: "card" }, "applicant");
    });
    expect(storedCase(S2).state).toBe("permitted");

    const todays = within(screen.getByRole("list", { name: "Cancellation schedule" })).getAllByRole("listitem").filter((band) => band.getAttribute("aria-current") === "true");
    expect(todays.map((band) => band.textContent)).toEqual(["30 or more days before: full refund minus a $10 processing fee · Applies today"]);
    const line = screen.getByText(/If cancelled today/);
    expect(within(line).getByText("$10")).toBeInTheDocument();
    expect(screen.queryByText("$250")).not.toBeInTheDocument();
  });

  it("the cancellation schedule lists every band and marks the one that applies today", async () => {
    await renderScreen(<PermitScreen />, { scenario: "S1" });

    const schedule = screen.getByRole("list", { name: "Cancellation schedule" });
    const bands = within(schedule).getAllByRole("listitem");
    expect(bands.length).toBe(useDemo.getState().cfg.cancellation.length);
    // S1 is 19 days out on May 3: the 10 to 29 day band.
    const todays = bands.filter((band) => band.getAttribute("aria-current") === "true");
    expect(todays).toHaveLength(1);
    expect(todays[0]).toHaveTextContent(/10 to 29 days/);
    expect(todays[0]).toHaveTextContent(/Applies today/);
  });

  it("the conditions carry no \"Merged\" badge: that is the Clerk's bookkeeping, not something an applicant or an officer reads", async () => {
    // Cascade Trail Runners' ultra is permitted, and both its conditions went through the Clerk's quote.
    const ULTRA = "PMT-27-0030";
    const permit = await renderScreen(<PermitScreen />, { role: "applicant", personaId: "cascade-trail-runners", path: routes.permit(ULTRA) });
    expect(storedCase(ULTRA).conditions.map((cond) => cond.mergedByClerk)).toEqual([true, true]);
    expect(document.querySelector('[data-slot="condition-list"]')).not.toBeNull();
    expect(screen.queryByText("Merged")).not.toBeInTheDocument();
    permit.unmount();

    // The public check an officer opens from the QR code.
    await renderScreen(<VerifyScreen />, { path: routes.verify(ULTRA) });
    expect(document.querySelector('[data-slot="condition-list"]')).not.toBeNull();
    expect(screen.queryByText("Merged")).not.toBeInTheDocument();
  });

  it("S6 (in Closeout, the event is over) has no \"If cancelled today\" line", async () => {
    await renderScreen(<PermitScreen />, { role: "applicant", personaId: "main-street-business-alliance", path: routes.permit(S6) });

    expect(screen.getByRole("heading", { level: 1, name: "Main Street Food Truck Festival" })).toBeInTheDocument();
    expect(screen.queryByText(/If cancelled today/)).not.toBeInTheDocument();
  });

  it("S5 (no permit yet) explains why and links to the board", async () => {
    await renderScreen(<PermitScreen />, {
      role: "applicant",
      personaId: "riverfront-running-club",
      path: routes.permit(S5),
    });

    expect(screen.getByText("No permit has been issued for this event yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Back to your board" });
    for (const link of links) expect(link).toHaveAttribute("href", routes.event(S5));
  });

  it("an unknown case id shows CaseNotFound", async () => {
    await renderScreen(<PermitScreen />, {
      role: "applicant",
      path: "/events/PMT-00-0000/permit",
      params: { id: "PMT-00-0000" },
    });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("VerifyScreen", () => {
  it("S1 reads Valid", async () => {
    await renderScreen(<VerifyScreen />, { path: routes.verify(S1), params: { id: S1 } });
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Maya Chen's 40th birthday picnic")).toBeInTheDocument();
  });

  it("S5 reads Not valid (not yet issued)", async () => {
    await renderScreen(<VerifyScreen />, { path: routes.verify(S5), params: { id: S5 } });
    expect(screen.getByText("Not valid")).toBeInTheDocument();
    expect(screen.getByText(/hasn't been issued/i)).toBeInTheDocument();
  });

  it("an unknown id reads Not valid: no such permit", async () => {
    await renderScreen(<VerifyScreen />, { path: "/verify/PMT-00-0000", params: { id: "PMT-00-0000" } });
    expect(screen.getByText("Not valid")).toBeInTheDocument();
    expect(screen.getByText(/no permit/i)).toBeInTheDocument();
  });
});

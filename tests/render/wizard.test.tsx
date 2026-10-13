import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardScreen } from "@/components/wizard/WizardScreen";
import { routes } from "@/lib/routes";
import { lastPush, lastReplace, renderScreen, storedCase } from "./harness";

const S1 = "PMT-27-0109";
const S2 = "PMT-27-0142";

/** The live result panel: on jsdom (no real matchMedia changes) it is always the StickyAside. */
function panel() {
  const node = document.querySelector('[data-slot="sticky-aside"]');
  if (!node) throw new Error("the result panel is not on screen");
  return within(node as HTMLElement);
}

const dateButton = (label: RegExp) => screen.getByRole("button", { name: label });

describe("WizardScreen: unknown and non-draft cases", () => {
  it("shows CaseNotFound for a case id that isn't in the demo", async () => {
    await renderScreen(<WizardScreen />, { path: "/apply", search: { case: "PMT-27-9999" } });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });

  it("sends a case that is no longer a Draft to its board", async () => {
    await renderScreen(<WizardScreen />, { path: routes.apply({ caseId: S1 }), personaId: "maya-chen" });
    expect(lastReplace()).toBe(routes.event(S1));
  });
});

describe("WizardScreen: S2 (scenario S2)", () => {
  it("opens at step 'when' with repeat on, 13 sessions and the Jul 11 session Impacted", async () => {
    await renderScreen(<WizardScreen />, { scenario: "S2" });

    expect(screen.getByRole("heading", { level: 1, name: "Sunrise Yoga Club weekly class" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Repeat" })).toBeChecked();
    expect(screen.getAllByText(/13 sessions/).length).toBeGreaterThan(0);

    const jul11Row = screen.getByText("Sun, Jul 11, 2027").closest("li")!;
    expect(within(jul11Row).getByText("Impacted")).toBeInTheDocument();
  });

  it("finishing the wizard goes to the quote route (the quote screen books it, not the wizard)", async () => {
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2" });

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2, name: "Your plan at a glance" })).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Book and pay $20" });
    expect(button).toBeEnabled();
    await user.click(button);

    expect(lastPush()).toBe(routes.quote(S2));
    // The wizard itself never dispatches book_and_pay: the case is still a Draft.
    expect(storedCase(S2).state).toBe("draft");
  });
});

describe("WizardScreen: a new applicant watches the tier move (demo path 2)", () => {
  it("Shelter 2 for 40 is Instant; alcohol makes it Reviewed and the what-if brings it back; two Main Street blocks make it Special; 1,200 people with no street is still Special", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });

    // Step 1: What.
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Summer picnic");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 2: Where.
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 3: When - Jun 19, comfortably past Instant's 10-day lead time.
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    await user.click(screen.getByRole("button", { name: /June 19th, 2027/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 4: Size.
    await user.type(screen.getByLabelText(/Expected attendance/), "40");
    expect(panel().getByText("Instant")).toBeInTheDocument();

    // Turn on alcohol: Reviewed, and the what-if chip offers the way back.
    await user.click(screen.getByRole("switch", { name: "Alcohol" }));
    expect(panel().getByText("Reviewed")).toBeInTheDocument();
    const whatIfButton = panel().getByRole("button", { name: "Remove alcohol: Instant, book today" });
    await user.click(whatIfButton);
    expect(panel().getByText("Instant")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Alcohol" })).not.toBeChecked();

    // Switch the location to two Main Street blocks: Special event.
    await user.click(screen.getByRole("button", { name: /^Where/ }));
    await user.click(screen.getByRole("tab", { name: "Street segments" }));
    const streets = within(screen.getByRole("list", { name: "Street segments" }));
    await user.click(streets.getByRole("button", { name: /Main Street, 1st to 2nd/ }));
    await user.click(streets.getByRole("button", { name: /Main Street, 2nd to 3rd/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(panel().getByText("Special event")).toBeInTheDocument();

    // Set attendance to 1,200 with no street: still Special.
    await user.click(screen.getByRole("button", { name: /^Where/ }));
    await user.click(screen.getByRole("tab", { name: "Bookable spaces" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const attendance = screen.getByLabelText(/Expected attendance/);
    await user.clear(attendance);
    await user.type(attendance, "1200");
    expect(panel().getByText("Special event")).toBeInTheDocument();
  });
});

describe("WizardScreen: availability and the lead-time gate", () => {
  it("a booked date (Shelter 3 on May 22) shows Booked with next open dates", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });

    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Family reunion");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 3/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(dateButton(/May 22nd, 2027/));

    expect(screen.getAllByText("Booked").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Maya Chen's 40th birthday picnic has this date held/).length).toBeGreaterThan(0);
    // At least one next-open-date button is offered.
    expect(screen.getAllByRole("button", { name: /\d{4}$/ }).length).toBeGreaterThan(0);
  });

  it("a date 19 days out for a Reviewed event shows all three fixes", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });

    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Neighborhood jam"); // amplified sound needs a reason to be Reviewed
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(dateButton(/May 22nd, 2027/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    // Back to "When" to see the gate (it reads from the live panel on every step).
    await user.click(screen.getByRole("button", { name: /^When/ }));

    expect(screen.getByRole("button", { name: /^Use / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop amplified sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();
  });
});

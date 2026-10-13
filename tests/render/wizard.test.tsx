import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WizardScreen } from "@/components/wizard/WizardScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { holdNavigation, lastPush, lastReplace, releaseNavigation, renderScreen, storedCase } from "./harness";
import { navState } from "./setup";

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
    await user.click(screen.getByRole("button", { name: /Where, done, edit/ }));
    await user.click(screen.getByRole("tab", { name: "Street segments" }));
    const streets = within(screen.getByRole("list", { name: "Street segments" }));
    await user.click(streets.getByRole("button", { name: /Main Street, 1st to 2nd/ }));
    await user.click(streets.getByRole("button", { name: /Main Street, 2nd to 3rd/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(panel().getByText("Special event")).toBeInTheDocument();

    // Set attendance to 1,200 with no street: still Special.
    await user.click(screen.getByRole("button", { name: /Where, done, edit/ }));
    await user.click(screen.getByRole("tab", { name: "Bookable spaces" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const attendance = screen.getByLabelText(/Expected attendance/);
    await user.clear(attendance);
    await user.type(attendance, "1200");
    expect(panel().getByText("Special event")).toBeInTheDocument();
    // Some forty interactions: more than the default 5s when the whole suite runs in parallel.
  }, 30_000);
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
    await user.click(screen.getByRole("button", { name: /When, done, edit/ }));

    expect(screen.getByRole("button", { name: /^Use / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop amplified sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();
    // The PRD's words: 19 days left, 30 needed. Not "19 more days".
    expect(screen.getByText("19 days left, 30 needed. This event needs 11 more days of notice than it has.")).toBeInTheDocument();
    expect(screen.queryByText(/needs 19 more/)).not.toBeInTheDocument();
  });

  /** A Reviewed event 19 days out, left on step 4 where the gate was tripped. */
  async function tooCloseOnStepSize() {
    const view = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });
    const { user } = view;
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));
    await user.type(screen.getByLabelText(/Event name/), "Neighborhood jam");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(dateButton(/May 22nd, 2027/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText(/Expected attendance/), "40");
    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));
    return view;
  }

  const draftId = () => navState.search.get("case")!;

  it("step 5 carries the gate and its three fixes, so a gate tripped on step 4 is not a dead end", async () => {
    const { user } = await tooCloseOnStepSize();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { level: 2, name: "Your plan at a glance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create my to-do board" })).toBeDisabled();
    expect(screen.getByText(/^19 days left, 30 needed\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop amplified sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();

    // "Use <date>" moves the date from here, and the plan can go ahead.
    await user.click(screen.getByRole("button", { name: /^Use / }));
    expect(storedCase(draftId()).schedule?.date).not.toBe("2027-05-22");
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create my to-do board" })).toBeEnabled();
  });

  it("choosing the late fee says so, enables the plan, and can be taken back", async () => {
    const { user } = await tooCloseOnStepSize();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ }));
    expect(storedCase(draftId()).flags.lateFee).toBe(true);
    expect(screen.getByText(/late fee is added, so this date can stand\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay a / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create my to-do board" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove the late fee" }));
    expect(storedCase(draftId()).flags.lateFee).toBe(false);
    expect(screen.getByRole("button", { name: /^Pay a \$[\d.]+ late fee$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create my to-do board" })).toBeDisabled();
  });
});

describe("WizardScreen: a blank wizard", () => {
  it("Next moves on before anything is chosen, and no draft is started for it", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });
    const before = useDemo.getState().cases.length;

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2, name: "Where?" })).toBeInTheDocument();
    expect(useDemo.getState().cases.length).toBe(before);

    // The stepper works the same way, and so does Back.
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 2, name: "What are you planning?" })).toBeInTheDocument();
  });

  it("a draft started on a later step stays on that step", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });
    const before = useDemo.getState().cases.length;

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /^Shelter 2/ }));

    expect(useDemo.getState().cases.length).toBe(before + 1);
    expect(screen.getByRole("heading", { level: 2, name: "Where?" })).toBeInTheDocument();
    expect(navState.search.get("step")).toBe("where");
  });

  it("typing a name before the URL carries the draft id makes one draft, not one per letter", async () => {
    const { user } = await renderScreen(<WizardScreen />, { path: "/apply", personaId: "new" });
    const before = useDemo.getState().cases.length;

    // router.replace() is a transition in the app: the URL catches up after the keystrokes.
    holdNavigation();
    const name = screen.getByLabelText(/Event name/);
    await user.type(name, "Jazz");
    await user.click(screen.getByRole("radio", { name: /^Picnic or party/ }));

    const created = useDemo.getState().cases.slice(before);
    expect(created.map((c) => c.name)).toEqual(["Jazz"]);
    expect(created[0].eventType).toBe("picnic_party");
    expect(name).toHaveValue("Jazz");

    act(() => releaseNavigation());
    expect(navState.search.get("case")).toBe(created[0].id);
    await user.type(screen.getByLabelText(/Event name/), " night");
    expect(useDemo.getState().cases.slice(before).map((c) => c.name)).toEqual(["Jazz night"]);
  });
});

describe("WizardScreen: step 4's vendor names", () => {
  it("takes names with spaces and more than one vendor, and stores them as a list", async () => {
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("switch", { name: "Food or vending" }));

    const field = screen.getByLabelText(/Vendor names/);
    await user.type(field, "Rolling Dumpling Co., Bao Bus");

    expect(field).toHaveValue("Rolling Dumpling Co., Bao Bus");
    expect(storedCase(S2).addOns.foodVending?.vendorNames).toEqual(["Rolling Dumpling Co.", "Bao Bus"]);
    expect(screen.getByText("Optional, separated by commas.")).toBeInTheDocument();
  });
});

describe("WizardScreen: step 3's repeat follows the date", () => {
  it("moving S2's series from a Sunday to a Saturday repeats on Saturdays", async () => {
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2" });
    expect(screen.getByText(/Repeats every Sunday/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(dateButton(/June 12th, 2027/));

    expect(screen.getByText(/Repeats every Saturday/)).toBeInTheDocument();
    const schedule = storedCase(S2).schedule!;
    expect(schedule.recurrence?.weekday).toBe(6);
    expect(schedule.occurrences.every((o) => new Date(`${o.date}T12:00`).getDay() === 6)).toBe(true);
  });
});

describe("WizardScreen below 1024px: the tier change reaches a phone", () => {
  afterEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({ matches: false, media: query }) as unknown as MediaQueryList);
  });

  it("a tier change from a step field is announced and rings the bottom bar's badge while the panel's sheet is shut", async () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList,
    );
    const { user } = await renderScreen(<WizardScreen />, { scenario: "S2" });
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The result panel is in a closed sheet: nothing of it is mounted.
    expect(document.querySelector('[data-slot="wizard-result-panel"]')).toBeNull();
    const announcement = document.querySelector('[data-slot="wizard-tier-announcement"]')!;
    expect(announcement).toHaveAttribute("role", "status");
    expect(announcement).toBeEmptyDOMElement();

    await user.click(screen.getByRole("switch", { name: "Amplified sound" }));

    expect(announcement).toHaveTextContent(/Reviewed event/);
    expect(document.querySelector('[data-slot="wizard-bar-tier"]')).toHaveAttribute("data-highlight", "true");
  });
});

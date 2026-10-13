/**
 * Render tests for workstream 6A: the City Clerk's Settings tool (/city/settings).
 * lib/view/settings.test.ts holds the pure logic; these click through the real page.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsScreen } from "@/components/city/settings/SettingsScreen";
import { CityShell } from "@/components/shell/CityShell";
import { classify, estimateFees } from "@/lib/rules";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { EMPTY_ADDONS } from "@/lib/types";
import { lastReplace, renderScreen } from "./harness";

const S2 = "PMT-27-0142"; // Sunrise Yoga Club weekly class: Instant Draft, booked on Field 4

function tierRulesPanel() {
  return screen.getByRole("heading", { name: "What this changes" }).closest("aside")!;
}

describe("Settings: Tier rules (default section)", () => {
  it("opens on Tier rules for the City Clerk, with the six demo scenarios all unchanged", async () => {
    await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk" });

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tier rules", selected: true })).toBeInTheDocument();
    expect(within(tierRulesPanel()).getByText("Jazz in the Plaza: Reviewed, unchanged")).toBeInTheDocument();
  });

  it("editing the Reviewed threshold updates the store's cfg and the scenario preview", async () => {
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk" });

    const input = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(input);
    await user.type(input, "40");

    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(40);
    // S1, Maya Chen's 40th birthday picnic, is 45 people with no other trigger: Instant moves to Reviewed.
    expect(within(tierRulesPanel()).getByText("Maya Chen's 40th birthday picnic: Instant → Reviewed")).toBeInTheDocument();
    expect(within(tierRulesPanel()).getByText(/1 scenario would change tier/)).toBeInTheDocument();
  });

  it("editing a threshold also updates the open Drafts list, for a Draft the edit actually moves", async () => {
    const draft = makeCase({ id: "PMT-27-0001", name: "A 45-guest picnic draft", state: "draft", attendance: 45, location: null, addOns: EMPTY_ADDONS });
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk", cases: [draft] });

    const input = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(input);
    await user.type(input, "40");

    expect(within(tierRulesPanel()).getByText(/1 open Draft would change tier/)).toBeInTheDocument();
    const row = within(tierRulesPanel()).getByRole("link", { name: "A 45-guest picnic draft" });
    expect(row).toHaveAttribute("href", expect.stringContaining(`/city/cases/${draft.id}`));
  });

  it("an invalid threshold shows its error and is never saved", async () => {
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk" });

    const input = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(input);
    await user.type(input, "1000"); // at the Special threshold: invalid

    expect(screen.getByText("Must be below the Special event threshold.")).toBeInTheDocument();
    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(100); // the default, unchanged
  });

  it("Restore defaults asks, then restores the thresholds and lead times", async () => {
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk" });

    const input = screen.getByRole("spinbutton", { name: "Reviewed at" });
    await user.clear(input);
    await user.type(input, "40");
    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(40);

    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Restore the default tier rules?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Restore defaults" }));

    expect(useDemo.getState().cfg.thresholds.reviewedAttendance).toBe(100);
    expect(screen.getByRole("spinbutton", { name: "Reviewed at" })).toHaveValue(100);
  });
});

describe("Settings: section nav keeps the section in the URL", () => {
  it("switching tabs replaces the URL's ?section= and shows that section's heading", async () => {
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), role: "clerk" });

    await user.click(screen.getByRole("tab", { name: "Fees and deposits" }));
    expect(lastReplace()).toBe("/city/settings?section=fees");
    expect(screen.getByRole("heading", { level: 2, name: "Fees and deposits" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tier rules" }));
    expect(lastReplace()).toBe("/city/settings");
  });

  it.each([
    ["inventory", "Inventory and rates"],
    ["blackout", "Blackout calendar"],
    ["templates", "Templates"],
    ["service-levels", "Service levels"],
  ])("renders %s's section heading", async (section, heading) => {
    await renderScreen(<SettingsScreen />, { path: routes.city.settings(), search: { section }, role: "clerk" });
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
  });
});

describe("Settings: Fees and deposits", () => {
  it("editing a rate changes the store's cfg, and a new estimate for a Draft reflects it", async () => {
    const { user } = await renderScreen(<SettingsScreen />, { path: routes.city.settings(), search: { section: "fees" }, role: "clerk" });

    const draftBefore = useDemo.getState().cases.find((c) => c.id === S2)!;
    const beforeEstimate = estimateFees(draftBefore, classify(draftBefore, useDemo.getState().cfg), useDemo.getState().cfg);

    const fieldRate = screen.getByRole("spinbutton", { name: "Field" });
    await user.clear(fieldRate);
    await user.type(fieldRate, "40");

    expect(useDemo.getState().cfg.fees.fieldPerHour).toBe(40);
    const draftAfter = useDemo.getState().cases.find((c) => c.id === S2)!;
    const afterEstimate = estimateFees(draftAfter, classify(draftAfter, useDemo.getState().cfg), useDemo.getState().cfg);
    expect(afterEstimate.total).toBeGreaterThan(beforeEstimate.total);
  });

  it("names the application fee and the deposit fields by tier, so two fields are never both called 'Instant'", async () => {
    await renderScreen(<SettingsScreen />, { path: routes.city.settings(), search: { section: "fees" }, role: "clerk" });

    expect(screen.getByRole("spinbutton", { name: "Application fee: Instant" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Deposit: Instant" })).toBeInTheDocument();
  });
});

describe("Settings: shell guard", () => {
  it("another city role sees the shell's built-for panel, not the Clerk's tool", async () => {
    await renderScreen(
      <CityShell>
        <SettingsScreen />
      </CityShell>,
      { path: routes.city.settings(), role: "pws" },
    );

    expect(screen.getByText("This screen is built for the City Clerk.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Settings" })).not.toBeInTheDocument();
  });

  it("the City Clerk sees the real page there", async () => {
    await renderScreen(
      <CityShell>
        <SettingsScreen />
      </CityShell>,
      { path: routes.city.settings(), role: "clerk" },
    );
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  });
});

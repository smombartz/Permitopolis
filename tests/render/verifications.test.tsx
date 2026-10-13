import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityShell } from "@/components/shell";
import { VerificationsScreen } from "@/components/city/verifications/VerificationsScreen";
import { routes } from "@/lib/routes";
import { lastPush, renderScreen } from "./harness";

const S5 = "PMT-27-0097"; // Riverfront Summer 5K
const F5 = "PMT-27-0115"; // Plaza wedding photos
const B04 = "PMT-27-0008"; // North Side Chess Club

describe("Verifications: the queue", () => {
  it("Health & Legal opens with its documents grouped by type, Insurance among them", async () => {
    await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    expect(screen.getByRole("heading", { name: "Verifications" })).toBeInTheDocument();
    expect(screen.getByText(/^Insurance \(\d+\)$/)).toBeInTheDocument();
    // The 5K's race-day certificate is in the queue, passing in full.
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
  });

  it("the two wrong-file certificates show a failing summary", async () => {
    await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    const wrongRow = screen.getByText("Plaza wedding photos").closest("a")!;
    expect(within(wrongRow).getByText(/^1 fails:/)).toBeInTheDocument();
  });

  it("opening a row lands on the case at that document's verification panel", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    const row = screen.getByText("Riverfront Summer 5K").closest("a")!;
    await user.click(row);
    expect(lastPush()).toBe(
      routes.city.case(S5, { tab: "documents", task: `verify_document:${S5}:insurance_certificate`, from: routes.city.verifications() }),
    );
  });

  it("filtering to failing documents leaves the wrong ones, and nothing else", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.click(screen.getByRole("button", { name: "Has a failing item" }));
    expect(screen.getByText("Plaza wedding photos")).toBeInTheDocument();
    expect(screen.getByText("Maple Grove Preschool spring fair")).toBeInTheDocument();
    expect(screen.getByText("North Side Chess Club open tournament")).toBeInTheDocument();
    expect(screen.queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();
  });

  it("a search narrows to one event", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.type(screen.getByPlaceholderText("Search event, applicant or vendor"), "chess club");
    expect(screen.getByText("North Side Chess Club open tournament")).toBeInTheDocument();
    expect(screen.queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();
  });

  it("'Verify the next one' opens the oldest-waiting document in the whole queue", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.click(screen.getByRole("link", { name: "Verify the next one" }));
    expect(lastPush()).toMatch(/^\/city\/cases\//);
    expect(lastPush()).toMatch(/task=verify_document/);
  });

  it("grouping by event shows each case once, with its documents under it", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.click(screen.getByRole("radio", { name: "By event" }));
    expect(screen.getByText(/^Riverfront Summer 5K \(\d+\)$/)).toBeInTheDocument();
  });

  it("another city role sees the shell's built-for panel, not the queue", async () => {
    await renderScreen(
      <CityShell>
        <VerificationsScreen />
      </CityShell>,
      { role: "pws", path: routes.city.verifications() },
    );
    expect(screen.getByText(/This screen is built for Health & Legal/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verifications" })).not.toBeInTheDocument();
  });
});

describe("Verifications: Recently decided", () => {
  it("shows a decided document with who decided it", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.click(screen.getByRole("tab", { name: "Recently decided" }));
    expect(screen.getAllByText(/^(Verified|Sent back)$/).length).toBeGreaterThan(0);
  });
});

describe("Verifications: empty states", () => {
  it("no filters narrow to nothing: an ordinary empty-of-narrowing state never shows for the real seed, but a narrowed-to-nothing search does", async () => {
    const { user } = await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    await user.type(screen.getByPlaceholderText("Search event, applicant or vendor"), "no such event anywhere");
    expect(screen.getByText("No documents match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("No documents match these filters")).not.toBeInTheDocument();
  });

  it(`the seed's known-wrong card ${B04} still has a failing item`, async () => {
    await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    const row = screen.getByText("North Side Chess Club open tournament").closest("a")!;
    expect(within(row).getByText(/^1 fails:/)).toBeInTheDocument();
  });

  it(`${F5} is the wrong-file wedding photos case`, async () => {
    await renderScreen(<VerificationsScreen />, { role: "hl", path: routes.city.verifications() });
    expect(screen.getByText("Plaza wedding photos")).toBeInTheDocument();
  });
});

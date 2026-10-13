import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { useDemo } from "@/lib/state";
import { lastPush, renderScreen } from "./harness";

const S3 = "PMT-27-0118";
const HEALTH_PERMIT = `${S3}:vendor_health_permit:1`;

describe("CoachStrip", () => {
  it("with hints on and S3 on screen, shows path 3 step 1", async () => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    expect(screen.getByText("Path 3 · Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Open the pinned card, use the sample file, send. The card moves to With the city.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to this step" })).toBeInTheDocument();
  });

  it("after the applicant answers, shows step 2 with a Switch to Health & Legal button that lands on the case as that role", async () => {
    const { user } = await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });

    act(() => {
      const result = useDemo.getState().dispatch(S3, {
        type: "respond_to_request",
        taskId: HEALTH_PERMIT,
        files: [{ name: "sample-health-permit.pdf", size: 248_000, type: "application/pdf" }],
      });
      expect(result.ok).toBe(true);
    });

    expect(screen.getByText("Path 3 · Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Verify it and approve the section.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Switch to Health & Legal" });

    await user.click(button);

    expect(useDemo.getState().role).toBe("hl");
    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
  });

  it("hints off hides the strip", async () => {
    await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });
    expect(screen.getByText("Path 3 · Step 1 of 5")).toBeInTheDocument();

    act(() => {
      useDemo.getState().toggleHints();
    });

    expect(screen.queryByText(/^Path 3/)).not.toBeInTheDocument();
  });

  it("is dismissible, and never shows on the landing page (no shell to mount it in)", async () => {
    const { user } = await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });
    expect(screen.getByText("Path 3 · Step 1 of 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss the demo coach" }));

    expect(screen.queryByText(/^Path 3/)).not.toBeInTheDocument();
  });

  it("derives path 5 for a city role on S5, and the Next path menu jumps to another path", async () => {
    const { user } = await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5" });

    expect(screen.getByText("Path 5 · Step 1 of 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next path" }));
    await user.click(screen.getByRole("menuitem", { name: "Path 6: Closeout" }));

    expect(useDemo.getState().role).toBe("pws");
    expect(lastPush()).toBe("/city/cases/PMT-27-0031");
  });

  it("shows the done state once every step has happened", async () => {
    await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S4" });

    act(() => {
      const state = useDemo.getState();
      state.setRole("applicant");
      state.setPersona("maple-street-block-captain");
      for (let i = 0; i < 3; i++) expect(state.dispatch("PMT-27-0126", { type: "simulate_signoff" }).ok).toBe(true);
      state.setRole("clerk");
      expect(state.dispatch("PMT-27-0126", { type: "accept_complete" }).ok).toBe(true);
      expect(
        state.dispatch("PMT-27-0126", {
          type: "confirm_routing",
          reviewers: [
            { dept: "pws", sections: ["City services request"], dueDate: "2027-05-17" },
            { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-05-17" },
          ],
        }).ok,
      ).toBe(true);
      state.setRole("pws");
    });

    expect(screen.getByText("Path 4 · Done")).toBeInTheDocument();
    expect(screen.getByText("Neighbors and the date hold: every step is done.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Switch to|Go to this step/ })).not.toBeInTheDocument();
  });
});

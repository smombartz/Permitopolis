import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { DemoGuideScreen } from "@/components/landing/DemoGuideScreen";
import { useDemo } from "@/lib/state";
import { routes } from "@/lib/routes";
import { lastPush, renderScreen } from "./harness";

describe("LandingScreen (/)", () => {
  it("renders the one h1 and the live hero preview at its Instant default", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const hero = screen.getByRole("group", { name: /Try it/ });
    expect(within(hero).getByText("Instant")).toBeInTheDocument();
  });

  it("changing the hero preview (alcohol on) moves the tier to Reviewed live", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    const hero = screen.getByRole("group", { name: /Try it/ });
    await user.click(within(hero).getByRole("switch", { name: "Alcohol" }));

    expect(within(hero).getByText("Reviewed")).toBeInTheDocument();
    expect(within(hero).queryByText("Instant")).not.toBeInTheDocument();
  });

  it("switching the hero preview to a street moves the tier to Special", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    const hero = screen.getByRole("group", { name: /Try it/ });
    await user.click(within(hero).getByRole("radio", { name: "A street" }));

    expect(within(hero).getByText("Special event")).toBeInTheDocument();
  });

  it("the primary nav and the footer are page landmarks beside <main>, not inside it", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    const main = screen.getByRole("main");
    const nav = screen.getAllByRole("navigation")[0];
    const footer = screen.getByRole("contentinfo");
    expect(main.contains(nav)).toBe(false);
    expect(main.contains(footer)).toBe(false);
    // In reading order: nav, main, footer.
    expect(nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(footer).getByRole("link", { name: /Open the demo guide/ })).toBeInTheDocument();
  });

  it("the fee schedule panel shows $25 per hour for a shelter", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });
    expect(screen.getByText("$25 per hour")).toBeInTheDocument();
  });

  it("opens an FAQ item", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    const trigger = screen.getByRole("button", { name: "Do I need insurance?" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Health & Legal checks it/)).toBeInTheDocument();
  });

  it("Plan an event sets the role to Applicant and opens the wizard", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/", role: "clerk" });

    await user.click(screen.getAllByRole("link", { name: "Plan an event" })[0]);

    expect(useDemo.getState().role).toBe("applicant");
    expect(lastPush()).toBe(routes.apply());
  });

  it("City staff switches to the City Clerk and opens its queue", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    await user.click(screen.getAllByRole("link", { name: "City staff" })[0]);

    expect(useDemo.getState().role).toBe("clerk");
    expect(lastPush()).toBe(routes.city.queue());
  });
});

describe("DemoGuideScreen (/demo)", () => {
  it("renders the demo paths and the scenario table", async () => {
    await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    expect(screen.getByRole("heading", { name: "Presenting Permitopolis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Answer a request" })).toBeInTheDocument();
    expect(screen.getByText("S3 · Downtown Arts Collective")).toBeInTheDocument();
  });

  it("starts demo path 3 from the guide: the router goes to the S3 board as Downtown Arts Collective", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    const heading = screen.getByRole("heading", { name: "Answer a request" });
    const card = heading.closest('[data-slot="panel"]') as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Start this path" }));

    expect(lastPush()).toBe("/events/PMT-27-0118");
    expect(useDemo.getState().role).toBe("applicant");
    expect(useDemo.getState().personaId).toBe("downtown-arts-collective");
    // The demo coach is on path 3 from here on, on every page.
    expect(useDemo.getState().activeDemoPath).toBe(3);
  });

  it("Continue goes to the step the path has reached, as the role that step is for", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });
    // Path 3's first step has happened: the applicant answered Health & Legal's request.
    act(() => {
      const state = useDemo.getState();
      const result = state.dispatch("PMT-27-0118", { type: "respond_to_request", taskId: "PMT-27-0118:vendor_health_permit:1", files: [{ name: "permit.pdf", size: 1000, type: "application/pdf" }] });
      expect(result.ok).toBe(true);
    });

    const card = screen.getByRole("heading", { name: "Answer a request" }).closest('[data-slot="panel"]') as HTMLElement;
    expect(within(card).getByText("Step 2 of 5")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Continue" }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
    expect(useDemo.getState()).toMatchObject({ role: "hl", activeDemoPath: 3 });
  });

  it("a scenario's Jump puts the coach on the path built on that scenario", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    const row = screen.getByText("S6 · Main Street Food Truck Festival").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Jump" }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0031");
    expect(useDemo.getState()).toMatchObject({ role: "pws", personaId: "main-street-business-alliance", activeDemoPath: 6 });
  });

  it("Reset asks for confirmation before restoring the seed", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    await user.click(screen.getByRole("button", { name: /Reset demo data/ }));
    expect(screen.getByRole("heading", { name: "Reset the demo?" })).toBeInTheDocument();
  });
});

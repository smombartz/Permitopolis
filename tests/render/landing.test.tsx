import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { DemoGuideScreen } from "@/components/landing/DemoGuideScreen";
import { useDemo } from "@/lib/state";
import { routes } from "@/lib/routes";
import { lastPush, renderScreen } from "./harness";

describe("LandingScreen (/)", () => {
  it("renders the one h1, the page's name, and the permit checker at its Instant default", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Event permits" })).toBeInTheDocument();
    const checker = screen.getByRole("group", { name: "Check what your event needs" });
    expect(within(checker).getByText("Instant")).toBeInTheDocument();
  });

  it("opens as a city office's page: the city's name and the section nav in one header, no floating product panel", async () => {
    const { container } = await renderScreen(<LandingScreen />, { path: "/" });

    const header = screen.getByRole("banner");
    // One row: the nav sits in the header, before the "City staff" door.
    const primary = within(header).getByRole("navigation", { name: "Primary" });
    const cityStaff = within(header).getByRole("link", { name: "City staff" });
    expect(primary.compareDocumentPosition(cityStaff) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/An official website/)).not.toBeInTheDocument();
    const home = within(header).getByRole("link", { name: /City of Permitopolis/ });
    expect(home).toHaveAttribute("href", routes.home());
    expect(home).toHaveTextContent("Office of the City Clerk");
    // The marketing treatments are gone: the page atmosphere, the tilted floating panel.
    expect(container.querySelector(".page-atmosphere, .anim-idle-float")).toBeNull();
  });

  it("the primary nav, the task list and the footer name each section the same way and point at it", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    const primary = screen.getByRole("navigation", { name: "Primary" });
    const footerNav = screen.getByRole("navigation", { name: "Footer" });
    for (const [name, href] of [
      ["How to apply", "#how-to-apply"],
      ["Permit tiers", "#permit-tiers"],
      ["Fees", "#fees"],
      ["Questions", "#questions"],
    ]) {
      expect(within(primary).getByRole("link", { name })).toHaveAttribute("href", href);
      expect(within(footerNav).getByRole("link", { name })).toHaveAttribute("href", href);
      expect(document.getElementById(href.slice(1)), href).not.toBeNull();
    }

    const tasks = screen.getByRole("list", { name: "I want to…" });
    expect(within(tasks).getByRole("link", { name: /Plan an event/ })).toHaveAttribute("href", routes.apply());
    expect(within(tasks).getByRole("link", { name: /See what it costs/ })).toHaveAttribute("href", "#fees");
    expect(within(tasks).getByRole("link", { name: /Read common questions/ })).toHaveAttribute("href", "#questions");
    for (const link of within(tasks).getAllByRole("link")) {
      const href = link.getAttribute("href")!;
      if (href.startsWith("#")) expect(document.getElementById(href.slice(1)), href).not.toBeNull();
    }
  });

  it("the footer carries the office's contact details and the staff door", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(/Priya Natarajan/)).toBeInTheDocument();
    expect(within(footer).getByText("(555) 014-2200")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Open the staff workspace" })).toHaveAttribute("href", routes.city.queue());
    expect(within(footer).getByText(/Permitopolis is a fictional city/)).toBeInTheDocument();
  });

  it("changing the permit checker (alcohol on) moves the tier to Reviewed live", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    const checker = screen.getByRole("group", { name: "Check what your event needs" });
    await user.click(within(checker).getByRole("switch", { name: "Alcohol" }));

    expect(within(checker).getByText("Reviewed")).toBeInTheDocument();
    expect(within(checker).queryByText("Instant")).not.toBeInTheDocument();
  });

  it("switching the permit checker to a street moves the tier to Special", async () => {
    const { user } = await renderScreen(<LandingScreen />, { path: "/" });

    const checker = screen.getByRole("group", { name: "Check what your event needs" });
    await user.click(within(checker).getByRole("radio", { name: "A street" }));

    expect(within(checker).getByText("Special event")).toBeInTheDocument();
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

  it("the fee schedule table shows $25 per hour for a shelter", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });
    const fees = screen.getByRole("table", { name: "Fee schedule" });
    expect(within(fees).getByRole("row", { name: /Shelter/ })).toHaveTextContent("$25 per hour");
    expect(screen.getByText("$25 per hour")).toBeInTheDocument();
  });

  it("the three tiers are listed with their notice, reviewers and a typical fee", async () => {
    await renderScreen(<LandingScreen />, { path: "/" });

    const tiers = screen.getByRole("list", { name: "The three permit tiers" });
    const rows = within(tiers).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByRole("heading", { name: "Instant" })).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("10 days");
    expect(rows[0]).toHaveTextContent("City Clerk only");
    expect(rows[1]).toHaveTextContent("30 days");
    expect(rows[1]).toHaveTextContent("$715");
    expect(rows[2]).toHaveTextContent("60 days");
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
    await user.click(within(card).getByRole("button", { name: /^Start this path: / }));

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
    await user.click(within(card).getByRole("button", { name: /^Continue: / }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
    expect(useDemo.getState()).toMatchObject({ role: "hl", activeDemoPath: 3 });
  });

  it("a scenario's Jump puts the coach on the path built on that scenario", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    const row = screen.getByText("S6 · Main Street Food Truck Festival").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /^Jump to / }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0031");
    expect(useDemo.getState()).toMatchObject({ role: "pws", personaId: "main-street-business-alliance", activeDemoPath: 6 });
  });

  it("Reset asks for confirmation before restoring the seed", async () => {
    const { user } = await renderScreen(<DemoGuideScreen />, { path: routes.demo() });

    await user.click(screen.getByRole("button", { name: /Reset demo data/ }));
    expect(screen.getByRole("heading", { name: "Reset the demo?" })).toBeInTheDocument();
  });
});

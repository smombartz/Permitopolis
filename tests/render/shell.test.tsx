import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import { useDemo } from "@/lib/state";
import { lastPush, renderScreen } from "./harness";

describe("AppShell top bar", () => {
  it("shows the four roles and today's demo date", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });

    expect(screen.getByRole("radio", { name: "Applicant" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "City Clerk" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Public Works & Safety" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Health & Legal" })).toBeInTheDocument();
    expect(screen.getByText("Demo today: Mon, May 3, 2027")).toBeInTheDocument();
  });

  it("renders the page once hydrated, for the Applicant", async () => {
    await renderScreen(<AppShell>applicant content</AppShell>, { path: "/events" });
    expect(screen.getByText("applicant content")).toBeInTheDocument();
  });
});

describe("switching role", () => {
  it("follows a case from the applicant's board to the matching city role", async () => {
    const theCase = makeCase({ id: "PMT-27-0118", applicantId: "downtown-arts-collective" });
    await renderScreen(<AppShell>board</AppShell>, {
      path: "/events/PMT-27-0118",
      role: "applicant",
      cases: [theCase],
    });

    await userEvent.click(screen.getByRole("radio", { name: "City Clerk" }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
    expect(useDemo.getState().role).toBe("clerk");
  });

  it("keeps the URL when switching between two city roles", async () => {
    const theCase = makeCase({ id: "PMT-27-0097", applicantId: "riverfront-running-club" });
    await renderScreen(<CityShell>case detail</CityShell>, {
      path: "/city/cases/PMT-27-0097",
      role: "clerk",
      cases: [theCase],
    });

    await userEvent.click(screen.getByRole("radio", { name: "Public Works & Safety" }));

    expect(lastPush()).toBe("/city/cases/PMT-27-0097");
    expect(useDemo.getState().role).toBe("pws");
  });

  it("falls back to the role's home off a case page", async () => {
    await renderScreen(<AppShell>my events</AppShell>, { path: "/events", role: "applicant" });

    await userEvent.click(screen.getByRole("radio", { name: "Health & Legal" }));

    expect(lastPush()).toBe("/city/queue");
  });
});

describe("Reset demo data", () => {
  it("asks for confirmation before restoring, and does not reset on its own", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    useDemo.setState({ role: "clerk", demoToday: "2027-06-18" });

    await userEvent.click(screen.getByRole("button", { name: "Demo menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Reset demo data/ }));

    const dialog = await screen.findByRole("dialog", { name: "Reset the demo?" });
    expect(useDemo.getState().role).toBe("clerk"); // not reset yet: confirmation is still open

    await userEvent.click(within(dialog).getByRole("button", { name: "Reset demo data" }));

    expect(useDemo.getState().role).toBe("applicant");
    expect(useDemo.getState().demoToday).toBe("2027-05-03");
  });
});

describe("CityShell sidebar", () => {
  it("shows a count on My queue from queueFor", async () => {
    const theCase = makeCase({
      id: "PMT-27-0001",
      tasks: [makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", status: "todo" })],
    });
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "clerk", cases: [theCase] });

    const queueLink = screen.getByRole("link", { name: /My queue/ });
    expect(within(queueLink).getByText("1")).toBeInTheDocument();
  });
});

describe("storage banner", () => {
  it("appears when storageOk is false, and can be dismissed", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    useDemo.setState({ storageOk: false });

    const message = await screen.findByText(/Your browser is blocking storage/);
    expect(message).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Your browser is blocking storage/)).not.toBeInTheDocument();
  });

  it("does not appear when storage is fine", async () => {
    await renderScreen(<AppShell>content</AppShell>, { path: "/events" });
    expect(screen.queryByText(/Your browser is blocking storage/)).not.toBeInTheDocument();
  });
});

describe("area mismatch", () => {
  it("offers to switch to a city role when the Applicant is on a /city route", async () => {
    await renderScreen(<CityShell>queue</CityShell>, { path: "/city/queue", role: "applicant" });

    expect(screen.getByText("This screen is built for a city role.")).toBeInTheDocument();
    expect(screen.queryByText("queue")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to City Clerk" }));
    expect(useDemo.getState().role).toBe("clerk");
    expect(lastPush()).toBe("/city/queue");
  });

  it("offers to switch to the Applicant when a city role is on /events or /apply", async () => {
    await renderScreen(<AppShell>board</AppShell>, { path: "/events", role: "pws" });

    expect(screen.getByText("This screen is built for the Applicant.")).toBeInTheDocument();
    expect(screen.queryByText("board")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Applicant" }));
    expect(useDemo.getState().role).toBe("applicant");
  });
});

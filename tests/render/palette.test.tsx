import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { useDemo } from "@/lib/state";
import { lastPush, renderScreen } from "./harness";

describe("command palette", () => {
  it("Cmd+K opens it from anywhere in the shell", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("the search button opens it too, and has a kbd hint", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    const button = screen.getByRole("button", { name: "Search" });
    expect(within(button).getByText("⌘K")).toBeInTheDocument();
    await user.click(button);

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it('typing "5K" and Enter opens the 5K for the Clerk', async () => {
    const { user } = await renderScreen(<CityShell>my queue</CityShell>, { path: "/city/queue", role: "clerk" });

    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByRole("combobox"), "5K");
    await user.keyboard("{Enter}");

    expect(lastPush()).toBe("/city/cases/PMT-27-0097");
  });

  it("lists Go to, Switch role and Demo for a city role, with no Personas group", async () => {
    const { user } = await renderScreen(<CityShell>my queue</CityShell>, { path: "/city/queue", role: "clerk" });
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByText("Go to")).toBeInTheDocument();
    expect(screen.getByText("Switch role")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.queryByText("Personas")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Intake/ })).toBeInTheDocument();
  });

  it("switching role from the palette follows the same rule as the top bar's switcher", async () => {
    const { user } = await renderScreen(<AppShell>board</AppShell>, { scenario: "S3" });
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.click(screen.getByRole("option", { name: "Switch to City Clerk" }));

    expect(useDemo.getState().role).toBe("clerk");
    expect(lastPush()).toBe("/city/cases/PMT-27-0118");
  });

  it("picking a persona switches it and goes where that persona starts", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.click(screen.getByRole("option", { name: "Sunrise Yoga Club" }));

    expect(useDemo.getState().personaId).toBe("sunrise-yoga-club");
    expect(lastPush()).toBe("/apply?case=PMT-27-0142&step=when");
  });

  it("jumping a demo path sets its role, persona and page", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("combobox"), "Two parties up at once");

    await user.click(screen.getByRole("option", { name: /Path 5: Two parties up at once/ }));

    expect(useDemo.getState().role).toBe("clerk");
    expect(lastPush()).toBe("/city/cases/PMT-27-0097");
    expect(useDemo.getState().activeDemoPath).toBe(5);
  });

  it("jumping to a scenario puts the coach on the path built on it", async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("combobox"), "Maya");

    await user.click(screen.getByRole("option", { name: /Jump to S1 · Maya Chen/ }));

    expect(lastPush()).toBe("/events/PMT-27-0109/permit");
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "maya-chen", activeDemoPath: 7 });
  });

  it('"reset" asks for confirmation before restoring the seed', async () => {
    const { user } = await renderScreen(<CityShell>case detail</CityShell>, { scenario: "S5" });
    const result = useDemo.getState().dispatch("PMT-27-0097", { type: "add_note", text: "Called the organizer." });
    expect(result.ok).toBe(true);
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.type(screen.getByRole("combobox"), "reset");
    await user.click(screen.getByRole("option", { name: "Reset demo data" }));

    const dialog = await screen.findByRole("dialog", { name: "Reset the demo?" });
    expect(within(dialog).getByText(/There is no undo/)).toBeInTheDocument();
    expect(useDemo.getState().cases.find((c) => c.id === "PMT-27-0097")?.activity.at(-1)?.text).toBe("Called the organizer.");

    await user.click(within(dialog).getByRole("button", { name: "Reset demo data" }));
    expect(useDemo.getState().cases.find((c) => c.id === "PMT-27-0097")?.activity.map((a) => a.text)).not.toContain("Called the organizer.");
  });

  it("the cases group only shows once something is typed, and matches by name, id or applicant", async () => {
    const { user } = await renderScreen(<CityShell>my queue</CityShell>, { path: "/city/queue", role: "clerk" });
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.queryByRole("option", { name: /PMT-27-0097/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "PMT-27-0097");
    expect(screen.getByRole("option", { name: /Riverfront Summer 5K.*PMT-27-0097/ })).toBeInTheDocument();
  });
});

describe("keyboard shortcuts dialog", () => {
  it('"?" opens it, and not while typing in a field', async () => {
    const { user } = await renderScreen(<AppShell>my events</AppShell>, { path: "/events" });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await user.keyboard("?");
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    input.remove();

    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Open the command palette")).toBeInTheDocument();
  });
});

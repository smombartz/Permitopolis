import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { StoreHydrator } from "@/components/shell/StoreHydrator";
import { STORAGE_KEY } from "@/lib/rules";
import { buildSeed, resetDemoStoreForTests, useDemo, useHydrated } from "@/lib/state";
import { flushHydration, prepareScreen, renderScreen } from "./harness";

function Probe() {
  return <p>{useHydrated() ? "content" : "skeleton"}</p>;
}

/** A demo the presenter left behind: the Clerk, on Jun 18, with a note on the first case. */
function leftBehind() {
  const cases = buildSeed();
  cases[0].activity.push({ at: "2027-05-03T09:00", actor: "clerk", text: "Called the organizer." });
  return { cases, role: "clerk" as const, personaId: "riverfront-running-club", demoToday: "2027-06-18" };
}

const storedDemo = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as { state: { role: string; demoToday: string; cases: { activity: { text: string }[] }[] } } | null;

beforeEach(() => {
  // Each test is a page load of its own: nothing read yet, nothing stored.
  resetDemoStoreForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useHydrated in the browser", () => {
  it("starts false, as on the server, and turns true once the stored demo has been read", async () => {
    render(<Probe />);
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(await screen.findByText("content")).toBeInTheDocument();
  });

  it("turns true as well when storage is blocked and there is nothing to read", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });
    render(<Probe />);
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(await screen.findByText("content")).toBeInTheDocument();
  });

  it("is one flag for the page load: a component that mounts later starts true, and storage is read once", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const first = render(<Probe />);
    await flushHydration();
    expect(screen.getByText("content")).toBeInTheDocument();
    first.unmount();

    // The next mount (another layout, after a client-side navigation) has no skeleton to show.
    render(<Probe />);
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByText("skeleton")).not.toBeInTheDocument();
    expect(getItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
  });
});

describe("a reload with a demo in storage", () => {
  it("the prerendered shell shows the wordmark and placeholders: neither the seed's role nor its date", () => {
    prepareScreen({ path: "/city/queue", stored: leftBehind() });
    // What the server sends, and what the browser paints before any script has run.
    const html = renderToString(<CityShell>queue</CityShell>);

    expect(html).toContain("Permitopolis");
    expect(html).toContain('data-slot="top-bar-placeholder"');
    expect(html).toContain('data-slot="page-skeleton"');
    expect(html).not.toContain("May 3");
    expect(html).not.toContain("Demo today");
    expect(html).not.toContain("Switch user");
    expect(html).not.toContain("Applicant");
    expect(html).not.toContain("New applicant");
  });

  it("hydrates that HTML without a mismatch, then shows the stored role and date", async () => {
    const error = vi.spyOn(console, "error");
    prepareScreen({ path: "/city/queue", stored: leftBehind() });
    const container = document.body.appendChild(document.createElement("div"));
    container.innerHTML = renderToString(<CityShell>queue</CityShell>);

    await act(async () => {
      render(<CityShell>queue</CityShell>, { container, hydrate: true });
    });
    await flushHydration();

    expect(error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Switch user: City Clerk" })).toBeInTheDocument();
    expect(screen.getByText("Demo today: Fri, Jun 18, 2027")).toBeInTheDocument();
    expect(screen.queryByText(/May 3/)).not.toBeInTheDocument();
    expect(screen.getByText("queue")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="top-bar-placeholder"]')).toBeNull();
    container.remove();
  });

  it("going from the applicant's layout to the city's shows no skeleton again and does not read storage again", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const applicant = await renderScreen(<AppShell>my events</AppShell>, { path: "/events", stored: { ...leftBehind(), role: "applicant" } });
    expect(screen.getByText("my events")).toBeInTheDocument();

    // The switch to a city role navigates to /city/..., which is another layout: AppShell unmounts.
    act(() => useDemo.getState().setRole("clerk"));
    applicant.unmount();
    render(<CityShell>queue</CityShell>);

    // Its very first render has the page and the controls.
    expect(screen.getByText("queue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch user: City Clerk" })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="page-skeleton"]')).toBeNull();
    expect(document.querySelector('[data-slot="top-bar-placeholder"]')).toBeNull();
    expect(getItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
  });
});

describe("a page with no shell (the landing page, the demo guide, the verify page)", () => {
  /** What a landing-page door does: sets the role, then navigates. */
  function Door() {
    return (
      <button type="button" onClick={() => useDemo.getState().setRole("pws")}>
        City staff
      </button>
    );
  }

  it("the root layout's hydrator reads the stored demo, so a change made there is made to it, not to the seed", async () => {
    const left = leftBehind();
    const { user } = await renderScreen(
      <>
        <StoreHydrator />
        <Door />
      </>,
      { path: "/", stored: left },
    );
    // Nothing on the page asked for the store, and it has the stored demo all the same.
    expect(useDemo.getState()).toMatchObject({ role: "clerk", demoToday: "2027-06-18" });

    await user.click(screen.getByRole("button", { name: "City staff" }));

    expect(storedDemo()).toMatchObject({ state: { role: "pws", demoToday: "2027-06-18" } });
    expect(storedDemo()?.state.cases[0].activity.at(-1)?.text).toBe("Called the organizer.");
  });

  it("a change made before the stored demo has been read is not saved over it", () => {
    prepareScreen({ path: "/", stored: leftBehind() });
    const before = window.localStorage.getItem(STORAGE_KEY);

    // The first render, with no effect run yet: a click this early changes the in-memory seed only.
    useDemo.getState().setRole("pws");

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(storedDemo()?.state.cases[0].activity.at(-1)?.text).toBe("Called the organizer.");
  });
});

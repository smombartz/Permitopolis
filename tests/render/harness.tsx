/**
 * Shared render harness: mounts a screen against the real seed and mocked next/navigation
 * (the mocks themselves live in tests/render/setup.ts, loaded once for every render test by
 * vitest.config.mts). A render test imports `renderScreen` instead of calling `render()` from
 * @testing-library/react directly:
 *
 *   const { user } = await renderScreen(<CaseDetailScreen />, { scenario: "S5" });
 *   await user.click(screen.getByRole("button", { name: "Back to cases" }));
 *   expect(lastPush()).toBe("/city/cases");
 *
 * What `renderScreen()` does, in order:
 *
 * 1. Starts a fresh page load (`resetDemoStoreForTests`): the 38 seeded cases of `buildSeed()`
 *    on Mon, May 3, 2027, the Applicant role and the "new" persona, nothing in localStorage,
 *    and the stored demo not read yet. Pass `cases` to replace the seed with hand-built ones
 *    (`makeCase` and `makeTask` from lib/state/testSupport).
 * 2. Applies `scenario` (a Demo menu jump: its role, persona and page, and the demo coach on
 *    the path built on it), then `role`, `personaId`, `demoToday` and `path`, which each
 *    override what the scenario set.
 * 3. Points the mocked router at `path`. A query string in `path` becomes the search params,
 *    so `path` can come straight from lib/routes.ts; `search` adds to it. `params.id` is read
 *    off an event, case or verify path unless `params` is given.
 * 4. Renders, then reads the stored demo as the root layout's `<StoreHydrator />` does on
 *    every route, so a screen gated on `useHydrated()` shows its content, not its skeleton,
 *    by the time this returns. Always `await` it.
 *
 * The router is live: `router.push()`, `router.replace()` and a click on a `<Link>` move the
 * mocked location, and `usePathname()`, `useSearchParams()` and `useParams()` re-render with
 * it. So a screen that keeps a step, a tab or a filter in the URL can be clicked through.
 * `lastPush()` / `lastReplace()` read the most recent `router.push()` / `router.replace()`;
 * `navigate(href)` moves the location from the test itself, as the browser's Back would.
 * The real router is not synchronous: `holdNavigation()` and `releaseNavigation()` open the gap
 * between a push and the URL catching up, for a screen that has to behave inside it.
 *
 * `demoToday` sets the date as it is. To move the seed forward the way the Demo menu does
 * (hold expiry, Event day, Closeout), call `useDemo.getState().setDemoToday(date)` inside
 * `act()` after rendering.
 *
 * `stored` is a demo left in localStorage by an earlier visit (a reload). Hydration brings it
 * in, and it wins over `role`, `personaId`, `demoToday` and `cases`. To see what the page shows
 * before that (the prerendered HTML), call `prepareScreen(options)` and render the screen with
 * `renderToString()` from react-dom/server: tests/render/hydration.test.tsx does.
 *
 * `switchRole()` flips the store's role without navigating, for a test that checks what a
 * mounted screen shows to another role.
 */
import type { ReactElement } from "react";
import { act, render, type RenderResult } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { SCENARIO_JUMPS, type ScenarioKey } from "@/lib/data/demoScript";
import { STORAGE_KEY } from "@/lib/rules";
import { hydrateDemoStore, resetDemoStoreForTests, useDemo, type DemoState } from "@/lib/state";
import { seedFingerprint } from "@/lib/state/seed";
import { demoPathIdForScenario } from "@/lib/view/coach";
import type { EventCase, ISODate, Party } from "@/lib/types";
import { holdNavigation, navState, navigate, paramsFromPath, releaseNavigation, resetNavState } from "./setup";

export interface RenderScreenOptions {
  /** A Demo menu scenario jump: the role, the persona and the page it opens. */
  scenario?: ScenarioKey;
  /** The page's href, with or without a query string. Defaults to the scenario's page, then "/". */
  path?: string;
  /** Route params. Defaults to `{ id }` read off an event, case or verify path. */
  params?: Record<string, string | string[]>;
  /** Search params, added to any query string in `path`. */
  search?: Record<string, string>;
  role?: Party;
  personaId?: string;
  demoToday?: ISODate;
  /** Replaces the seed. Leave it out to render against all 38 seeded cases. */
  cases?: EventCase[];
  /** A demo saved by an earlier visit, read from localStorage when the screen hydrates. */
  stored?: Partial<Omit<DemoState, "storageOk">>;
}

export type RenderScreenResult = RenderResult & {
  /** A `userEvent` session for this render. */
  user: UserEvent;
};

/**
 * Steps 1 to 3 of `renderScreen()`: a fresh page load with the store, the stored demo and the
 * mocked location set up, and nothing rendered yet.
 */
export function prepareScreen(options: RenderScreenOptions = {}): void {
  resetDemoStoreForTests();
  resetNavState();

  const jump = options.scenario ? SCENARIO_JUMPS.find((j) => j.id === options.scenario) : undefined;
  const [pathname, query = ""] = (options.path ?? jump?.path ?? "/").split("?");
  const search = new URLSearchParams(query);
  for (const [key, value] of Object.entries(options.search ?? {})) search.set(key, value);

  navState.pathname = pathname;
  navState.params = options.params ?? paramsFromPath(pathname);
  navState.search = search;

  useDemo.setState({
    role: options.role ?? jump?.role ?? "applicant",
    personaId: options.personaId ?? jump?.personaId ?? "new",
    // A scenario jump puts the demo coach on the path built on that scenario, as the Demo menu does.
    activeDemoPath: jump ? demoPathIdForScenario(jump.id) : null,
    ...(options.demoToday !== undefined ? { demoToday: options.demoToday } : {}),
    ...(options.cases !== undefined ? { cases: options.cases } : {}),
  });
  if (options.stored) {
    // What persist would have saved: the whole demo, under this seed's fingerprint.
    const { cases, demoToday, cfg, role, personaId, hints, activeDemoPath, lastPathByRole } = { ...useDemo.getInitialState(), ...options.stored };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { cases, demoToday, cfg, role, personaId, hints, activeDemoPath, lastPathByRole }, version: seedFingerprint() }));
  }
}

export async function renderScreen(ui: ReactElement, options: RenderScreenOptions = {}): Promise<RenderScreenResult> {
  prepareScreen(options);

  let result!: RenderResult;
  await act(async () => {
    result = render(ui);
  });
  await flushHydration();
  return Object.assign(result, { user: userEvent.setup() });
}

/**
 * Reads the stored demo and lets the screen re-render with it. The store reads localStorage
 * through a promise (so the server and the first client render always agree); this waits for
 * that same promise, so callers see the hydrated screen without an extra `await findBy...`.
 */
export async function flushHydration(): Promise<void> {
  await act(async () => {
    await hydrateDemoStore();
  });
}

export { navigate };

/**
 * `holdNavigation()` makes `router.push()` and `router.replace()` lag the way a real transition
 * does: the call is recorded (`lastPush()`, `lastReplace()`) but the location does not move
 * until `releaseNavigation()`, inside `act()`. For a screen that must behave between the two.
 */
export { holdNavigation, releaseNavigation };

export function lastPush(): string | undefined {
  return navState.pushCalls.at(-1);
}

export function lastReplace(): string | undefined {
  return navState.replaceCalls.at(-1);
}

/** Flips the store's role mid-test without navigating. */
export function switchRole(role: Party): void {
  act(() => {
    useDemo.getState().setRole(role);
  });
}

/** A case as the store holds it now, e.g. to assert what a click dispatched. Throws when it is missing. */
export function storedCase(id: string): EventCase {
  const found = useDemo.getState().cases.find((c) => c.id === id);
  if (!found) throw new Error(`No case ${id} in the store.`);
  return found;
}

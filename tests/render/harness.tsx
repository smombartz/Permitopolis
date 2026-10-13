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
 * 1. Resets the demo store (`resetDemoStoreForTests`): the 38 seeded cases of `buildSeed()`
 *    on Mon, May 3, 2027, the Applicant role and the "new" persona. Pass `cases` to replace
 *    the seed with hand-built ones (`makeCase` and `makeTask` from lib/state/testSupport).
 * 2. Applies `scenario` (a Demo menu jump: its role, persona and page), then `role`,
 *    `personaId`, `demoToday` and `path`, which each override what the scenario set.
 * 3. Points the mocked `usePathname()`, `useSearchParams()` and `useParams()` at `path`. A
 *    query string in `path` becomes the search params, so `path` can come straight from
 *    lib/routes.ts; `search` adds to it. `params.id` is read off an event, case or verify
 *    path unless `params` is given.
 * 4. Renders, then flushes the microtask `useHydrated()` waits on, so a screen gated on it
 *    shows its content, not its skeleton, by the time this returns. Always `await` it.
 *
 * `demoToday` sets the date as it is. To move the seed forward the way the Demo menu does
 * (hold expiry, Event day, Closeout), call `useDemo.getState().setDemoToday(date)` inside
 * `act()` after rendering.
 *
 * `lastPush()` / `lastReplace()` read the most recent `router.push()` / `router.replace()` the
 * screen made. `switchRole()` flips the store's role without navigating, for a test that
 * checks what a mounted screen shows to another role.
 */
import type { ReactElement } from "react";
import { act, render, type RenderResult } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { SCENARIO_JUMPS, type ScenarioKey } from "@/lib/data/demoScript";
import { resetDemoStoreForTests, useDemo } from "@/lib/state";
import type { EventCase, ISODate, Party } from "@/lib/types";
import { navState, resetNavState } from "./setup";

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
}

export type RenderScreenResult = RenderResult & {
  /** A `userEvent` session for this render. */
  user: UserEvent;
};

const ID_ROUTE = /^\/(?:events|city\/cases|verify)\/([^/]+)/;

function paramsFromPath(pathname: string): Record<string, string> {
  const id = ID_ROUTE.exec(pathname)?.[1];
  return id ? { id } : {};
}

export async function renderScreen(ui: ReactElement, options: RenderScreenOptions = {}): Promise<RenderScreenResult> {
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
    ...(options.demoToday !== undefined ? { demoToday: options.demoToday } : {}),
    ...(options.cases !== undefined ? { cases: options.cases } : {}),
  });

  let result!: RenderResult;
  await act(async () => {
    result = render(ui);
  });
  // useHydrated() resolves on a microtask after mount (it reads localStorage through a
  // promise so the server and the first client render always agree). Flush that now so
  // callers see the hydrated screen, not its skeleton, without an extra `await findBy...`.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return Object.assign(result, { user: userEvent.setup() });
}

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

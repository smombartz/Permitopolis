/**
 * Shared render harness for mounting a screen against a seeded store and mocked
 * next/navigation (the mocks themselves live in tests/render/setup.ts, loaded once for
 * every render test by vitest.config.mts). A later workstream's render test imports
 * `renderScreen` instead of calling `render()` from @testing-library/react directly:
 *
 *   const { user } = await renderScreen(<CaseDetailScreen />, {
 *     path: "/city/cases/PMT-27-0097",
 *     params: { id: "PMT-27-0097" },
 *     role: "clerk",
 *     cases: [makeCase({ id: "PMT-27-0097", ... })],
 *   });
 *   expect(lastPush()).toBe("/city/queue");
 *
 * `renderScreen()` resets the demo store to its defaults (`resetDemoStoreForTests`), layers
 * `role`, `personaId`, `demoToday` and `cases` on top (only `cases` replaces the seed; the
 * others fall back to the store's own defaults), points the mocked `usePathname()`,
 * `useParams()` and `useSearchParams()` at `path`, `params` and `search`, then renders and
 * flushes microtasks so `useHydrated()` already reads true by the time it returns — a screen
 * gated on it shows its real content immediately, not its skeleton. It is async for that
 * reason; always `await` it.
 *
 * `lastPush()` / `lastReplace()` read the most recent `router.push()` / `router.replace()` the
 * screen made. `switchRole()` flips the store's role the way the top bar's switcher would,
 * useful for a test that checks what happens after a mid-test role change.
 */
import { act, type ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { resetDemoStoreForTests, useDemo } from "@/lib/state";
import type { EventCase, ISODate, Party } from "@/lib/types";
import { navState, resetNavState } from "./setup";

export interface RenderScreenOptions {
  path?: string;
  params?: Record<string, string | string[]>;
  search?: Record<string, string>;
  role?: Party;
  personaId?: string;
  demoToday?: ISODate;
  cases?: EventCase[];
}

export async function renderScreen(ui: ReactElement, options: RenderScreenOptions = {}): Promise<RenderResult> {
  resetDemoStoreForTests();
  resetNavState();

  navState.pathname = options.path ?? "/";
  navState.params = options.params ?? {};
  navState.search = new URLSearchParams(options.search ?? {});

  useDemo.setState({
    role: options.role ?? "applicant",
    personaId: options.personaId ?? "new",
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
  return result;
}

export function lastPush(): string | undefined {
  return navState.pushCalls.at(-1);
}

export function lastReplace(): string | undefined {
  return navState.replaceCalls.at(-1);
}

/** Flips the store's role mid-test, the way the top bar's switcher would. */
export function switchRole(role: Party): void {
  act(() => {
    useDemo.getState().setRole(role);
  });
}

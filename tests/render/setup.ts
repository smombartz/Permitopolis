import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * next/navigation and next/link, mocked once for every render test (tests/render/**\/*.test.tsx
 * and components/**\/*.test.tsx; see vitest.config.mts). The mock is a small router of its own:
 * `navState` holds the current location, `router.push()` and `router.replace()` move it, and
 * `usePathname()`, `useSearchParams()` and `useParams()` re-render with it, so a screen that
 * keeps its state in the URL (a wizard step, a tab, a filter) can be driven past its first
 * render. Clicking a `<Link>` navigates the same way.
 *
 * tests/render/harness.tsx's `renderScreen()` sets the location before mounting a screen, and
 * `lastPush()` / `lastReplace()` read where it went. `notFound()` and `redirect()` throw, same
 * as the real App Router (so a screen that calls one still unmounts the way it would in the
 * app), and record what happened so a test can tell which one fired.
 *
 * A render test outside the harness can still set `navState` by hand before rendering (a field
 * set that way is read on the next render); to move a mounted screen, call `navigate()`.
 * `resetNavState()` returns everything to the defaults below.
 */
export interface NavState {
  pathname: string;
  params: Record<string, string | string[]>;
  search: URLSearchParams;
  pushCalls: string[];
  replaceCalls: string[];
  notFoundCalled: boolean;
  redirectedTo: string | null;
}

const DEFAULT_NAV_STATE: NavState = {
  pathname: "/",
  params: {},
  search: new URLSearchParams(),
  pushCalls: [],
  replaceCalls: [],
  notFoundCalled: false,
  redirectedTo: null,
};

export const navState: NavState = { ...DEFAULT_NAV_STATE };

const navListeners = new Set<() => void>();

function subscribeToNav(listener: () => void): () => void {
  navListeners.add(listener);
  return () => {
    navListeners.delete(listener);
  };
}

/** Tells every mounted hook the location changed. Inside act(), so the re-render is flushed. */
function notifyNav(): void {
  act(() => {
    for (const listener of navListeners) listener();
  });
}

const ID_ROUTE = /^\/(?:events|city\/cases|verify)\/([^/]+)/;

/** The `{ id }` an event, case or verify path carries, as the App Router would hand it to `useParams()`. */
export function paramsFromPath(pathname: string): Record<string, string> {
  const id = ID_ROUTE.exec(pathname)?.[1];
  return id ? { id } : {};
}

/**
 * Moves the mocked location to `href` (path, optional query string) without recording a push:
 * what the browser's own navigation, or the page the user arrived on, would do.
 */
export function navigate(href: string): void {
  const [pathname, query = ""] = href.split("#")[0].split("?");
  navState.pathname = pathname || "/";
  navState.search = new URLSearchParams(query);
  navState.params = paramsFromPath(navState.pathname);
  notifyNav();
}

export function resetNavState(): void {
  Object.assign(navState, DEFAULT_NAV_STATE, { params: {}, search: new URLSearchParams(), pushCalls: [], replaceCalls: [] });
  for (const fn of [router.back, router.forward, router.refresh, router.prefetch]) fn.mockClear();
  notifyNav();
}

const readPathname = () => navState.pathname;
const readParams = () => navState.params;
const readSearch = () => navState.search;

/**
 * One router for the whole run, as in the app: `useRouter()` returns the same object on every
 * render, so an effect or callback that depends on it does not re-run each time.
 */
const router = {
  push: (href: string) => {
    navState.pushCalls.push(href);
    navigate(href);
  },
  replace: (href: string) => {
    navState.replaceCalls.push(href);
    navigate(href);
  },
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  // The third argument is the server's snapshot: a screen can be rendered with renderToString() too.
  usePathname: () => React.useSyncExternalStore(subscribeToNav, readPathname, readPathname),
  useParams: () => React.useSyncExternalStore(subscribeToNav, readParams, readParams),
  useSearchParams: () => React.useSyncExternalStore(subscribeToNav, readSearch, readSearch),
  notFound: () => {
    navState.notFoundCalled = true;
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: (href: string) => {
    navState.redirectedTo = href;
    throw new Error("NEXT_REDIRECT");
  },
}));

type LinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string | { pathname?: string }; replace?: boolean; prefetch?: boolean; scroll?: boolean };

// A plain anchor that navigates through the mocked router: real next/link needs the app router
// context this harness doesn't provide. A click the component already handled (preventDefault),
// or one that opens another tab, is left alone.
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, children, replace, prefetch, scroll, onClick, ...props }, ref) {
    void prefetch;
    void scroll;
    const url = typeof href === "string" ? href : href?.pathname ?? "";
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || props.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      if (replace) router.replace(url);
      else router.push(url);
    };
    return React.createElement("a", { ref, href: url, ...props, onClick: handleClick }, children);
  }),
}));

// jsdom lacks these; Radix and the map use them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * next/navigation and next/link, mocked once for every render test (tests/render/**\/*.test.tsx
 * and components/**\/*.test.tsx; see vitest.config.mts). `navState` is the single mutable object
 * behind the mock: tests/render/harness.tsx's `renderScreen()` sets `pathname`, `params` and
 * `search` before mounting a screen, and reads `pushCalls` / `replaceCalls` afterwards to see
 * where it navigated. `notFound()` and `redirect()` throw, same as the real App Router (so a
 * screen that calls one still unmounts the way it would in the app), and record what happened so
 * a test can tell which one fired.
 *
 * A render test outside the harness (there are a few, predating it) can still import `navState`
 * directly and set it by hand; `resetNavState()` returns it to the defaults below.
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

export function resetNavState(): void {
  Object.assign(navState, DEFAULT_NAV_STATE, { params: {}, search: new URLSearchParams(), pushCalls: [], replaceCalls: [] });
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      navState.pushCalls.push(href);
    },
    replace: (href: string) => {
      navState.replaceCalls.push(href);
    },
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => navState.pathname,
  useParams: () => navState.params,
  useSearchParams: () => navState.search,
  notFound: () => {
    navState.notFoundCalled = true;
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: (href: string) => {
    navState.redirectedTo = href;
    throw new Error("NEXT_REDIRECT");
  },
}));

// A plain anchor: real next/link needs the app router context this harness doesn't provide.
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, { href: string | { pathname?: string }; children?: React.ReactNode }>(
    function Link({ href, children, ...props }, ref) {
      const url = typeof href === "string" ? href : href?.pathname ?? "";
      return React.createElement("a", { ref, href: url, ...props }, children);
    },
  ),
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

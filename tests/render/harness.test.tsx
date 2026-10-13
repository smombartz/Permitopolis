/**
 * The render harness's own router (tests/render/setup.ts). A screen that keeps its state in the
 * URL (the wizard's step, a case's tab, a list's filters, the Active permits view) reads it with
 * `useSearchParams()` and changes it with `router.push()` or a `<Link>`. These tests hold the
 * mock to what the App Router does there, so such a screen can be tested past its first render.
 */
import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { lastPush, lastReplace, navigate, renderScreen } from "./harness";
import { navState, resetNavState } from "./setup";

/** A screen in miniature: everything it shows comes from the URL, and its controls change the URL. */
function UrlProbe() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const params = useParams<{ id?: string }>();
  return (
    <div>
      <p data-testid="pathname">{pathname}</p>
      <p data-testid="view">{search.get("view") ?? "none"}</p>
      <p data-testid="tab">{search.get("tab") ?? "none"}</p>
      <p data-testid="id">{params.id ?? "none"}</p>
      <button type="button" onClick={() => router.push(routes.city.cases({ view: "table" }))}>
        Table view
      </button>
      <button type="button" onClick={() => router.replace(routes.city.case("PMT-27-0097", { tab: "reviews" }))}>
        Reviews tab
      </button>
      <Link href={routes.city.active({ view: "calendar" })}>Calendar</Link>
      <Link href={routes.events()} replace>
        My events
      </Link>
      <Link href="/elsewhere" onClick={(event) => event.preventDefault()}>
        Handled by the screen
      </Link>
    </div>
  );
}

const shown = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  resetNavState();
});

describe("the mocked router follows a push", () => {
  it("router.push() with a query string updates useSearchParams() and usePathname(), and re-renders", async () => {
    const { user } = await renderScreen(<UrlProbe />, { path: "/city/cases" });
    expect([shown("pathname"), shown("view")]).toEqual(["/city/cases", "none"]);

    await user.click(screen.getByRole("button", { name: "Table view" }));

    expect([shown("pathname"), shown("view")]).toEqual(["/city/cases", "table"]);
    expect(lastPush()).toBe("/city/cases?view=table");
    expect(navState.search.get("view")).toBe("table");
  });

  it("router.replace() moves the location too, is recorded apart from pushes, and sets the route's params", async () => {
    const { user } = await renderScreen(<UrlProbe />, { path: "/city/cases" });

    await user.click(screen.getByRole("button", { name: "Reviews tab" }));

    expect([shown("pathname"), shown("tab"), shown("id")]).toEqual(["/city/cases/PMT-27-0097", "reviews", "PMT-27-0097"]);
    expect(lastReplace()).toBe("/city/cases/PMT-27-0097?tab=reviews");
    expect(navState.pushCalls).toEqual([]);
    // The query string of the page before does not carry over.
    expect(shown("view")).toBe("none");
  });

  it("navigate() moves a mounted screen from the test, as the browser's own navigation would, without recording a push", async () => {
    await renderScreen(<UrlProbe />, { path: "/city/cases", search: { view: "table" } });
    expect(shown("view")).toBe("table");

    navigate("/events/PMT-27-0118?tab=activity");

    expect([shown("pathname"), shown("tab"), shown("id"), shown("view")]).toEqual(["/events/PMT-27-0118", "activity", "PMT-27-0118", "none"]);
    expect(navState.pushCalls).toEqual([]);
  });
});

describe("the mocked Link navigates on click", () => {
  it("pushes its href and the page follows", async () => {
    const { user } = await renderScreen(<UrlProbe />, { path: "/city/active" });

    await user.click(screen.getByRole("link", { name: "Calendar" }));

    expect(lastPush()).toBe("/city/active?view=calendar");
    expect([shown("pathname"), shown("view")]).toEqual(["/city/active", "calendar"]);
  });

  it("a `replace` link replaces, and a click the screen handled itself goes nowhere", async () => {
    const { user } = await renderScreen(<UrlProbe />, { path: "/city/active" });

    await user.click(screen.getByRole("link", { name: "My events" }));
    expect(lastReplace()).toBe("/events");
    expect(shown("pathname")).toBe("/events");

    await user.click(screen.getByRole("link", { name: "Handled by the screen" }));
    expect(navState.pushCalls).toEqual([]);
    expect(shown("pathname")).toBe("/events");
  });
});

describe("useRouter() is one object", () => {
  it("is the same on every render, so an effect that depends on it runs once", async () => {
    const seen = new Set<unknown>();
    let effectRuns = 0;
    function Counter() {
      const router = useRouter();
      const [count, setCount] = React.useState(0);
      seen.add(router);
      React.useEffect(() => {
        effectRuns++;
      }, [router]);
      return (
        <button type="button" onClick={() => setCount(count + 1)}>
          Rendered {count + 1} times
        </button>
      );
    }
    render(<Counter />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("Rendered 3 times");
    expect(seen.size).toBe(1);
    expect(effectRuns).toBe(1);
  });

  it("a callback built on the router keeps working after the location has changed", async () => {
    function Stepper() {
      const router = useRouter();
      const step = useSearchParams().get("step") ?? "what";
      const next = React.useCallback((to: string) => router.push(routes.apply({ step: to as "where" | "when" })), [router]);
      return (
        <button type="button" onClick={() => next(step === "what" ? "where" : "when")}>
          Step: {step}
        </button>
      );
    }
    const { user } = await renderScreen(<Stepper />, { path: routes.apply() });

    await user.click(screen.getByRole("button", { name: "Step: what" }));
    await user.click(screen.getByRole("button", { name: "Step: where" }));

    expect(screen.getByRole("button")).toHaveTextContent("Step: when");
    expect(navState.pushCalls).toEqual(["/apply?step=where", "/apply?step=when"]);
  });
});

describe("resetNavState()", () => {
  it("returns a mounted screen to the defaults", async () => {
    await renderScreen(<UrlProbe />, { path: "/city/cases", search: { view: "table" } });
    act(() => resetNavState());
    expect([shown("pathname"), shown("view")]).toEqual(["/", "none"]);
    expect(navState.pushCalls).toEqual([]);
  });
});

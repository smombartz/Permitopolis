import * as React from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettle, type SettleOptions } from "@/components/ui/use-settle";

function Shown({ value, options, mounted = true }: { value: unknown; options?: SettleOptions; mounted?: boolean }) {
  const ref = useSettle<HTMLParagraphElement>(value, options);
  return mounted ? <p ref={ref}>{String(value)}</p> : null;
}

/** The motion tokens, as styles/tokens.css sets them on :root (the render tests load no CSS). */
function setTokens(): void {
  const root = document.documentElement.style;
  root.setProperty("--dur-tap", "120ms");
  root.setProperty("--dur-gentle", "240ms");
  root.setProperty("--ease-settle-curve", "cubic-bezier(0.18, 0.72, 0.16, 1)");
}

function setReducedMotion(reduced: boolean): void {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) => ({ matches: reduced && query.includes("prefers-reduced-motion"), media: query }) as unknown as MediaQueryList,
  );
}

describe("useSettle", () => {
  const animate = vi.fn();

  beforeEach(() => {
    setTokens();
    animate.mockClear();
    // jsdom has no Web Animations API; the hook does nothing without one.
    Element.prototype.animate = animate as unknown as Element["animate"];
  });

  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
    document.documentElement.removeAttribute("style");
    setReducedMotion(false);
  });

  it("does not play on mount, nor when the value stays the same", () => {
    const { rerender } = render(<Shown value="what" />);
    rerender(<Shown value="what" />);

    expect(animate).not.toHaveBeenCalled();
  });

  it("settles the element once for each change, on the motion tokens", () => {
    const { rerender } = render(<Shown value="what" />);
    rerender(<Shown value="where" />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenLastCalledWith(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.18, 0.72, 0.16, 1)" },
    );

    rerender(<Shown value="when" />);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("fades without moving when asked to, for a region that holds something fixed", () => {
    const { rerender } = render(<Shown value="clerk" options={{ y: 0, fromOpacity: 0.4 }} />);
    rerender(<Shown value="pws" options={{ y: 0, fromOpacity: 0.4 }} />);

    expect(animate).toHaveBeenLastCalledWith([{ opacity: 0.4 }, { opacity: 1 }], expect.objectContaining({ duration: 240 }));
  });

  it("leaves alone an element that appears along with the change", () => {
    const { rerender } = render(<Shown value="clerk" mounted={false} />);
    rerender(<Shown value="pws" />);
    expect(animate).not.toHaveBeenCalled();

    // Once it has been on screen, the next change settles it.
    rerender(<Shown value="hl" />);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion, drops the movement and keeps a short fade", () => {
    setReducedMotion(true);
    const { rerender } = render(<Shown value={3} />);
    rerender(<Shown value={2} />);

    expect(animate).toHaveBeenLastCalledWith([{ opacity: 0 }, { opacity: 1 }], expect.objectContaining({ duration: 120 }));
  });

  it("does nothing where the browser cannot animate", () => {
    delete (Element.prototype as { animate?: unknown }).animate;
    const { rerender } = render(<Shown value="what" />);

    expect(() => rerender(<Shown value="where" />)).not.toThrow();
  });
});

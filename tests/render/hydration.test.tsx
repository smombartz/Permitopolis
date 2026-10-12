import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHydrated } from "@/lib/state";

function Probe() {
  return <p>{useHydrated() ? "content" : "skeleton"}</p>;
}

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
    expect(await screen.findByText("content")).toBeInTheDocument();
  });
});

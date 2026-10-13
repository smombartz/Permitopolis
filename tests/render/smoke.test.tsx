import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

describe("render harness", () => {
  // Was pinned to the Phase-0 placeholder's "Permitopolis" h1; workstream 3A replaced it with
  // the real landing page (app/page.tsx), so this now checks only what this file ever meant to
  // check — that a page mounts in jsdom at all — rather than that surface's own copy.
  it("mounts a page in jsdom", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

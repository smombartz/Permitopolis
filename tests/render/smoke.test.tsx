import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

describe("render harness", () => {
  it("mounts a page in jsdom", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Permitopolis" })).toBeInTheDocument();
  });
});

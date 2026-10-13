import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PartyChip } from "@/components/domain/PartyChip";

describe("PartyChip (Phase 1 review fix: party hue confined to the avatar tile)", () => {
  it("renders the party's avatar tile and the label in ink on a neutral chip surface", () => {
    render(<PartyChip party="pws" />);
    const chip = document.querySelector('[data-slot="party-chip"]');
    expect(chip).not.toBeNull();
    // The chip itself sits on the neutral chip surface, not a party-tinted one.
    expect(chip).toHaveClass("bg-surface-2");
    expect(chip).not.toHaveClass("bg-party-pws-surface");
    expect(chip?.className).toContain("text-fg");
    expect(chip?.className).not.toContain("text-party-pws-fg");

    // The hue lives on the leading avatar tile only.
    const avatar = chip?.querySelector('[data-slot="party-avatar"]');
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveClass("bg-party-pws-surface");
    // The chip's own visible label is the accessible name; the tile is decorative here.
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("still carries a visible label, never color alone", () => {
    render(<PartyChip party="hl" suffix="4d" />);
    expect(screen.getAllByText("Health & Legal").length).toBeGreaterThan(0);
    expect(screen.getByText("· 4d")).toBeInTheDocument();
  });
});

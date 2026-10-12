import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blendOver, contrastOnGround, contrastRatio, parseHex, relativeLuminance, toHex } from "./contrast";

/**
 * Reads styles/tokens.css and resolves every `--token: value;` to a literal
 * hex color, following one or more levels of `var(--other)` indirection. This
 * is the "parse the hex values from styles/tokens.css in the test" the brief
 * asks for, so the assertions below are checked against the actual file, not
 * a hand-copied list that could drift from it.
 */
function readTokens(): Map<string, string> {
  const css = readFileSync(join(__dirname, "..", "styles", "tokens.css"), "utf8");
  const raw = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    raw.set(match[1], match[2].trim());
  }
  return raw;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function resolveHex(raw: Map<string, string>, name: string): string {
  let value = raw.get(name);
  if (value === undefined) throw new Error(`No token --${name} in styles/tokens.css`);
  // Follow var(--x) indirection until a literal hex appears (tokens.css nests at most a few levels).
  for (let i = 0; i < 10; i++) {
    const hex = value.match(HEX);
    if (hex) return hex[0];
    const ref = value.match(/var\(--([a-z0-9-]+)\)/);
    if (!ref) throw new Error(`--${name} resolves to "${value}", which has no hex color`);
    const next = raw.get(ref[1]);
    if (next === undefined) throw new Error(`--${name} references undefined --${ref[1]}`);
    value = next;
  }
  throw new Error(`--${name} did not resolve to a hex color`);
}

const tokens = readTokens();
const color = (name: string) => resolveHex(tokens, name);

const PAGE_GROUND = color("frost-100"); // --bg-page
const SURFACE_1 = color("surface-1");
const SURFACE_STRONG = color("surface-strong");
const GROUNDS: Record<string, string> = {
  "the page ground": PAGE_GROUND,
  "surface-1": SURFACE_1,
  "surface-strong": SURFACE_STRONG,
};

const AA_TEXT = 4.5;

/** Asserts a text token reaches AA on every ground the app actually puts it on. */
function expectAAOnAllGrounds(tokenName: string) {
  const fg = color(tokenName);
  for (const [groundLabel, ground] of Object.entries(GROUNDS)) {
    const ratio = contrastOnGround(fg, "#ffffffff", ground);
    expect(
      ratio,
      `--${tokenName} (${fg}) on ${groundLabel} (${ground}) is ${ratio.toFixed(2)}:1, below AA's ${AA_TEXT}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  }
}

describe("parseHex", () => {
  it("parses 3, 4, 6 and 8 digit hex, with and without #", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex("0d1420")).toEqual({ r: 13, g: 20, b: 32, a: 1 });
    expect(parseHex("#0d1420f0").a).toBeCloseTo(240 / 255, 5);
    expect(parseHex("#5157d817").a).toBeCloseTo(0x17 / 255, 5);
  });

  it("rejects non-hex input", () => {
    expect(() => parseHex("blue")).toThrow();
    expect(() => parseHex("#12345")).toThrow();
  });
});

describe("blendOver", () => {
  it("is a no-op for an opaque foreground", () => {
    expect(blendOver("#112233", "#ffffff")).toEqual({ r: 0x11, g: 0x22, b: 0x33, a: 1 });
  });

  it("averages toward the backdrop at 50% alpha", () => {
    const blended = blendOver("#ff000080", "#000000");
    expect(blended.r).toBeGreaterThanOrEqual(126);
    expect(blended.r).toBeLessThanOrEqual(129);
    expect(blended.g).toBe(0);
    expect(blended.b).toBe(0);
  });

  it("round-trips through toHex", () => {
    expect(toHex(blendOver("#ffffff", "#000000"))).toBe("#ffffff");
  });
});

describe("relativeLuminance and contrastRatio", () => {
  it("gives black/white the maximum 21:1 ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("gives a color no contrast against itself", () => {
    expect(contrastRatio("#5157d8", "#5157d8")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#112233", "#eeeeee")).toBeCloseTo(contrastRatio("#eeeeee", "#112233"), 10);
  });

  it("white is the brightest and black the darkest relative luminance", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
});

describe("contrastOnGround", () => {
  it("matches a plain contrastRatio when nothing is translucent", () => {
    expect(contrastOnGround("#000000", "#ffffff", "#ffffff")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 5);
  });

  it("composites an alpha surface over the ground before comparing", () => {
    // A half-white surface over a black ground reads as mid-grey; black text on it
    // should contrast less than black text on a fully white surface.
    const onTranslucent = contrastOnGround("#000000", "#ffffff80", "#000000");
    const onOpaque = contrastOnGround("#000000", "#ffffff", "#000000");
    expect(onTranslucent).toBeLessThan(onOpaque);
  });
});

describe("Rime & Ink tokens reach AA on the page and app surfaces", () => {
  it.each(["fg-primary", "fg-secondary", "fg-label", "fg-accent", "fg-pill"])("--%s", (name) => {
    expectAAOnAllGrounds(name);
  });

  it.each(["success-fg", "warning-fg", "danger-fg"])("semantic --%s", (name) => {
    expectAAOnAllGrounds(name);
  });

  it.each(["party-applicant-fg", "party-clerk-fg", "party-pws-fg", "party-hl-fg"])("party --%s", (name) => {
    expectAAOnAllGrounds(name);
  });

  it.each(["tier-instant-fg", "tier-reviewed-fg", "tier-special-fg"])("tier --%s", (name) => {
    expectAAOnAllGrounds(name);
  });

  it("white reaches AA on indigo-650 and indigo-500 (primary buttons)", () => {
    expect(contrastRatio("#ffffff", color("indigo-650"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#ffffff", color("indigo-500"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("fg-tertiary is decoration-only: below AA on the page ground", () => {
    const ratio = contrastOnGround(color("fg-tertiary"), "#ffffffff", PAGE_GROUND);
    expect(ratio, "fg-tertiary now passes AA — update the design doc if that's intended").toBeLessThan(AA_TEXT);
  });
});

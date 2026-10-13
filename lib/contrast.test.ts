import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blendOver, contrastOnGround, contrastRatio, parseHex, relativeLuminance, toHex, type RGBA } from "./contrast";

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

/**
 * The pairs the screens put together beyond text on a plain surface (the accessibility pass,
 * 5F): text on a tint, the focus ring on everything it can sit on, and the night section. A
 * tint is translucent, so each is checked over every ground it is drawn on.
 */
const AA_GRAPHIC = 3;

/** `layers` composited bottom to top, each over what is beneath it. */
function stack(...layers: string[]): RGBA {
  return layers.slice(1).reduce<RGBA>((under, layer) => blendOver(layer, under), blendOver(layers[0], "#ffffff"));
}

/** A color at `alpha` (0 to 1) of its own alpha: Tailwind's `text-current/85`. */
function fade(hex: string, alpha: number): RGBA {
  const c = parseHex(hex);
  return { ...c, a: c.a * alpha };
}

const BASES: Record<string, RGBA> = {
  "the page ground": stack(PAGE_GROUND),
  "surface-1": stack(PAGE_GROUND, SURFACE_1),
  "surface-2": stack(PAGE_GROUND, color("surface-2")),
  "surface-strong": stack(PAGE_GROUND, SURFACE_STRONG),
  "glass-tinted (the top bar, a sheet)": stack(PAGE_GROUND, color("glass-tinted")),
  "surface-solid (a menu, a popover)": stack(color("surface-solid")),
};

function expectOnEveryBase(label: string, fg: string | RGBA, tint: string | null, minimum: number) {
  for (const [baseLabel, base] of Object.entries(BASES)) {
    const ground = tint ? blendOver(color(tint), base) : base;
    const ratio = contrastRatio(blendOver(fg, ground), ground);
    expect(ratio, `${label}${tint ? ` on --${tint}` : ""} over ${baseLabel} (${toHex(ground)}) is ${ratio.toFixed(2)}:1, below ${minimum}:1`).toBeGreaterThanOrEqual(minimum);
  }
}

describe("text on a tint reaches AA over every ground the tint is drawn on", () => {
  // A chip, a badge, a banner, a state or a tier: the tint with its own text color.
  it.each([
    ["fg-pill", "pill-fill"],
    ["success-fg", "success-surface"],
    ["success-fg", "success-surface-strong"],
    ["warning-fg", "warning-surface"],
    ["danger-fg", "danger-surface"],
    ["party-applicant-fg", "party-applicant-surface"],
    ["party-clerk-fg", "party-clerk-surface"],
    ["party-pws-fg", "party-pws-surface"],
    ["party-hl-fg", "party-hl-surface"],
    ["tier-instant-fg", "tier-instant-surface"],
    ["tier-reviewed-fg", "tier-reviewed-surface"],
    ["tier-special-fg", "tier-special-surface"],
  ])("--%s on --%s", (fg, tint) => {
    expectOnEveryBase(`--${fg}`, color(fg), tint, AA_TEXT);
  });

  // A banner's paragraph and a badge's reason used to be the tint's text color at 85%
  // (`text-current/85`). That is 3.9:1 for the success and the warning ink, so they are drawn
  // at full strength now, and tests/guards.test.ts keeps part-opacity text out.
  it.each([
    ["success-fg", "success-surface"],
    ["warning-fg", "warning-surface"],
  ])("--%s at 85%% on --%s would not", (fg, tint) => {
    const ground = blendOver(color(tint), BASES["the page ground"]);
    expect(contrastRatio(blendOver(fade(color(fg), 0.85), ground), ground)).toBeLessThan(AA_TEXT);
  });

  // A row or a card that is tinted and keeps the page's own inks: the row that is up now in
  // Who's up, a pinned or a sent-back card on the board, a selected option in the wizard.
  it.each([
    ["fg-primary", "pill-fill"],
    ["fg-secondary", "pill-fill"],
    ["fg-label", "pill-fill"],
    ["fg-accent", "pill-fill"],
    ["fg-primary", "warning-surface"],
    ["fg-secondary", "warning-surface"],
    ["fg-label", "warning-surface"],
  ])("--%s on --%s", (fg, tint) => {
    expectOnEveryBase(`--${fg}`, color(fg), tint, AA_TEXT);
  });
});

describe("the focus ring is at least 3:1 against what it is drawn on (WCAG 1.4.11)", () => {
  it("on the page ground and every glass surface", () => {
    expectOnEveryBase("--focus-ring", color("focus-ring"), null, AA_GRAPHIC);
  });

  // A focused control inside a tinted row or card: the ring's offset puts it on the tint.
  it.each(["pill-fill", "success-surface", "warning-surface", "danger-surface", "teal-soft", "party-pws-surface", "tier-special-surface"])("on --%s", (tint) => {
    expectOnEveryBase("--focus-ring", color("focus-ring"), tint, AA_GRAPHIC);
  });

  it("the design doc's 70% ring would not be: it is why the token is opaque", () => {
    const seventyPercent = fade(color("indigo-500"), 0.7);
    const onPage = contrastRatio(blendOver(seventyPercent, BASES["the page ground"]), BASES["the page ground"]);
    expect(onPage).toBeLessThan(AA_GRAPHIC);
  });

  it("on the night surface the ring is the mint accent, since the indigo one is not 3:1 there", () => {
    const night = stack(PAGE_GROUND, color("night"));
    const nightGlass = blendOver("#0f1622e6", night); // --night-glass, rgba(15, 22, 34, 0.9)
    for (const ground of [night, nightGlass, stack(color("ink-950"))]) {
      expect(contrastRatio(blendOver(color("night-accent"), ground), ground)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    }
    expect(contrastRatio(blendOver(color("focus-ring"), night), night)).toBeLessThan(AA_GRAPHIC + 0.1);
  });
});

describe("the night section reaches AA", () => {
  const night = stack(PAGE_GROUND, color("night"));

  it.each(["night-fg", "night-fg-secondary", "night-accent", "night-added", "night-removed"])("--%s on --night", (name) => {
    const ratio = contrastRatio(blendOver(color(name), night), night);
    expect(ratio, `--${name} on --night is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("night-fg-tertiary is decoration only there, as fg-tertiary is on the page", () => {
    expect(contrastRatio(blendOver(color("night-fg-tertiary"), night), night)).toBeLessThan(AA_TEXT);
  });

  it("a tooltip's text (night-fg on ink-950) and a dark button's (white on ink-950 and ink-800)", () => {
    expect(contrastRatio(blendOver(color("night-fg"), color("ink-950")), color("ink-950"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#ffffff", color("ink-950"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#ffffff", color("ink-800"))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("marks that stand without a word beside them are at least 3:1", () => {
  // The dot or rule that says a tier on the calendar and the map, the indigo of a current step
  // and a checked box, the stroke of a danger or success icon.
  it.each(["tier-instant", "tier-reviewed", "tier-special", "indigo-650", "indigo-500", "success", "danger"])("--%s on the page and the glass surfaces", (name) => {
    expectOnEveryBase(`--${name}`, color(name), null, AA_GRAPHIC);
  });

  it("amber and teal are not: the Public Works & Safety and Health & Legal hues, and the warning hue, always sit beside an icon and a label", () => {
    for (const name of ["party-pws", "party-hl", "warning"]) {
      const ratio = contrastRatio(color(name), PAGE_GROUND);
      expect(ratio, `--${name} is now ${ratio.toFixed(2)}:1 on the page; it could stand alone`).toBeLessThan(AA_GRAPHIC);
    }
  });
});

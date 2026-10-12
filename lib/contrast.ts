/**
 * WCAG 2.2 contrast math for Rime & Ink's alpha-in-hex tokens.
 *
 * Text and surface tokens carry their own alpha (e.g. `#0d1420f0`), which means
 * the color you actually see depends on what they sit on. These helpers parse a
 * hex color (3/4/6/8 digit), alpha-composite one color over an opaque backdrop,
 * and compute the WCAG relative-luminance contrast ratio between two opaque
 * colors. `lib/contrast.test.ts` uses them to check every token pair named in
 * the design system doc against the page ground and the glass surfaces.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** 0 (transparent) to 1 (opaque). */
  a: number;
}

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. Throws on anything else. */
export function parseHex(hex: string): RGBA {
  const value = hex.trim().replace(/^#/, "");
  const expand = (s: string) =>
    s
      .split("")
      .map((c) => c + c)
      .join("");

  let eight: string;
  if (value.length === 3) eight = `${expand(value)}ff`;
  else if (value.length === 4) eight = expand(value);
  else if (value.length === 6) eight = `${value}ff`;
  else if (value.length === 8) eight = value;
  else throw new Error(`Not a hex color: ${hex}`);

  const r = parseInt(eight.slice(0, 2), 16);
  const g = parseInt(eight.slice(2, 4), 16);
  const b = parseInt(eight.slice(4, 6), 16);
  const a = parseInt(eight.slice(6, 8), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n)) || Number.isNaN(a)) {
    throw new Error(`Not a hex color: ${hex}`);
  }
  return { r, g, b, a };
}

function toRGBA(color: RGBA | string): RGBA {
  return typeof color === "string" ? parseHex(color) : color;
}

/**
 * Alpha-composites `fg` over an opaque `bg`, "Porter-Duff over". `bg`'s own
 * alpha is ignored (treated as 1); pass an already-composited color for a
 * translucent backdrop that itself sits on something.
 */
export function blendOver(fg: RGBA | string, bg: RGBA | string): RGBA {
  const top = toRGBA(fg);
  const base = toRGBA(bg);
  const a = top.a;
  return {
    r: Math.round(top.r * a + base.r * (1 - a)),
    g: Math.round(top.g * a + base.g * (1 - a)),
    b: Math.round(top.b * a + base.b * (1 - a)),
    a: 1,
  };
}

export function toHex(color: RGBA): string {
  const channel = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function srgbToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. The color is treated as opaque (alpha is ignored). */
export function relativeLuminance(color: RGBA | string): number {
  const c = toRGBA(color);
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1 to 21) between two opaque colors. */
export function contrastRatio(a: RGBA | string, b: RGBA | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The contrast a (possibly translucent) foreground reaches against a
 * (possibly translucent) surface, once both are composited onto an opaque
 * `ground`. This is what "alpha-blended over the surface it sits on" means:
 * the surface is blended over the ground first, then the text is blended over
 * that result, and the two final opaque colors are compared.
 */
export function contrastOnGround(
  fg: RGBA | string,
  surface: RGBA | string,
  ground: RGBA | string,
): number {
  const groundColor = toRGBA(ground);
  const surfaceOnGround = blendOver(surface, groundColor);
  const fgOnSurface = blendOver(fg, surfaceOnGround);
  return contrastRatio(fgOnSurface, surfaceOnGround);
}

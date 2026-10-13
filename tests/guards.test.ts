/**
 * Project-wide guards that lint cannot express.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

const UI_FILES = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "components"))];

// A hex color, or a color function with literal numbers. Tokens live in styles/tokens.css.
const RAW_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.]/;

describe("design tokens", () => {
  it("app/ and components/ contain no raw color values", () => {
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (line.includes("guard-allow-color")) return;
          const match = line.match(RAW_COLOR);
          if (match) offenders.push(`${relative(ROOT, file)}:${index + 1}  ${match[0]}`);
        });
    }
    expect(offenders, `Use a token from styles/tokens.css instead:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("text contrast", () => {
  // fg-tertiary is 2.6 to 2.7:1 on the page: fine for a placeholder or an ornament, not for
  // words someone has to read (plan 3.2). Use text-fg-secondary, or text-fg-label for metadata.
  const TERTIARY_TEXT = /(?<![\w:-])(?:[\w-]+:)*text-fg-tertiary\b/g;
  const PLACEHOLDER = /(?:^|:)(?:placeholder|data-placeholder):/;

  it("fg-tertiary carries placeholders and decoration only", () => {
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          // A purely decorative use (a dot, a rule) says so on its line.
          if (line.includes("guard-allow-tertiary")) return;
          for (const match of line.matchAll(TERTIARY_TEXT)) {
            if (!PLACEHOLDER.test(match[0])) offenders.push(`${relative(ROOT, file)}:${index + 1}  ${match[0]}`);
          }
        });
    }
    expect(offenders, `Tertiary text fails AA; use text-fg-secondary or text-fg-label:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("integration rule", () => {
  // A surface may import shared folders only, never another surface.
  const SHARED = new Set(["ui", "domain", "map", "calendar", "shell"]);

  it("no surface imports another surface's components", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, "components"))) {
      const own = relative(join(ROOT, "components"), file).split("/")[0];
      if (SHARED.has(own)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/from\s+["']@\/components\/([^/"']+)/g)) {
        const target = match[1];
        if (target !== own && !SHARED.has(target)) {
          offenders.push(`${relative(ROOT, file)} imports components/${target}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

describe("every route is built", () => {
  // Phases 2 to 4 kept a placeholder page for each route nobody had built yet. Phases 5 and 6
  // built the last of them (the amendment, Payments, Closures and routes, Work orders,
  // Verifications, Inspections, Settings), and a route added from here on is built with its page.
  const pages = sourceFiles(join(ROOT, "app")).filter((file) => /[\\/]page\.tsx$/.test(file));

  it("finds the app's pages: the 19 routes of the PRD's route map, the demo guide and the two dev pages", () => {
    expect(pages.map((file) => relative(join(ROOT, "app"), file)).sort()).toEqual([
      "apply/page.tsx",
      "city/active/page.tsx",
      "city/cases/[id]/page.tsx",
      "city/cases/page.tsx",
      "city/inspections/page.tsx",
      "city/intake/page.tsx",
      "city/map/page.tsx",
      "city/payments/page.tsx",
      "city/queue/page.tsx",
      "city/settings/page.tsx",
      "city/verifications/page.tsx",
      "city/work-orders/page.tsx",
      "demo/page.tsx",
      "dev/kit/page.tsx",
      "dev/map/page.tsx",
      "events/[id]/amend/page.tsx",
      "events/[id]/page.tsx",
      "events/[id]/permit/page.tsx",
      "events/[id]/quote/page.tsx",
      "events/page.tsx",
      "page.tsx",
      "verify/[id]/page.tsx",
    ]);
  });

  it("no page renders the placeholder screen", () => {
    const offenders = pages.filter((file) => /PlaceholderScreen/.test(readFileSync(file, "utf8"))).map((file) => relative(ROOT, file));
    expect(offenders, `Still a placeholder:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every page is the thin server component of the pattern: one client screen under Suspense", () => {
    for (const file of pages) {
      const text = readFileSync(file, "utf8");
      expect(text, relative(ROOT, file)).toMatch(/<Suspense fallback=\{null\}>/);
      expect(text, relative(ROOT, file)).not.toMatch(/["']use client["']/);
    }
  });
});

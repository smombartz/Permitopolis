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

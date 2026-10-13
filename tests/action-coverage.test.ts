/**
 * Workstream 4F's action-coverage gate. Two checks:
 *
 * 1. Every action type in ACTION_TYPES a person can take (everything but the system's own
 *    "tick") has a control somewhere in app/ or components/ that dispatches it: the literal
 *    `{ type: "..." }` in a `dispatch(...)` call (scanned from source, so a new action with no
 *    control anywhere fails this immediately), or a panel registered for it in
 *    components/case/actions/registry.ts (its generic map or a role's overrides), which is how
 *    the sticky "Your actions" panel and Who's up reach it even when the dispatch itself lives
 *    inside a shared panelKit helper.
 * 2. With the real seed: for every seeded case and every city role, every row
 *    `availableActions()` returns has a panel (`panelFor`), and every enabled row's panel
 *    renders something (via `renderToStaticMarkup`, since this file runs in the `unit`
 *    project's node environment, not jsdom -- see vitest.config.mts).
 * 3. With the real seed: every open task Who's up lists (and so every My queue row) resolves,
 *    for each city role, to a panel that renders. This is the path that carries an argument
 *    (a card to verify, a meeting to schedule, a work order to close, a party to remind).
 *
 * A panel is rendered inside `<Sheet open>` and not inside `<SheetContent>`: the content is a
 * portal, and a portal renders nothing on the server, so a panel wrapped in it could throw and
 * never be noticed. The dialog root is all a panel's title and description need.
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/sheet";
import { panelFor } from "@/components/case/actions/registry";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { availableActions, buildSeed, useDemo, waitingOn } from "@/lib/state";
import { ACTION_TYPES, type ActionType } from "@/lib/state/actions";
import type { Dept } from "@/lib/types";
import { parseOpenKey, resolveOpenKey } from "@/lib/view/caseDetail";

// The review panel hands off to the request panel through the URL. This file runs in node,
// outside the render project's navigation mock, so it brings a router that does nothing.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/city/cases",
  useParams: () => ({}),
}));

/** One panel as the sheet would show it, as markup. Empty when the panel rendered nothing. */
function renderPanel(action: ActionType, role: Dept, caseId: string, arg?: string): string {
  const Panel = panelFor(action, role);
  if (!Panel) return "";
  return renderToStaticMarkup(React.createElement(Sheet, { open: true }, React.createElement(Panel, { caseId, arg, role, onClose: () => {} })));
}

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];
const TEST_FILE_RE = /\.test\.(ts|tsx)$/;
const SOURCE_FILE_RE = /\.(ts|tsx)$/;

/** A dispatch call's first object argument, whatever came before it (none, or `caseId,`). */
const DISPATCH_PATTERN = /dispatch\(\s*(?:[\w.]+\s*,\s*)?\{\s*type:\s*["'`](\w+)["'`]/g;

/** Every .ts/.tsx source file under app/ and components/, skipping render and unit tests. */
function sourceFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (SOURCE_FILE_RE.test(entry.name) && !TEST_FILE_RE.test(entry.name)) {
        files.push(full);
      }
    }
  }
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));
  return files;
}

/** Every action type literally dispatched in each file, repo-relative, scanned once for the whole module. */
function scanDispatches(): Map<ActionType, string[]> {
  const knownTypes = new Set<string>(ACTION_TYPES);
  const coverage = new Map<ActionType, string[]>();
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(DISPATCH_PATTERN)) {
      const type = match[1];
      if (!knownTypes.has(type)) continue;
      const rel = path.relative(ROOT, file);
      const existing = coverage.get(type as ActionType);
      if (existing) {
        if (!existing.includes(rel)) existing.push(rel);
      } else {
        coverage.set(type as ActionType, [rel]);
      }
    }
  }
  return coverage;
}

/** Action types the registry has a panel for, under any city role: the second way a type counts as covered. */
function registryCoveredTypes(): Set<ActionType> {
  const roles: Dept[] = ["clerk", "pws", "hl"];
  const covered = new Set<ActionType>();
  for (const type of ACTION_TYPES) {
    if (roles.some((role) => panelFor(type, role) !== undefined)) covered.add(type);
  }
  return covered;
}

const dispatchCoverage = scanDispatches();
const registryCovered = registryCoveredTypes();

/** This action's covering file(s), for the test's own failure message and its "which file" report. */
function coverageFor(type: ActionType): string[] {
  const files = dispatchCoverage.get(type) ?? [];
  if (files.length > 0) return files;
  // Registered but not matched by the dispatch scan (a panel whose own dispatch call is not a
  // plain literal): credit the registry, since that is how the screen still reaches it.
  return registryCovered.has(type) ? ["components/case/actions/registry.ts (panel registered)"] : [];
}

/**
 * Action types this prototype deliberately has no control for yet. There are none: amendment
 * (5A) was the last, and its control is the amendment wizard's last step. Keep this list to the
 * bare minimum: the first `it` below fails the moment a listed gap is actually closed, so it
 * cannot go stale in the other direction either.
 */
const KNOWN_GAPS: ActionType[] = [];

describe("action coverage: every action a person can take has a control", () => {
  const actionable = ACTION_TYPES.filter((type) => type !== "tick");

  it.each(actionable)("%s has a dispatching control, or is a documented gap", (type) => {
    const files = coverageFor(type);
    if (KNOWN_GAPS.includes(type)) {
      expect(files, `"${type}" now has a control (${files.join(", ")}): remove it from KNOWN_GAPS above.`).toEqual([]);
      return;
    }
    expect(files.length, `No control in app/ or components/ dispatches "${type}".`).toBeGreaterThan(0);
  });

  it("reports which file(s) provide each covered action type", () => {
    const report: Record<string, string[]> = {};
    for (const type of actionable) {
      if (KNOWN_GAPS.includes(type)) continue;
      report[type] = coverageFor(type);
    }
    // Printed on failure (and visible with --reporter=verbose): action type -> covering files.
    for (const [type, files] of Object.entries(report)) {
      expect(files.length, `${type}: ${JSON.stringify(report)}`).toBeGreaterThan(0);
    }
  });
});

describe("action coverage: every seeded case's availableActions() rows have a panel that renders", () => {
  const TODAY = DEFAULT_DEMO_TODAY;
  const seed = buildSeed();
  const roles: Dept[] = ["clerk", "pws", "hl"];

  for (const role of roles) {
    describe(`as ${role}`, () => {
      for (const c of seed) {
        const rows = availableActions(c, role, { today: TODAY, cases: seed, cfg: DEFAULT_CONFIG });
        if (rows.length === 0) continue;

        it(`${c.id}: every row has a registered panel, and every enabled one renders`, () => {
          // The panels read the case straight off the store (useCaseContext), as the real
          // screen does; point it at this exact seed before rendering any of them.
          useDemo.setState({ cases: seed, demoToday: TODAY, cfg: DEFAULT_CONFIG, role });

          for (const row of rows) {
            expect(panelFor(row.type, role), `${c.id} as ${role}: no panel registered for "${row.type}"`).toBeDefined();
            if (!row.enabled) continue;
            const html = renderPanel(row.type, role, c.id);
            expect(html, `${c.id} as ${role}: the panel for "${row.type}" rendered nothing`).toContain('data-slot="sheet-title"');
          }
        });
      }
    });
  }
});

describe("action coverage: every open task in Who's up opens a panel that renders, for whoever is looking", () => {
  const TODAY = DEFAULT_DEMO_TODAY;
  const seed = buildSeed();
  const roles: Dept[] = ["clerk", "pws", "hl"];

  it("a panel is really rendered: the check above is not a portal that renders nothing", () => {
    useDemo.setState({ cases: seed, demoToday: TODAY, cfg: DEFAULT_CONFIG, role: "clerk" });
    const html = renderPanel("add_note", "clerk", seed[0].id);
    expect(html).toContain('data-slot="sheet-title"');
    expect(html).toContain("Add a note");
  });

  for (const role of roles) {
    it(`as ${role}: every open task on every seeded case`, () => {
      useDemo.setState({ cases: seed, demoToday: TODAY, cfg: DEFAULT_CONFIG, role });
      let opened = 0;
      for (const c of seed) {
        if (c.ending || c.state === "draft") continue;
        for (const party of waitingOn(c, TODAY)) {
          for (const task of party.openTasks) {
            const key = resolveOpenKey(c, task.id, role);
            expect(key, `${c.id} as ${role}: "${task.title}" (${task.catalogId}) opens nothing`).not.toBeNull();
            const { action, arg } = parseOpenKey(key!);
            const html = renderPanel(action, role, c.id, arg);
            expect(html, `${c.id} as ${role}: "${task.title}" opened ${key}, which rendered nothing`).toContain('data-slot="sheet-title"');
            opened++;
          }
        }
      }
      expect(opened).toBeGreaterThan(40);
    });
  }
});

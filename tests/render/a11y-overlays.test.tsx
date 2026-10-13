/**
 * What tests/render/a11y.test.tsx cannot see, because it is shut when a page opens: every
 * action panel a city role can open on a case, every kind of card sheet on the applicant's
 * board, and the shell's menus and dialogs. Each is opened against the seed and held to the
 * same checks (tests/render/a11yAudit.ts): no unnamed control, no duplicate id, ids that aria
 * attributes point at, headings in order.
 *
 * A dialog also has to say what it is: a name (its title), and a way out that is a button
 * named "Close". The page behind it is hidden from a screen reader while it is open, so the
 * audit sees the dialog alone.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardScreen } from "@/components/board/BoardScreen";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { routes } from "@/lib/routes";
import { availableActions, buildSeed, isVisibleToCity, useDemo } from "@/lib/state";
import { PARTY_LABEL, type Dept, type EventCase } from "@/lib/types";
import { boardColumnsGrouped, canAmend } from "@/lib/view/board";
import { parseOpenKey, resolveOpenKey } from "@/lib/view/caseDetail";
import { auditPage } from "./a11yAudit";
import { renderScreen } from "./harness";

const SEED = buildSeed();
const CITY: Dept[] = ["clerk", "pws", "hl"];
const TODAY = useDemo.getInitialState().demoToday;
const CFG = useDemo.getInitialState().cfg;

interface PanelCase {
  name: string;
  role: Dept;
  caseId: string;
  task: string;
}

/**
 * One case for each panel a role can open, in each state it can open it in: the rows of the
 * sticky "Your actions" panel (enabled or not: a disabled row's panel still opens from a link),
 * and every task of the case that resolves to a panel for that role (a document to verify, a
 * work order, a meeting).
 */
function panelCases(): PanelCase[] {
  const seen = new Set<string>();
  const cases: PanelCase[] = [];
  const add = (role: Dept, c: EventCase, task: string, key: string) => {
    const { action, arg } = parseOpenKey(key);
    const signature = `${role}|${action}|${arg ? "arg" : ""}|${c.state}|${c.tier}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    cases.push({ name: `${PARTY_LABEL[role]}: ${action}${arg ? ` (${arg})` : ""} on ${c.id} (${c.tier}, ${c.state})`, role, caseId: c.id, task });
  };
  for (const c of SEED.filter(isVisibleToCity)) {
    for (const role of CITY) {
      for (const action of availableActions(c, role, { today: TODAY, cases: SEED, cfg: CFG })) add(role, c, action.type, action.type);
      for (const task of c.tasks) {
        const key = resolveOpenKey(c, task.id, role);
        if (key) add(role, c, task.id, key);
      }
    }
  }
  return cases;
}

interface CardCase {
  name: string;
  c: EventCase;
  card: string;
}

/** One card of each kind, in each status, pinned or not; one vendor stack; one series schedule. */
function cardCases(): CardCase[] {
  const seen = new Set<string>();
  const cases: CardCase[] = [];
  for (const c of SEED) {
    if (c.tasks.length === 0) continue;
    for (const entry of Object.values(boardColumnsGrouped(c)).flat()) {
      if (entry.kind === "stack") {
        if (!seen.has("stack")) cases.push({ name: `the ${entry.title} stack on ${c.id}`, c, card: `stack:${entry.catalogId}` });
        seen.add("stack");
        continue;
      }
      const task = entry.task;
      const pinned = Boolean(task.request) && task.request?.resolved === false;
      const signature = `${task.catalogId}|${task.status}|${pinned}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      cases.push({ name: `${task.catalogId} (${task.status}${pinned ? ", a request pinned" : ""}) on ${c.id}`, c, card: task.id });
    }
  }
  return cases;
}

/** The open dialog or sheet, checked as a dialog and by the audit. */
function expectAccessibleDialog(): HTMLElement {
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAccessibleName();
  expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  expect(auditPage({ fragment: true })).toEqual([]);
  return dialog;
}

describe("every action panel a city role can open", () => {
  const cases = panelCases();

  it("covers every city role and more than a dozen kinds of panel", () => {
    expect(new Set(cases.map((p) => p.role)).size).toBe(3);
    expect(new Set(cases.map((p) => p.name.split(": ")[1].split(" ")[0])).size).toBeGreaterThan(12);
  });

  it.each(cases)("$name", async ({ role, caseId, task }) => {
    await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role, path: routes.city.case(caseId, { task }) },
    );
    expectAccessibleDialog();
  });
});

describe("every kind of card sheet on the applicant's board", () => {
  const cases = cardCases();

  it("covers documents, forms, payments, sign-offs, meetings and the vendor stack", () => {
    expect(cases.length).toBeGreaterThan(30);
    expect(cases.some((k) => k.card.startsWith("stack:"))).toBe(true);
  });

  it.each(cases)("$name", async ({ c, card }) => {
    await renderScreen(
      <AppShell>
        <BoardScreen />
      </AppShell>,
      { role: "applicant", personaId: c.applicantId, path: routes.event(c.id, { card }) },
    );
    // A card that goes straight to another page (the quote, the permit) opens no sheet from the URL.
    if (screen.queryByRole("dialog")) expectAccessibleDialog();
  });
});

describe("the shell's menus, popovers and dialogs", () => {
  it("the Demo menu, and the reset confirmation it opens", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { role: "clerk", path: routes.city.queue() });

    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAccessibleName();
    expect(auditPage({ fragment: true })).toEqual([]);

    await user.click(within(menu).getByRole("menuitem", { name: "Reset demo data" }));
    expectAccessibleDialog();
  });

  it("the Demo menu's date picker: every day is a named button", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { role: "clerk", path: routes.city.queue() });

    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    await user.click(await screen.findByRole("menuitem", { name: /Set demo date/ }));

    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(auditPage({ fragment: true })).toEqual([]);
    // The demo's today, named in full, not as "3".
    expect(screen.getByRole("button", { name: /Monday, May 3rd, 2027/ })).toBeInTheDocument();
  });

  it("the persona picker's menu", async () => {
    const { user } = await renderScreen(<AppShell>page</AppShell>, { role: "applicant", personaId: "maya-chen", path: routes.events() });

    await user.click(screen.getByRole("button", { name: "Switch applicant: Maya Chen" }));
    expect(await screen.findByRole("menu")).toHaveAccessibleName();
    expect(auditPage({ fragment: true })).toEqual([]);
  });

  it("the coach's Next path menu", async () => {
    const { user } = await renderScreen(<AppShell>page</AppShell>, { scenario: "S3" });

    await user.click(screen.getByRole("button", { name: "Next path" }));
    expect(await screen.findByRole("menu")).toHaveAccessibleName();
    expect(auditPage({ fragment: true })).toEqual([]);
  });

  it("the board's menu, and the confirmation behind Withdraw", async () => {
    const { user } = await renderScreen(
      <AppShell>
        <BoardScreen />
      </AppShell>,
      { scenario: "S3" },
    );

    await user.click(screen.getByRole("button", { name: "Board menu" }));
    const menu = await screen.findByRole("menu");
    expect(auditPage({ fragment: true })).toEqual([]);

    await user.click(within(menu).getByRole("menuitem", { name: "Withdraw this application" }));
    expectAccessibleDialog();
  });

  it("the board's menu says in words why an event cannot be changed, not in a tooltip", async () => {
    const closed = SEED.find((c) => c.state !== "draft" && c.state !== "closed" && c.ending === null && !canAmend(c, TODAY).ok)!;
    expect(closed).toBeDefined();
    const { user } = await renderScreen(
      <AppShell>
        <BoardScreen />
      </AppShell>,
      { role: "applicant", personaId: closed.applicantId, path: routes.event(closed.id) },
    );

    await user.click(screen.getByRole("button", { name: "Board menu" }));
    const menu = await screen.findByRole("menu");
    const change = within(menu).getByRole("menuitem", { name: "Change your event" });

    expect(change).toHaveAttribute("aria-disabled", "true");
    expect(change).not.toHaveAttribute("title");
    expect(menu.querySelector("p")).toHaveTextContent(canAmend(closed, TODAY).reason!);
  });

  it("the command palette with a search typed in, cases among the results", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { role: "clerk", path: routes.city.queue() });

    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(await screen.findByRole("combobox", { name: "Search cases, pages and roles" }), "jazz");

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    expect(auditPage({ fragment: true })).toEqual([]);
  });

  it("the keyboard shortcuts dialog", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { role: "clerk", path: routes.city.queue() });

    await user.keyboard("?");
    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expectAccessibleDialog();
  });
});

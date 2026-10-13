/**
 * The keyboard: where focus goes when a sheet, a panel or the palette opens and where it goes
 * back to, the skip link, and the one-key shortcuts that must stay out of the way of typing.
 *
 * jsdom has no layout, so this cannot see a focus ring or a tab order that depends on CSS. It
 * does see `document.activeElement`, which is the whole of "focus moves in, Esc closes, focus
 * returns".
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardScreen } from "@/components/board/BoardScreen";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { CasesScreen } from "@/components/city/lists/CasesScreen";
import { QueueScreen } from "@/components/city/lists/QueueScreen";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { AppShell } from "@/components/shell/AppShell";
import { CityShell } from "@/components/shell/CityShell";
import { MAIN_CONTENT_ID } from "@/components/ui/skip-link";
import { routes } from "@/lib/routes";
import { auditPage } from "./a11yAudit";
import { renderScreen } from "./harness";
import { navState } from "./setup";

const S3 = "PMT-27-0118";
const S5 = "PMT-27-0097";

/** Radix hands focus back on a zero-length timer after a dialog closes. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("the skip link", () => {
  it.each([
    ["the applicant's shell", <AppShell key="a">page</AppShell>, { path: routes.events() }],
    ["the city's shell", <CityShell key="c">page</CityShell>, { path: routes.city.queue(), role: "clerk" as const }],
    ["the landing page", <LandingScreen key="l" />, { path: routes.home() }],
  ])("is the first tab stop in %s and lands on the page's content", async (_name, ui, options) => {
    const { user } = await renderScreen(ui, options);

    await user.tab();

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute("href", `#${MAIN_CONTENT_ID}`);
    const target = document.getElementById(MAIN_CONTENT_ID)!;
    expect(target).not.toBeNull();
    // Focusable by script, so the jump moves focus in every browser, and not a tab stop itself.
    expect(target).toHaveAttribute("tabindex", "-1");
  });

  it("in the city's shell it lands past the sidebar, on the page", async () => {
    await renderScreen(<CityShell>page</CityShell>, { path: routes.city.queue(), role: "clerk" });

    const target = document.getElementById(MAIN_CONTENT_ID)!;
    expect(screen.getByRole("main")).toContainElement(target);
    expect(within(target).queryByRole("navigation")).not.toBeInTheDocument();
    expect(target).toHaveTextContent("page");
  });
});

describe("the board's card sheet", () => {
  it("takes focus when a card opens it, closes on Esc, and hands focus back to the card", async () => {
    const { user } = await renderScreen(
      <AppShell>
        <BoardScreen />
      </AppShell>,
      { scenario: "S3" },
    );

    const card = screen.getAllByRole("button", { name: /health permit/i })[0];
    card.focus();
    await user.keyboard("{Enter}");

    const sheet = await screen.findByRole("dialog");
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    expect(navState.search.get("card")).not.toBeNull();
    expect(auditPage({ fragment: true })).toEqual([]);

    // Tab stays inside: the page behind the sheet is out of reach while it is open.
    for (let presses = 0; presses < 12; presses++) {
      await user.tab();
      expect(sheet).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await settle();

    expect(navState.search.get("card")).toBeNull();
    expect(screen.getAllByRole("button", { name: /health permit/i })[0]).toHaveFocus();
  });
});

describe("the case's action panel", () => {
  it("takes focus when an action opens it, closes on Esc, and hands focus back to the action", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.case(S5) },
    );

    const actions = screen.getByRole("complementary", { name: "Your actions" });
    const action = within(actions).getAllByRole("button").find((button) => !button.hasAttribute("disabled"))!;
    const name = action.textContent!;
    action.focus();
    await user.keyboard("{Enter}");

    const sheet = await screen.findByRole("dialog");
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    expect(navState.search.get("task")).not.toBeNull();
    expect(auditPage({ fragment: true })).toEqual([]);

    for (let presses = 0; presses < 12; presses++) {
      await user.tab();
      expect(sheet).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await settle();

    expect(navState.search.get("task")).toBeNull();
    expect(within(screen.getByRole("complementary", { name: "Your actions" })).getByRole("button", { name })).toHaveFocus();
  });
});

describe("the command palette", () => {
  it("puts focus in its search field, closes on Esc, and hands focus back to the Search button", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { path: routes.city.queue(), role: "clerk" });

    const button = screen.getByRole("button", { name: "Search" });
    button.focus();
    await user.keyboard("{Enter}");

    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(palette).getByRole("combobox")).toHaveFocus();
    expect(auditPage({ fragment: true })).toEqual([]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await settle();

    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("opened with Cmd+K from a link, it hands focus back to that link", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { path: routes.city.queue(), role: "clerk" });

    const link = screen.getByRole("link", { name: "Cases" });
    link.focus();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await settle();

    expect(screen.getByRole("link", { name: "Cases" })).toHaveFocus();
  });

  it("opens from inside a field too: Cmd+K carries a modifier, so it is nobody's typing", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <CasesScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.cases({ view: "table" }) },
    );

    await user.click(screen.getByRole("searchbox", { name: "Search cases" }));
    await user.keyboard("{Control>}k{/Control}");

    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("is not opened by Cmd+Shift+K or Ctrl+Alt+K, which belong to the browser", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { path: routes.city.queue(), role: "clerk" });

    await user.keyboard("{Meta>}{Shift>}k{/Shift}{/Meta}");
    await user.keyboard("{Control>}{Alt>}k{/Alt}{/Control}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe('"?", the shortcuts dialog', () => {
  it("opens from the page, and hands focus back where it was on Esc", async () => {
    const { user } = await renderScreen(<CityShell>page</CityShell>, { path: routes.city.queue(), role: "clerk" });

    const link = screen.getByRole("link", { name: "Cases" });
    link.focus();
    await user.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(auditPage({ fragment: true })).toEqual([]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await settle();

    expect(screen.getByRole("link", { name: "Cases" })).toHaveFocus();
  });

  it("stays shut while a field has focus, with a modifier held, and inside an open menu", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <CasesScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.cases({ view: "table" }) },
    );

    const search = screen.getByRole("searchbox", { name: "Search cases" });
    await user.click(search);
    await user.keyboard("?");
    expect(search).toHaveValue("?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    screen.getByRole("link", { name: "Cases" }).focus();
    await user.keyboard("{Control>}?{/Control}");
    await user.keyboard("{Alt>}?{/Alt}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Demo menu" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe('"/", j and k on a list', () => {
  async function renderCasesTable() {
    return renderScreen(
      <CityShell>
        <CasesScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.cases({ view: "table" }) },
    );
  }

  it('"/" moves focus to the search field, and types a slash once focus is in it', async () => {
    const { user } = await renderCasesTable();
    const search = screen.getByRole("searchbox", { name: "Search cases" });

    screen.getByRole("link", { name: "Cases" }).focus();
    await user.keyboard("/");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");

    await user.keyboard("/");
    expect(search).toHaveValue("/");
  });

  it('"/" with Ctrl or Cmd held is left alone', async () => {
    const { user } = await renderCasesTable();
    const link = screen.getByRole("link", { name: "Cases" });

    link.focus();
    await user.keyboard("{Control>}/{/Control}");
    await user.keyboard("{Meta>}/{/Meta}");

    expect(link).toHaveFocus();
  });

  it("j and k move through the rows, and the arrow keys only once a row has focus", async () => {
    const { user } = await renderCasesTable();
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row-nav]"));
    expect(rows.length).toBeGreaterThan(2);
    const link = screen.getByRole("link", { name: "Cases" });

    // Nothing in the list has focus yet: the arrow keys are still the page's, to scroll with.
    link.focus();
    await user.keyboard("{ArrowDown}");
    expect(link).toHaveFocus();

    await user.keyboard("j");
    expect(rows[0]).toHaveFocus();
    await user.keyboard("j");
    expect(rows[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(rows[2]).toHaveFocus();
    await user.keyboard("k");
    expect(rows[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(rows[0]).toHaveFocus();
  });

  it("j and k are typed, not taken, in the search field; and are left alone with a modifier or in the role switcher", async () => {
    const { user } = await renderCasesTable();
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row-nav]"));

    rows[0].focus();
    await user.keyboard("{Control>}j{/Control}");
    await user.keyboard("{Alt>}j{/Alt}");
    await user.keyboard("{Meta>}j{/Meta}");
    expect(rows[0]).toHaveFocus();

    // The role switcher is a radio group: its own arrow keys, and no list shortcut inside it.
    const clerk = screen.getByRole("radio", { name: "City Clerk" });
    clerk.focus();
    await user.keyboard("j");
    expect(clerk).toHaveFocus();

    const search = screen.getByRole("searchbox", { name: "Search cases" });
    await user.click(search);
    await user.keyboard("jk");
    expect(search).toHaveValue("jk");
    expect(search).toHaveFocus();
  });

  it("My queue's rows move the same way", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <QueueScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.queue() },
    );
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row-nav]"));
    expect(rows.length).toBeGreaterThan(1);

    await user.keyboard("j");
    expect(rows[0]).toHaveFocus();
    await user.keyboard("j");
    expect(rows[1]).toHaveFocus();
    await user.keyboard("k");
    expect(rows[0]).toHaveFocus();
  });

  it("with a sheet open over the page, the keys stay in the sheet", async () => {
    const { user } = await renderScreen(
      <CityShell>
        <CaseDetailScreen />
      </CityShell>,
      { role: "clerk", path: routes.city.case(S3, { task: "add_note" }) },
    );

    const sheet = await screen.findByRole("dialog");
    const close = within(sheet).getByRole("button", { name: "Close" });
    close.focus();
    await user.keyboard("j");
    await user.keyboard("/");

    expect(close).toHaveFocus();
  });
});

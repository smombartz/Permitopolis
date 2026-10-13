/**
 * Phase 4's role tools, joined. Each builder tested its own panels (clerk-tools, review-tools,
 * verify) and its own tab; this file checks the places where one builder's work is read by
 * another's: the registry opening the right panel at the right width, the review panel handing
 * off to the request panel, and the Reviews, Documents and Conditions and fees tabs agreeing
 * about one case after each role has acted. S3 and S6 are walked through all three tabs.
 *
 * What crosses surfaces (the board, checkout, the queues, the role switcher) is in
 * tests/render/handoffs.test.tsx, where demo paths 3 to 6 are clicked from first step to last.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";
import { panelFor, panelWidthFor } from "@/components/case/actions/registry";
import { GENERIC_PANELS } from "@/components/case/actions/generic";
import { REQUEST_TEMPLATES } from "@/lib/data/templates";
import { routes } from "@/lib/routes";
import { caseTotals, checkIssuePermit, closeoutSettlement, dueAtQuote, useDemo } from "@/lib/state";
import { ACTION_TYPES } from "@/lib/state/actions";
import type { Dept } from "@/lib/types";
import { issuePermitChecklist } from "@/lib/view/clerkTools";
import { lastReplace, navigate, renderScreen, storedCase, switchRole } from "./harness";

const S3 = "PMT-27-0118"; // Jazz in the Plaza: Reviewed, Needs info (Health & Legal asked for a health permit)
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout, hours not logged
const FARMERS_MARKET = "PMT-27-0070"; // Riverside Farmers Market: Reviewed series, In review, nothing decided
const PERMIT_FILE = { name: "health-permit.pdf", size: 120_000, type: "application/pdf" };

const sheet = () => within(screen.getByRole("dialog"));
const sheetEl = () => screen.getByRole("dialog");
const yourActions = () => within(screen.getByRole("complementary", { name: "Your actions" }));

type User = Awaited<ReturnType<typeof renderScreen>>["user"];

async function openTab(user: User, name: "Overview" | "Reviews" | "Documents" | "Conditions and fees" | "Activity") {
  await user.click(screen.getByRole("tab", { name }));
  return within(screen.getByRole("tabpanel", { name }));
}

type Scope = ReturnType<typeof sheet>;

/** A department's own section on the Reviews tab: its heading carries the department's name. */
function reviewSection(tab: Scope, deptName: string): HTMLElement {
  const heading = tab.getAllByRole("heading", { level: 2 }).find((h: HTMLElement) => h.textContent?.includes(deptName));
  if (!heading) throw new Error(`No ${deptName} section on the Reviews tab`);
  return heading.closest('[data-slot="section"]') as HTMLElement;
}

/** A labeled figure (`Stat`) inside a tab or a panel: the value under the label. */
function stat(scope: Scope, label: string): string {
  return scope.getByText(label, { selector: '[data-slot="stat"] *' }).closest('[data-slot="stat"]')!.lastElementChild!.textContent ?? "";
}

describe("the registry opens the Phase 4 panels", () => {
  it("every city action still resolves to the shared panel for every city role: no role has an override hiding it", () => {
    const roles: Dept[] = ["clerk", "pws", "hl"];
    for (const type of ACTION_TYPES) {
      const generic = GENERIC_PANELS[type];
      if (!generic) continue;
      for (const role of roles) expect(panelFor(type, role), `${type} as ${role}`).toBe(generic);
    }
    // The 18 actions a city role takes from the case (Phase 5 added the Clerk's decision on an
    // amendment); the applicant's own are on the board.
    expect(Object.keys(GENERIC_PANELS)).toHaveLength(18);
    expect(GENERIC_PANELS.decide_amendment).toBeDefined();
  });

  it("the panels that hold two columns or a table open wide; a short form does not", () => {
    expect(ACTION_TYPES.filter((type) => panelWidthFor(type) === "wide").sort()).toEqual(["log_closeout", "reconcile_close", "reject_document", "review_decide", "send_quote", "verify_document"]);
  });

  it("Send quote opens the consolidation and quote builder, wide, under the button's own name", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { task: "send_quote" }), role: "clerk" });
    expect(sheet().getByRole("heading", { name: "Send quote" })).toBeInTheDocument();
    expect(sheet().getByRole("heading", { name: "Each department's decision" })).toBeInTheDocument();
    expect(sheet().getByRole("heading", { name: "Merged conditions" })).toBeInTheDocument();
    expect(sheetEl()).toHaveAttribute("data-width", "wide");
    // One column per routed department: Public Works & Safety and Health & Legal.
    expect(sheetEl().querySelectorAll('[data-slot="consolidation-columns"] > *')).toHaveLength(2);
  });

  it("a card's Verify opens the preview beside its checklist, wide; the old Send back key opens the same panel", async () => {
    const card = `${S5}:insurance_certificate`;
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: `verify_document:${card}` }), role: "hl" });
    expect(sheet().getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    expect(sheetEl()).toHaveAttribute("data-width", "wide");
    const layout = sheetEl().querySelector('[data-slot="verify-layout"]')!;
    expect(layout.children).toHaveLength(2);
    expect(within(layout.children[0] as HTMLElement).getByText("Named insured")).toBeInTheDocument();
    expect(within(layout.children[1] as HTMLElement).getAllByText("Passes")).toHaveLength(4);

    navigate(routes.city.case(S5, { task: `reject_document:${card}` }));
    expect(sheet().getByRole("heading", { name: "Verify: Certificate of insurance" })).toBeInTheDocument();
    expect(sheetEl()).toHaveAttribute("data-width", "wide");
  });

  it("a note, a reminder and a routing are short forms at the usual width", async () => {
    await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S5, { task: "add_note" }), role: "clerk" });
    expect(sheetEl()).toHaveAttribute("data-width", "default");
    navigate(routes.city.case(S5, { task: "remind:applicant" }));
    expect(sheetEl()).toHaveAttribute("data-width", "default");
  });
});

describe("the request panel's templates", () => {
  it("Health & Legal's health-permit template names the vendor of the card ticked, in the preview and in what is sent", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(FARMERS_MARKET, { task: "request_info" }), role: "hl" });
    const pick = async (template: string) => {
      await user.click(sheet().getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: template }));
    };

    // Nothing ticked yet: the words stand for every vendor, and no card is previewed.
    await pick(REQUEST_TEMPLATES.hl[0]);
    expect(sheet().getByRole("textbox", { name: /Message/ })).toHaveValue("Please upload each vendor's current health permit");

    // One vendor's card ticked: the template is that vendor's, and so is the card the applicant will see.
    await user.click(sheet().getByRole("checkbox", { name: "Health permit: Market Stall 3" }));
    await pick(REQUEST_TEMPLATES.hl[0]);
    expect(sheet().getByRole("textbox", { name: /Message/ })).toHaveValue("Please upload Market Stall 3's current health permit");
    expect(sheet().getByText("Please upload Market Stall 3's current health permit", { selector: "p" })).toBeInTheDocument();

    // No template leaves a raw placeholder in the preview card.
    for (const template of REQUEST_TEMPLATES.hl) {
      await pick(template);
      expect(screen.getByRole("dialog").textContent).not.toMatch(/[{}]/);
    }

    await pick(REQUEST_TEMPLATES.hl[0]);
    await user.click(sheet().getByRole("button", { name: "Send request" }));
    expect(storedCase(FARMERS_MARKET).tasks.find((t) => t.id === `${FARMERS_MARKET}:vendor_health_permit:3`)?.request?.message).toBe("Please upload Market Stall 3's current health permit");
  });
});

describe("the review panel", () => {
  it("\"Request information\" hands over to the request panel in the same sheet, and the request then shows on all three tabs", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(FARMERS_MARKET, { tab: "reviews" }), role: "hl" });

    await user.click(screen.getAllByRole("button", { name: "Decide your review" })[0]);
    expect(sheet().getByRole("heading", { name: "Decide your review" })).toBeInTheDocument();
    await user.click(sheet().getByRole("radio", { name: "Request information" }));
    await user.click(sheet().getByRole("button", { name: "Continue" }));

    // The same sheet, the other panel, the tab kept: nothing was decided.
    expect(lastReplace()).toBe(routes.city.case(FARMERS_MARKET, { tab: "reviews", task: "request_info" }));
    expect(sheet().getByRole("heading", { name: "Request information" })).toBeInTheDocument();
    expect(storedCase(FARMERS_MARKET).reviews.find((r) => r.dept === "hl")?.status).toBe("pending");

    await user.click(sheet().getByRole("checkbox", { name: "Vendor list" }));
    await user.type(sheet().getByRole("textbox", { name: /Message/ }), "Two vendors are missing from the list.");
    // What the applicant will see is drawn with the board's own card.
    expect(sheet().getByText("What the applicant will see")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Send request" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCase(FARMERS_MARKET).state).toBe("needs_info");

    // Reviews: the section says it waits on the applicant, and Decide is off until the answer.
    const reviews = within(screen.getByRole("tabpanel", { name: "Reviews" }));
    const own = within(reviewSection(reviews, "Health & Legal"));
    expect(own.getByText("Asked for more information")).toBeInTheDocument();
    expect(own.getByText("Waiting on the applicant's response.")).toBeInTheDocument();
    expect(own.getByRole("button", { name: "Decide your review" })).toBeDisabled();

    // Documents: the card carries the request, in the asker's words.
    const documents = await openTab(user, "Documents");
    const card = within(documents.getByTestId(`document-card-${FARMERS_MARKET}:vendor_list`));
    expect(card.getByText(/Two vendors are missing from the list\./)).toBeInTheDocument();
    expect(card.getByText(/waiting on the applicant/)).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
  });

  it("a plain approval carries no conditions, and \"Approve with conditions\" needs one", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(FARMERS_MARKET, { task: "review_decide" }), role: "pws" });

    // Approve: the condition builder is not offered.
    expect(sheet().getByRole("radio", { name: "Approve" })).toBeChecked();
    expect(sheet().queryByText("Add a condition")).not.toBeInTheDocument();

    await user.click(sheet().getByRole("radio", { name: "Approve with conditions" }));
    expect(sheet().getByRole("button", { name: "Approve with conditions" })).toBeDisabled();
    expect(sheet().getByText("Add at least one condition, or choose Approve.")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Generators placed at least 10 feet from any structure" }));
    expect(sheet().getByRole("button", { name: "Approve with conditions" })).toBeEnabled();

    // Back to a plain approval: the condition picked a moment ago does not ride along.
    await user.click(sheet().getByRole("radio", { name: "Approve" }));
    await user.click(sheet().getByRole("button", { name: "Approve" }));
    const decided = storedCase(FARMERS_MARKET);
    expect(decided.reviews.find((r) => r.dept === "pws")?.status).toBe("approved");
    expect(decided.conditions.filter((c) => c.dept === "pws")).toEqual([]);
  });
});

describe("S3 through Reviews, Documents and Conditions and fees, after each role acts", () => {
  it("the request, the answer, the check, the decision, the merged quote, the payment and the permit each show on every tab that should know", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S3, { tab: "reviews" }), role: "hl" });
    const permit = `${S3}:vendor_health_permit:1`;

    /* On load: Health & Legal has asked; Public Works & Safety approved with three conditions. */
    let reviews = within(screen.getByRole("tabpanel", { name: "Reviews" }));
    expect(within(reviewSection(reviews, "Health & Legal")).getByText("Asked for more information")).toBeInTheDocument();
    const pwsSection = within(reviewSection(reviews, "Public Works & Safety"));
    expect(pwsSection.getByText("Approved with conditions")).toBeInTheDocument();
    for (const text of ["Sound ends at 9 pm", "Speakers face away from the residences on Elm Street", "No more than 85 dB at 50 feet"]) expect(pwsSection.getByText(text)).toBeInTheDocument();

    let documents = await openTab(user, "Documents");
    expect(within(documents.getByTestId(`document-card-${permit}`)).getByText(/waiting on the applicant/)).toBeInTheDocument();
    let fees = await openTab(user, "Conditions and fees");
    // The same three conditions, and the estimate the quote will be built from.
    for (const text of ["Sound ends at 9 pm", "Speakers face away from the residences on Elm Street", "No more than 85 dB at 50 feet"]) expect(fees.getByText(text)).toBeInTheDocument();
    expect(stat(fees, "Total")).toBe("$715");
    expect(stat(fees, "Paid")).toBe("$0");

    /* The applicant answers (the board's own surface). */
    await act(async () => {
      useDemo.getState().dispatch(S3, { type: "respond_to_request", taskId: permit, files: [PERMIT_FILE] }, "applicant");
    });
    documents = await openTab(user, "Documents");
    let card = within(documents.getByTestId(`document-card-${permit}`));
    expect(card.getByText("Submitted")).toBeInTheDocument();
    expect(card.getByText("health-permit.pdf")).toBeInTheDocument();
    expect(card.getByText(/Submitted Mon, May 3, 2027 · waiting 0 days/)).toBeInTheDocument();
    reviews = await openTab(user, "Reviews");
    expect(within(reviewSection(reviews, "Health & Legal")).getByText("Reviewing")).toBeInTheDocument();

    /* Health & Legal checks the permit from the Documents tab. */
    documents = await openTab(user, "Documents");
    await user.click(within(documents.getByTestId(`document-card-${permit}`)).getByRole("button", { name: "Verify" }));
    expect(sheet().getByText("Rolling Dumpling Co. is on the vendor list.")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Verify" }));
    card = within(within(screen.getByRole("tabpanel", { name: "Documents" })).getByTestId(`document-card-${permit}`));
    expect(card.getByText("Verified")).toBeInTheDocument();
    expect(card.getByText("Verified Mon, May 3, 2027.")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();

    /* ...and decides its review, with the verified file in front of it. */
    reviews = await openTab(user, "Reviews");
    await user.click(within(reviewSection(reviews, "Health & Legal")).getByRole("button", { name: "Decide your review" }));
    expect(sheet().getByText("health-permit.pdf")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Approve" }));
    reviews = within(screen.getByRole("tabpanel", { name: "Reviews" }));
    const hlSection = within(reviewSection(reviews, "Health & Legal"));
    expect(hlSection.getByText("Approved")).toBeInTheDocument();
    expect(hlSection.getByText("Decided Mon, May 3, 2027")).toBeInTheDocument();
    expect(hlSection.queryByRole("button", { name: "Decide your review" })).not.toBeInTheDocument();

    /* The Clerk merges: one condition reworded, the rest as the reviewers wrote them. */
    switchRole("clerk");
    await user.click(yourActions().getByRole("button", { name: "Send quote" }));
    // Each department's decision is in the builder as it reads on the Reviews tab.
    const columns = sheetEl().querySelector('[data-slot="consolidation-columns"]') as HTMLElement;
    expect(within(columns).getByText("Approved with conditions")).toBeInTheDocument();
    expect(within(columns).getByText("Approved")).toBeInTheDocument();
    const first = sheet().getByRole("textbox", { name: "Condition 1" });
    await user.clear(first);
    await user.type(first, "Sound ends at 9 pm sharp");
    // The figure the Clerk is told goes out is the one the engine asks for once it is sent.
    expect(sheet().getByText(/Due now: \$715\./)).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Send quote" }));
    const quoted = storedCase(S3);
    expect(quoted.state).toBe("quote_sent");
    expect(dueAtQuote(quoted, useDemo.getState().cfg)).toBe(715);

    // The merged list is the case's one list: the Reviews tab and the Conditions tab both read it.
    reviews = within(screen.getByRole("tabpanel", { name: "Reviews" }));
    expect(within(reviewSection(reviews, "Public Works & Safety")).getByText("Sound ends at 9 pm sharp")).toBeInTheDocument();
    expect(reviews.queryByText("Sound ends at 9 pm")).not.toBeInTheDocument();
    fees = await openTab(user, "Conditions and fees");
    expect(fees.getByText("Sound ends at 9 pm sharp")).toBeInTheDocument();
    expect(fees.getAllByRole("listitem").filter((li) => li.closest('[data-slot="condition-list"]'))).toHaveLength(3);
    expect(stat(fees, "Total")).toBe("$715");
    expect(stat(fees, "Due")).toBe("$715");
    expect(fees.queryByRole("heading", { name: "Payments and refunds" })).not.toBeInTheDocument();

    /* The applicant signs and pays (checkout's own surface). */
    await act(async () => {
      const dispatch = useDemo.getState().dispatch;
      dispatch(S3, { type: "accept_and_sign", signature: "Dana Whitfield" }, "applicant");
      dispatch(S3, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant");
    });
    fees = within(screen.getByRole("tabpanel", { name: "Conditions and fees" }));
    expect(stat(fees, "Paid")).toBe("$715");
    expect(stat(fees, "Due")).toBe("$0");
    const payments = within(fees.getByRole("heading", { name: "Payments and refunds" }).closest('[data-slot="section"]') as HTMLElement);
    const paymentRow = within(payments.getByRole("cell", { name: "Quote payment" }).closest("tr")!);
    expect(paymentRow.getByText("Card")).toBeInTheDocument();
    expect(paymentRow.getByText("$715")).toBeInTheDocument();

    /* The Clerk issues: the checklist has all three done, and the permit's conditions are the merged ones. */
    await user.click(yourActions().getByRole("button", { name: "Issue permit" }));
    expect(sheet().getAllByText("Done")).toHaveLength(3);
    expect(sheet().queryByText("Waiting")).not.toBeInTheDocument();
    expect(sheet().getByText("Sound ends at 9 pm sharp")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Issue permit" }));
    expect(storedCase(S3).state).toBe("permitted");
    expect(caseTotals(storedCase(S3))).toMatchObject({ total: 715, paid: 715, due: 0 });
  }, 30_000);
});

describe("S6 through Reviews, Documents and Conditions and fees, after each role acts", () => {
  it("the closeout log, the settlement and the refund read the same in the log, the Clerk's panel and the tab", async () => {
    const { user } = await renderScreen(<CaseDetailScreen />, { path: routes.city.case(S6, { tab: "conditions" }), role: "pws" });

    /* On load: closeout, nothing logged. The tab shows Actual as not logged yet. */
    let fees = within(screen.getByRole("tabpanel", { name: "Conditions and fees" }));
    expect(fees.getAllByRole("columnheader", { name: "Actual" }).length).toBeGreaterThan(0);
    expect(fees.getAllByText("Not logged").length).toBeGreaterThan(0);
    expect(fees.queryByRole("heading", { name: "How this settles" })).not.toBeInTheDocument();
    const documents = await openTab(user, "Documents");
    expect(documents.getByText("25 of 25 vendors verified")).toBeInTheDocument();
    const reviews = await openTab(user, "Reviews");
    for (const dept of ["Public Works & Safety", "Health & Legal", "City Clerk"]) expect(within(reviewSection(reviews, dept)).getByText(/^Approved/)).toBeInTheDocument();

    /* Public Works & Safety logs the closeout: 72 officer-hours, 4 crew-hours. */
    await user.click(yourActions().getByRole("button", { name: "Log closeout" }));
    expect(sheetEl()).toHaveAttribute("data-width", "wide");
    const police = sheet().getByRole("spinbutton", { name: "Actual: Police" });
    await user.clear(police);
    await user.type(police, "72");
    await user.type(sheet().getByRole("spinbutton", { name: /Cleanup crew hours/ }), "4");
    expect(sheet().getByText("$750 over")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Log closeout" }));
    // What the log's running total said is what the engine settles on.
    expect(closeoutSettlement(storedCase(S6))).toMatchObject({ over: 750, fromDeposit: 750, refund: 250, bill: null });

    /* The tab: actuals in, and the settlement in the Clerk's figures. */
    fees = await openTab(user, "Conditions and fees");
    const policeRow = within(fees.getByRole("cell", { name: "Police" }).closest("tr")!);
    expect(policeRow.getByText("$5,610")).toBeInTheDocument();
    expect(policeRow.getByText("$6,120")).toBeInTheDocument();
    expect(policeRow.getByText("$510")).toBeInTheDocument();
    const crewRow = within(fees.getByRole("cell", { name: "Cleanup crew" }).closest("tr")!);
    expect(crewRow.getAllByText("$240")).toHaveLength(2); // actual, and all of it over the estimate
    expect(fees.getByRole("heading", { name: "How this settles" })).toBeInTheDocument();
    expect(stat(fees, "Over estimate")).toBe("$750");
    expect(stat(fees, "From deposit")).toBe("$750");
    expect(stat(fees, "Refund")).toBe("$250");

    /* The log, reopened by its own department: read-only, in the same table and the same words. */
    navigate(routes.city.case(S6, { tab: "conditions", task: "log_closeout" }));
    expect(sheet().getByText("Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling.")).toBeInTheDocument();
    expect(within(sheetEl().querySelector('[data-slot="cleanup-result"]') as HTMLElement).getByText("Pass")).toBeInTheDocument();
    expect(within(sheet().getByRole("cell", { name: "Police" }).closest("tr")!).getByText("$510")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Done" }));

    /* The Clerk reconciles: the panel's figures are the tab's. */
    switchRole("clerk");
    await user.click(yourActions().getByRole("button", { name: "Reconcile and close" }));
    expect(sheetEl()).toHaveAttribute("data-width", "wide");
    expect(within(sheetEl().querySelector('[data-slot="cleanup-result"]') as HTMLElement).getByText("Pass")).toBeInTheDocument();
    expect(stat(sheet(), "Over estimate")).toBe("$750");
    expect(stat(sheet(), "From deposit")).toBe("$750");
    expect(stat(sheet(), "Refund")).toBe("$250");
    expect(within(sheet().getByRole("cell", { name: "Police" }).closest("tr")!).getByText("$510")).toBeInTheDocument();
    await user.click(sheet().getByRole("button", { name: "Reconcile and close" }));
    expect(storedCase(S6).state).toBe("closed");

    /* Closed: the refund is a row among the payments, and nothing is due. */
    fees = within(screen.getByRole("tabpanel", { name: "Conditions and fees" }));
    expect(fees.queryByRole("heading", { name: "How this settles" })).not.toBeInTheDocument();
    expect(stat(fees, "Due")).toBe("$0");
    const payments = within(fees.getByRole("heading", { name: "Payments and refunds" }).closest('[data-slot="section"]') as HTMLElement);
    const refund = within(payments.getByRole("cell", { name: "Refund" }).closest("tr")!);
    expect(refund.getByText("-$250")).toBeInTheDocument();
    expect(refund.getByText("In person")).toBeInTheDocument();
    // The Activity tab closes the story in the same figure.
    const activity = await openTab(user, "Activity");
    expect(activity.getByText("Closed. Refunded $250 from the deposit.")).toBeInTheDocument();
  }, 30_000);
});

describe("Issue permit's checklist is the engine's list", () => {
  it("on every seeded case with a quote out, the items still waiting are the ones Issue permit names", () => {
    const { cases, demoToday: today, cfg } = useDemo.getState();
    const quoted = cases.filter((c) => c.state === "quote_sent" && !c.ending);
    expect(quoted.length).toBeGreaterThan(1);
    for (const c of quoted) {
      const waiting = issuePermitChecklist(c).filter((item) => !item.done).map((item) => item.key);
      const check = checkIssuePermit(c, { today, cases, cfg });
      const named = check.ok ? [] : ["signature", "payment", "insurance"].filter((key) => check.reason.includes(key));
      expect(waiting, c.id).toEqual(named);
    }
  });
});

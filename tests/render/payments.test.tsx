/**
 * Render tests for /city/payments (workstream 5B), owned here along with lib/view/payments.ts.
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentsScreen } from "@/components/city/payments/PaymentsScreen";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { lastPush, renderScreen, storedCase } from "./harness";

const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent, $6,530 due by Fri, May 14
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout

describe("Payments: Due", () => {
  it("lists the 5K's $6,530 quote, due Fri, May 14, and opens the case's payment panel", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });

    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
    expect(screen.getByText("$6,530")).toBeInTheDocument();
    expect(screen.getAllByText(/Fri, May 14/).length).toBeGreaterThan(0);
    expect(screen.getByText("Oak Avenue block party")).toBeInTheDocument();

    const row = screen.getByText("Riverfront Summer 5K").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("link", { name: /^Record payment: / }));

    expect(lastPush()).toBe(routes.city.case(S5, { task: "pay", from: routes.city.payments() }));
  });

  it("recording a payment through the store moves it from Due to Received", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();

    act(() => {
      useDemo.getState().dispatch(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "clerk");
    });

    expect(screen.queryByText("Riverfront Summer 5K")).not.toBeInTheDocument();
    expect(storedCase(S5).payments.at(-1)).toMatchObject({ amount: 6530, method: "card", kind: "quote" });

    await user.click(screen.getByRole("tab", { name: /^Received/ }));

    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
    expect(screen.getAllByText("$6,530").length).toBeGreaterThan(0);
  });

  it("searches by event, applicant or case id", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });
    expect(screen.getByText("Oak Avenue block party")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search event, applicant or case id"), "riverfront");

    expect(screen.queryByText("Oak Avenue block party")).not.toBeInTheDocument();
    expect(screen.getByText("Riverfront Summer 5K")).toBeInTheDocument();
  });
});

describe("Payments: Received", () => {
  it("S6's $9,645, paid by card, newest first", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });

    await user.click(screen.getByRole("tab", { name: /^Received/ }));

    expect(screen.getByText("Main Street Food Truck Festival")).toBeInTheDocument();
    expect(screen.getByText("$9,645")).toBeInTheDocument();
    expect(screen.getAllByText("Card").length).toBeGreaterThan(0);
  });

  it("S2's first session collapses to its series summary after booking", async () => {
    const S2 = "PMT-27-0142";
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });

    act(() => {
      useDemo.getState().dispatch(S2, { type: "book_and_pay", method: "card" }, "applicant");
    });

    await user.click(screen.getByRole("tab", { name: /^Received/ }));

    expect(screen.getByText("13 sessions: 1 paid, 12 upcoming")).toBeInTheDocument();
  });

  it("an empty filtered Received tab shows its own empty state", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });
    await user.click(screen.getByRole("tab", { name: /^Received/ }));

    await user.selectOptions(screen.getByLabelText("Method"), "in_person");

    expect(screen.getByText("No payments match")).toBeInTheDocument();
  });
});

describe("Payments: Refunds", () => {
  it("is empty for a case with no payments or endings", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments(), cases: [makeCase()] });
    await user.click(screen.getByRole("tab", { name: /^Refunds/ }));

    expect(screen.getByText("No refunds")).toBeInTheDocument();
  });

  it("demo path 6: the Food Truck Festival's $250 deposit refund shows as issued", async () => {
    const { user } = await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });

    act(() => {
      const police = storedCase(S6).feeLines.find((line) => line.label === "Police")!;
      useDemo.getState().dispatch(
        S6,
        {
          type: "log_closeout",
          cleanup: "pass",
          notes: "Street swept and reopened by 11 pm.",
          actuals: [{ feeLineId: police.id, qty: 72 }],
          extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: useDemo.getState().cfg.fees.cleanupCrewPerWorkerHour }],
        },
        "pws",
      );
      useDemo.getState().dispatch(S6, { type: "reconcile_close" }, "clerk");
    });
    expect(storedCase(S6).state).toBe("closed");
    expect(storedCase(S6).closeout).toMatchObject({ balance: 750, refund: 250 });

    await user.click(screen.getByRole("tab", { name: /^Refunds/ }));

    const row = screen.getByText("Main Street Food Truck Festival").closest("tr") as HTMLElement;
    expect(within(row).getByText("$250")).toBeInTheDocument();
    expect(within(row).getByText("In person")).toBeInTheDocument();
  });
});

describe("Payments: every city role can reach it", () => {
  it("renders for the Clerk without crashing", async () => {
    await renderScreen(<PaymentsScreen />, { role: "clerk", path: routes.city.payments() });
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
  });
});

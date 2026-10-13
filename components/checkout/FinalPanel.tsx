"use client";

import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { FeeTable } from "@/components/domain";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { routes } from "@/lib/routes";
import { caseTotals, useDemo } from "@/lib/state";
import type { EventCase } from "@/lib/types";

/** FINAL mode: pay the final bill after closeout, estimated against actual. */
function FinalPanel({ c }: { c: EventCase }) {
  const dispatch = useDemo((s) => s.dispatch);
  const due = caseTotals(c).due;

  function handlePay() {
    return dispatch(c.id, { type: "pay", amount: due, method: "card", kind: "final_invoice" });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Final bill" title={c.name} backHref={routes.event(c.id)} backLabel="Back to your board" />
      <Section title="Estimated vs. actual" description="Public Works & Safety logged the actual costs at closeout.">
        <FeeTable lines={c.feeLines} showActual />
      </Section>
      <Section title="Pay">
        <CardPaymentForm amount={due} covers="The balance after closeout" onPay={handlePay} />
      </Section>
    </div>
  );
}

export { FinalPanel };

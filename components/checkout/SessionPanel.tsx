"use client";

import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { fmtDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";
import { planSummary, sessionAmount } from "@/lib/view/checkout";

/** SESSION mode: pay one due session of a permitted series. */
function SessionPanel({ c, occurrenceDate }: { c: EventCase; occurrenceDate: ISODate }) {
  const dispatch = useDemo((s) => s.dispatch);
  const cfg = useDemo((s) => s.cfg);
  const plan = planSummary(c);
  const amount = sessionAmount(c, cfg);

  function handlePay() {
    return dispatch(c.id, { type: "pay", amount, method: "card", kind: "session", occurrenceDate });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pay a session"
        title={c.name}
        description={`${fmtDate(occurrenceDate)} at ${plan.placeLabel}`}
        backHref={routes.event(c.id)}
        backLabel="Back to your board"
      />
      <Section title="This session">
        <PlanSummaryCard plan={plan} />
      </Section>
      <Section title="Pay">
        <CardPaymentForm amount={amount} covers={`The session on ${fmtDate(occurrenceDate)}`} onPay={handlePay} />
      </Section>
    </div>
  );
}

export { SessionPanel };

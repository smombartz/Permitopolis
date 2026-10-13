"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { fmtDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";
import { planSummary, sessionAmount } from "@/lib/view/checkout";

/** SESSION mode: pay one due session of a permitted series, then back to the board it came from. */
function SessionPanel({ c, occurrenceDate, onPaid }: { c: EventCase; occurrenceDate: ISODate; /** Keeps the paid state on screen until the board arrives. */ onPaid?: () => void }) {
  const router = useRouter();
  const dispatch = useDemo((s) => s.dispatch);
  const cfg = useDemo((s) => s.cfg);
  const plan = planSummary(c);
  const amount = sessionAmount(c, cfg);

  function handlePay() {
    const result = dispatch(c.id, { type: "pay", amount, method: "card", kind: "session", occurrenceDate });
    if (result.ok) {
      toast.success("Paid.");
      onPaid?.();
      router.push(routes.event(c.id));
    }
    return result;
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

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { FeeTable } from "@/components/domain";
import { useIsNarrow } from "@/components/shell";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { routes } from "@/lib/routes";
import { caseTotals, useDemo } from "@/lib/state";
import type { EventCase } from "@/lib/types";

/** FINAL mode: pay the final bill after closeout, estimated against actual, then back to the board. */
function FinalPanel({ c, onPaid }: { c: EventCase; /** Keeps the paid state on screen until the board arrives. */ onPaid?: () => void }) {
  const router = useRouter();
  const phone = useIsNarrow("(max-width: 639px)");
  const dispatch = useDemo((s) => s.dispatch);
  const due = caseTotals(c).due;

  function handlePay() {
    const result = dispatch(c.id, { type: "pay", amount: due, method: "card", kind: "final_invoice" });
    if (result.ok) {
      toast.success("Paid.");
      onPaid?.();
      router.push(routes.event(c.id));
    }
    return result;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Final bill" title={c.name} backHref={routes.event(c.id)} backLabel="Back to your board" />
      <Section title="Estimated vs. actual" description="Public Works & Safety logged the actual costs at closeout.">
        <FeeTable lines={c.feeLines} showActual compact={phone} />
      </Section>
      <Section title="Pay">
        <CardPaymentForm amount={due} covers="The balance after closeout" onPay={handlePay} />
      </Section>
    </div>
  );
}

export { FinalPanel };

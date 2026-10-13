"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { FeeTable } from "@/components/domain";
import { useIsNarrow } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { availableActions, useDemo } from "@/lib/state";
import type { RulesCtx } from "@/lib/rules";
import { routes } from "@/lib/routes";
import type { EventCase } from "@/lib/types";
import { bookingEstimate, dueNowOf, planSummary } from "@/lib/view/checkout";

/**
 * BOOKING mode: an Instant Draft books and pays in one step. It arrives here from the wizard's
 * last step with no board yet (the booking builds it), so the way back is the wizard.
 */
function BookingPanel({ c, ctx, onPaid }: { c: EventCase; ctx: RulesCtx; /** Keeps the paid state on screen until the permit page arrives. */ onPaid?: () => void }) {
  const router = useRouter();
  const phone = useIsNarrow("(max-width: 639px)");
  const dispatch = useDemo((s) => s.dispatch);
  const plan = planSummary(c);
  const actions = availableActions(c, "applicant", ctx);
  const bookRow = actions.find((a) => a.type === "book_and_pay");
  const blocked = !bookRow?.enabled;
  const estimate = bookingEstimate(c, ctx);
  const dueNow = dueNowOf(estimate);
  const planHref = routes.apply({ caseId: c.id, step: "plan" });

  function handlePay() {
    const result = dispatch(c.id, { type: "book_and_pay", method: "card" });
    if (result.ok) {
      toast.success("Booked and paid.");
      onPaid?.();
      router.push(routes.permit(c.id));
    }
    return result;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Book and pay"
        title={c.name}
        description="Instant events book and pay in one step."
        backHref={planHref}
        backLabel="Back to your plan"
      />
      <Section title="Your plan">
        <PlanSummaryCard plan={plan} />
      </Section>
      {blocked ? (
        <InlineAlert variant="warning">
          {bookRow?.reason ?? "This date can't be booked right now."}{" "}
          <Link href={routes.apply({ caseId: c.id, step: "when" })} className="font-semibold underline">
            Pick another date
          </Link>
        </InlineAlert>
      ) : (
        <>
          <Section title="Fees">
            <FeeTable lines={estimate.lines} compact={phone} />
          </Section>
          <Section title="Pay">
            <CardPaymentForm
              amount={dueNow}
              covers={plan.isSeries ? `The first of ${plan.sessionsCount} sessions, plus fees` : "This event's fees"}
              onPay={handlePay}
            />
          </Section>
        </>
      )}
      {blocked ? (
        <Button asChild variant="secondary" className="self-start">
          <Link href={planHref}>Back to your plan</Link>
        </Button>
      ) : null}
    </div>
  );
}

export { BookingPanel };

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { FeeTable } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { availableActions, useDemo } from "@/lib/state";
import type { RulesCtx } from "@/lib/rules";
import { routes } from "@/lib/routes";
import type { EventCase } from "@/lib/types";
import { bookingEstimate, dueNowOf, planSummary } from "@/lib/view/checkout";

/** BOOKING mode: an Instant Draft books and pays in one step. */
function BookingPanel({ c, ctx }: { c: EventCase; ctx: RulesCtx }) {
  const router = useRouter();
  const dispatch = useDemo((s) => s.dispatch);
  const plan = planSummary(c);
  const actions = availableActions(c, "applicant", ctx);
  const bookRow = actions.find((a) => a.type === "book_and_pay");
  const blocked = !bookRow?.enabled;
  const estimate = bookingEstimate(c, ctx);
  const dueNow = dueNowOf(estimate);

  function handlePay() {
    const result = dispatch(c.id, { type: "book_and_pay", method: "card" });
    if (result.ok) {
      toast.success("Booked and paid.");
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
        backHref={routes.event(c.id)}
        backLabel="Back to your board"
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
            <FeeTable lines={estimate.lines} />
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
          <Link href={routes.event(c.id)}>Back to your board</Link>
        </Button>
      ) : null}
    </div>
  );
}

export { BookingPanel };

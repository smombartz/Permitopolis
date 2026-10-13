"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { SignatureForm } from "@/components/checkout/SignatureForm";
import { CaseHeader, ConditionList, FeeTable } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { BackLink } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { applicantNameOf } from "@/lib/data/people";
import { fmtDate, fmtMoney, plural } from "@/lib/format";
import { routes } from "@/lib/routes";
import { eventDate, useDemo } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  afterQuotePaymentMessage,
  allAccepted,
  isQuotePaid,
  planSummary,
  quoteAmountOwed,
  quoteDueNow,
  seriesQuoteNote,
} from "@/lib/view/checkout";

/** QUOTE mode: accept and sign, then pay — the one place an applicant pays for a quote. */
function QuotePanel({ c, today }: { c: EventCase; today: string }) {
  const dispatch = useDemo((s) => s.dispatch);
  const cfg = useDemo((s) => s.cfg);
  const [acceptedIds, setAcceptedIds] = React.useState<string[]>(() =>
    c.conditions.filter((condition) => condition.acceptedByApplicant).map((condition) => condition.id),
  );

  const plan = planSummary(c);
  const applicantName = applicantNameOf(c);
  const paid = isQuotePaid(c, cfg);
  const owed = quoteAmountOwed(c, cfg);
  const dueNow = quoteDueNow(c, cfg);
  const amountToPay = owed > 0 ? owed : dueNow;
  const series = seriesQuoteNote(c, cfg);
  const everyAccepted = allAccepted(c.conditions, acceptedIds);

  function toggleAccept(id: string) {
    setAcceptedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function handleSign(signature: string) {
    const result = dispatch(c.id, { type: "accept_and_sign", signature });
    if (result.ok) toast.success("Signed.");
    return result;
  }

  function handlePay() {
    const result = dispatch(c.id, { type: "pay", amount: amountToPay, method: "card", kind: "quote" });
    if (result.ok) toast.success("Paid.");
    return result;
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={routes.event(c.id)}>Back to your board</BackLink>
      <CaseHeader
        name={c.name}
        tier={c.tier}
        caseId={c.id}
        applicantName={applicantName}
        eventDate={eventDate(c, today)}
        today={today}
        state={c.state}
        hold={c.dateHold}
      />
      {c.dateHold.status === "held" && c.dateHold.expiresOn ? (
        <InlineAlert variant="warning">Pay by {fmtDate(c.dateHold.expiresOn)} to keep your date.</InlineAlert>
      ) : null}

      <Section title="Your plan">
        <PlanSummaryCard plan={plan} />
      </Section>

      <Section
        title="Conditions"
        description={c.flags.signed ? undefined : "Read every condition, then check each one to accept it."}
      >
        <ConditionList conditions={c.conditions} editable={!c.flags.signed} acceptedIds={acceptedIds} onToggleAccept={toggleAccept} />
      </Section>

      <Section
        title="Fees"
        description={plan.isSeries ? "A series pays its first session now; the rest bill on schedule." : undefined}
      >
        <FeeTable lines={c.feeLines} />
        {series && series.sessionsRemaining > 0 ? (
          <InlineAlert variant="info">
            The other {plural(series.sessionsRemaining, "session")} bill at {fmtMoney(series.perSession)} each, on schedule.
          </InlineAlert>
        ) : null}
      </Section>

      <Section title="Sign">
        {c.flags.signed ? (
          <InlineAlert variant="success">Signed and dated.</InlineAlert>
        ) : (
          <SignatureForm
            disabled={!everyAccepted}
            disabledReason="Check every condition above to accept it before signing."
            onSign={handleSign}
          />
        )}
      </Section>

      <Section title="Pay">
        {paid ? (
          <div className="flex flex-col gap-3">
            <InlineAlert variant="success">{afterQuotePaymentMessage(c)}</InlineAlert>
            <Button asChild variant="secondary" className="self-start">
              <Link href={routes.event(c.id)}>Back to your board</Link>
            </Button>
          </div>
        ) : (
          <CardPaymentForm
            amount={amountToPay}
            covers={plan.isSeries ? "The first session, plus fees and deposit" : "This event's fees and deposit"}
            disabled={!c.flags.signed}
            disabledReason="Sign first."
            onPay={handlePay}
          />
        )}
      </Section>
    </div>
  );
}

export { QuotePanel };

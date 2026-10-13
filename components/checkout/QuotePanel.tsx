"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardPaymentForm } from "@/components/checkout/CardPaymentForm";
import { PlanSummaryCard } from "@/components/checkout/PlanSummaryCard";
import { SignatureForm } from "@/components/checkout/SignatureForm";
import { CaseHeader, ConditionList, FeeTable } from "@/components/domain";
import { useIsNarrow } from "@/components/shell";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { BackLink } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { applicantNameOf } from "@/lib/data/people";
import { fmtDate, fmtMoney, plural } from "@/lib/format";
import { routes } from "@/lib/routes";
import { amendmentSignOpen, caseTotals, eventDate, useDemo } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  afterQuotePaymentMessage,
  allAccepted,
  amendmentAmountOwed,
  amendmentQuoteOpen,
  isQuotePaid,
  planSummary,
  quoteAmountOwed,
  quoteDueNow,
  seriesQuoteNote,
} from "@/lib/view/checkout";

interface QuotePanelProps {
  c: EventCase;
  today: string;
  /** The quote is an approved amendment's: the case has its permit, and this settles what the change adds. */
  amendment?: boolean;
  /** Called when a signature or payment was the last thing an amendment waited for: it is in effect, and this page has nothing left. */
  onSettled?: () => void;
}

/**
 * QUOTE mode: accept and sign, then pay — the one place an applicant pays for a quote. An
 * approved amendment's quote is the same page on a case that already has its permit: the
 * signature if the amended plan needs one it never had, then the difference.
 */
function QuotePanel({ c, today, amendment = false, onSettled }: QuotePanelProps) {
  const router = useRouter();
  const dispatch = useDemo((s) => s.dispatch);
  const cfg = useDemo((s) => s.cfg);
  // Eight stepper labels need about 385px and the fee table about 430px; a phone has 295.
  const narrow = useIsNarrow();
  const phone = useIsNarrow("(max-width: 639px)");
  const [acceptedIds, setAcceptedIds] = React.useState<string[]>(() =>
    c.conditions.filter((condition) => condition.acceptedByApplicant).map((condition) => condition.id),
  );

  const plan = planSummary(c);
  const applicantName = applicantNameOf(c);
  const owed = amendment ? amendmentAmountOwed(c, cfg) : quoteAmountOwed(c, cfg);
  const paid = amendment ? owed <= 0 : isQuotePaid(c, cfg);
  const dueNow = quoteDueNow(c, cfg);
  const amountToPay = owed > 0 ? owed : dueNow;
  const series = amendment ? null : seriesQuoteNote(c, cfg);
  const everyAccepted = allAccepted(c.conditions, acceptedIds);
  // An amended plan that was signed before needs no second signature: only the new card asks for one.
  const signed = amendment ? !amendmentSignOpen(c) : c.flags.signed;
  // A change to an Instant plan that only costs more has nothing to sign and no conditions:
  // those two sections would read "Signed and dated." for a signature nobody ever gave.
  const showSigning = !amendment || amendmentSignOpen(c) || c.flags.signed;

  /** The amendment took effect with this click: the case has nothing left to sign or pay here. */
  function settledNow(): boolean {
    const now = useDemo.getState().cases.find((x) => x.id === c.id);
    return amendment && !!now && !now.flags.amendmentPending && !amendmentQuoteOpen(now);
  }

  function leaveIfSettled() {
    if (!settledNow()) return;
    onSettled?.();
    router.push(routes.event(c.id));
  }

  // Signing takes the signature form away, and paying takes the card form away, each with the
  // button that had focus. Focus moves on to what comes next in the Pay section (the card
  // number once signed, the way back once paid), not to the top of the page.
  const payRef = React.useRef<HTMLDivElement>(null);
  const before = React.useRef({ signed, paid });
  React.useEffect(() => {
    const moved = (signed && !before.current.signed) || (paid && !before.current.paid);
    before.current = { signed, paid };
    if (moved) payRef.current?.querySelector<HTMLElement>("input:not(:disabled), a[href], button:not(:disabled)")?.focus();
  }, [signed, paid]);

  function toggleAccept(id: string) {
    setAcceptedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function handleSign(signature: string) {
    const result = dispatch(c.id, { type: "accept_and_sign", signature });
    if (result.ok) {
      toast.success("Signed.");
      leaveIfSettled();
    }
    return result;
  }

  function handlePay() {
    const result = dispatch(c.id, { type: "pay", amount: amountToPay, method: "card", kind: "quote" });
    if (result.ok) {
      toast.success("Paid.");
      leaveIfSettled();
    }
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
        compactStepper={narrow}
      />
      {c.dateHold.status === "held" && c.dateHold.expiresOn ? (
        <InlineAlert variant="warning">Pay by {fmtDate(c.dateHold.expiresOn)} to keep your date.</InlineAlert>
      ) : null}
      {amendment ? (
        <Banner data-slot="amendment-quote">
          {c.flags.amendmentPending
            ? "The City Clerk approved your amendment. It takes effect once you have signed and paid what it adds; your current permit stays valid for the original plan until then."
            : "Your change is in effect. What it adds to your fees is due here."}
        </Banner>
      ) : null}

      <Section title="Your plan">
        <PlanSummaryCard plan={plan} />
      </Section>

      {showSigning ? (
        <Section
          title="Conditions"
          description={signed ? undefined : c.conditions.length > 0 ? "Read every condition, then check each one to accept it." : "This plan carries no conditions; your signature accepts the plan as amended."}
        >
          <ConditionList conditions={c.conditions} editable={!signed} acceptedIds={acceptedIds} onToggleAccept={toggleAccept} />
          {/* Signed with nothing to accept (an amendment's quote): the heading is not left with nothing under it. */}
          {signed && c.conditions.length === 0 ? <p className="text-sm text-fg-secondary">No conditions on this plan.</p> : null}
        </Section>
      ) : null}

      <Section
        title="Fees"
        description={amendment ? "The amended plan's fees. What you have paid already comes off the total." : plan.isSeries ? "A series pays its first session now; the rest bill on schedule." : undefined}
      >
        <FeeTable lines={c.feeLines} compact={phone} />
        {amendment ? (
          <InlineAlert variant="info">
            Paid so far: {fmtMoney(caseTotals(c).paid)}. {owed > 0 ? `Due for your change: ${fmtMoney(owed)}.` : "Nothing more is due."}
          </InlineAlert>
        ) : null}
        {series && series.sessionsRemaining > 0 ? (
          <InlineAlert variant="info">
            The other {plural(series.sessionsRemaining, "session")} bill at {fmtMoney(series.perSession)} each, on schedule.
          </InlineAlert>
        ) : null}
      </Section>

      {showSigning ? (
        <Section title="Sign">
          {signed ? (
            <InlineAlert variant="success">Signed and dated.</InlineAlert>
          ) : (
            <SignatureForm
              disabled={!everyAccepted}
              disabledReason="Check every condition above to accept it before signing."
              onSign={handleSign}
            />
          )}
        </Section>
      ) : null}

      <Section title="Pay">
        <div ref={payRef} className="flex flex-col gap-4">
        {paid ? (
          <div className="flex flex-col gap-3">
            <InlineAlert variant="success">{amendment ? (signed ? "Nothing more to pay." : "Nothing more to pay. Sign above to put your change into effect.") : afterQuotePaymentMessage(c)}</InlineAlert>
            <Button asChild variant="secondary" className="self-start">
              <Link href={routes.event(c.id)}>Back to your board</Link>
            </Button>
          </div>
        ) : (
          <CardPaymentForm
            amount={amountToPay}
            covers={amendment ? "What your change adds, beyond what you have paid" : plan.isSeries ? "The first session, plus fees and deposit" : "This event's fees and deposit"}
            disabled={!signed}
            disabledReason="Sign first."
            onPay={handlePay}
          />
        )}
        </div>
      </Section>
    </div>
  );
}

export { QuotePanel };

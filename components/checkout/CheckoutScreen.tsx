"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FileQuestionIcon } from "lucide-react";
import { BookingPanel } from "@/components/checkout/BookingPanel";
import { FinalPanel } from "@/components/checkout/FinalPanel";
import { QuotePanel } from "@/components/checkout/QuotePanel";
import { SessionPanel } from "@/components/checkout/SessionPanel";
import { CaseNotFound } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { RulesCtx } from "@/lib/rules";
import { checkoutDecision } from "@/lib/view/checkout";

/**
 * The one place an applicant pays (`/events/[id]/quote`), inside AppShell. The mode — BOOKING,
 * QUOTE, SESSION or FINAL — is chosen by `checkoutDecision()` from the case and the URL; every
 * other state explains where the case stands and links elsewhere instead of offering a payment
 * the engine would refuse.
 */
function CheckoutScreen() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const search = useSearchParams();
  const pay = search.get("pay");
  const date = search.get("date");

  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);

  const c = cases.find((x) => x.id === id);
  if (!c) return <CaseNotFound id={id} backHref={routes.events()} backLabel="Back to your events" />;

  const ctx: RulesCtx = { today, cases, cfg };
  const decision = checkoutDecision(c, {
    pay: pay === "session" || pay === "final" ? pay : undefined,
    date: date ?? undefined,
  });

  if (decision.mode === "not_ready") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Payment" title={c.name} backHref={routes.event(c.id)} backLabel="Back to your board" />
        <EmptyState
          icon={FileQuestionIcon}
          title="Nothing to pay here"
          text={decision.info.message}
          action={
            <Button asChild variant="secondary">
              <Link href={decision.info.href}>{decision.info.label}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (decision.mode === "booking") return <BookingPanel c={c} ctx={ctx} />;
  if (decision.mode === "quote") return <QuotePanel c={c} today={today} />;
  if (decision.mode === "session") return <SessionPanel c={c} occurrenceDate={decision.occurrenceDate} />;
  return <FinalPanel c={c} />;
}

export { CheckoutScreen };

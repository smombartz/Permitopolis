"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CircleCheckIcon, FileQuestionIcon } from "lucide-react";
import { BookingPanel } from "@/components/checkout/BookingPanel";
import { FinalPanel } from "@/components/checkout/FinalPanel";
import { QuotePanel } from "@/components/checkout/QuotePanel";
import { SessionPanel } from "@/components/checkout/SessionPanel";
import { CaseNotFound, useDocumentTitle } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { RulesCtx } from "@/lib/rules";
import type { EventCase } from "@/lib/types";
import { checkoutDecision } from "@/lib/view/checkout";

/** What was just paid on this visit. */
export type PaidKind = "booking" | "session" | "final" | "amendment";

const PAID_COPY: Record<PaidKind, { title: string; text: string }> = {
  booking: { title: "Booked and paid", text: "Your permit is issued. Opening it now." },
  session: { title: "Session paid", text: "Taking you back to your board." },
  final: { title: "Final bill paid", text: "Taking you back to your board." },
  amendment: { title: "Your change is in effect", text: "Your permit now covers the amended plan. Taking you back to your board." },
};

/**
 * What stays on screen between a payment and the page it leads to. The payment changes the case
 * at once, but the next route arrives later (seconds, on a first compile under `next dev`), and
 * in that gap the case no longer has anything to pay: without this the screen read "Nothing to
 * pay here" right after a successful payment.
 */
function PaidPanel({ c, kind }: { c: EventCase; kind: PaidKind }) {
  const copy = PAID_COPY[kind];
  const href = kind === "booking" ? routes.permit(c.id) : routes.event(c.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Payment" title={c.name} backHref={routes.event(c.id)} backLabel="Back to your board" />
      <EmptyState
        icon={CircleCheckIcon}
        title={copy.title}
        text={copy.text}
        action={
          <Button asChild variant="secondary">
            <Link href={href}>{kind === "booking" ? "View permit" : "Back to your board"}</Link>
          </Button>
        }
      />
    </div>
  );
}

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
  // The payment made on this visit (this case, this ?pay= and ?date=), kept until the page is left.
  const visit = `${id}|${pay ?? ""}|${date ?? ""}`;
  const [paid, setPaid] = React.useState<{ visit: string; kind: PaidKind } | null>(null);

  const c = cases.find((x) => x.id === id);
  useDocumentTitle(c ? `${c.name || "Untitled event"} · Pay` : null);
  if (!c) return <CaseNotFound id={id} backHref={routes.events()} backLabel="Back to My events" />;
  if (paid?.visit === visit) return <PaidPanel c={c} kind={paid.kind} />;

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

  const onPaid = (kind: PaidKind) => setPaid({ visit, kind });
  if (decision.mode === "booking") return <BookingPanel c={c} ctx={ctx} onPaid={() => onPaid("booking")} />;
  if (decision.mode === "quote") return <QuotePanel c={c} today={today} amendment={decision.amendment === true} onSettled={() => onPaid("amendment")} />;
  if (decision.mode === "session") return <SessionPanel c={c} occurrenceDate={decision.occurrenceDate} onPaid={() => onPaid("session")} />;
  return <FinalPanel c={c} onPaid={() => onPaid("final")} />;
}

export { CheckoutScreen };

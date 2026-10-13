"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { payButtonLabel } from "@/lib/view/checkout";

/** A fictional card: no real payment is ever made (PRD, "simulated forms that always succeed"). */
const TEST_CARD = { number: "4242 4242 4242 4242", name: "Maya Chen", expiry: "12/29", cvc: "123" };

interface CardPaymentFormProps {
  amount: number;
  /** What this payment covers, shown above the card fields: "This event's fees and deposit". */
  covers: string;
  disabled?: boolean;
  /** Shown instead of a card error when `disabled` (e.g. "Sign first."). */
  disabledReason?: string;
  onPay: () => { ok: boolean; reason?: string };
}

/**
 * The simulated card form every checkout mode pays through: a prefilled test card, a note that
 * nothing real is charged, a short pending state, and then always success (the dispatch itself
 * can still refuse, and its reason is shown).
 */
function CardPaymentForm({ amount, covers, disabled = false, disabledReason, onPay }: CardPaymentFormProps) {
  const [card, setCard] = React.useState(TEST_CARD);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || pending) return;
    setError(null);
    setPending(true);
    window.setTimeout(() => {
      const result = onPay();
      setPending(false);
      if (!result.ok) setError(result.reason ?? "That payment was refused.");
    }, 650);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-fg-secondary">{covers}</p>
        <p className="text-xs text-fg-label">This is a demo: no real payment is made.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Card number" className="sm:col-span-2">
          <Input
            value={card.number}
            onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
            inputMode="numeric"
            autoComplete="cc-number"
            disabled={disabled}
          />
        </Field>
        <Field label="Name on card">
          <Input
            value={card.name}
            onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
            autoComplete="cc-name"
            disabled={disabled}
          />
        </Field>
        <Field label="Expiry">
          <Input
            value={card.expiry}
            onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
            autoComplete="cc-exp"
            disabled={disabled}
          />
        </Field>
        <Field label="Security code">
          <Input
            value={card.cvc}
            onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
            autoComplete="cc-csc"
            disabled={disabled}
          />
        </Field>
      </div>
      {disabled && disabledReason ? <InlineAlert variant="info">{disabledReason}</InlineAlert> : null}
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <Button type="submit" size="lg" disabled={disabled || pending} className="self-start">
        {pending ? "Processing…" : payButtonLabel(amount)}
      </Button>
    </form>
  );
}

export { CardPaymentForm };

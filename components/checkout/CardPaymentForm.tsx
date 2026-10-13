"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { PERSONA_BY_ID } from "@/lib/data/people";
import { useDemo } from "@/lib/state";
import { payButtonLabel } from "@/lib/view/checkout";

/** A fictional card: no real payment is ever made (PRD, "simulated forms that always succeed"). */
const TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123" };

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
/** Loose shape checks, enough to catch an empty or obviously wrong field without a real card validator. */
const EXPIRY_PATTERN = /^\d{2}\s*\/\s*\d{2}$/;

function cardFieldErrors(card: { number: string; name: string; expiry: string; cvc: string }): Partial<Record<"number" | "name" | "expiry" | "cvc", string>> {
  const errors: Partial<Record<"number" | "name" | "expiry" | "cvc", string>> = {};
  const digitsOnly = card.number.replace(/\s/g, "");
  if (!digitsOnly) errors.number = "Card number is required.";
  else if (!/^\d{13,19}$/.test(digitsOnly)) errors.number = "Enter a valid card number.";
  if (!card.name.trim()) errors.name = "Name on card is required.";
  if (!card.expiry.trim()) errors.expiry = "Expiry is required.";
  else if (!EXPIRY_PATTERN.test(card.expiry.trim())) errors.expiry = "Use MM/YY.";
  if (!/^\d{3,4}$/.test(card.cvc.trim())) errors.cvc = card.cvc.trim() ? "Enter a valid security code." : "Security code is required.";
  return errors;
}

function CardPaymentForm({ amount, covers, disabled = false, disabledReason, onPay }: CardPaymentFormProps) {
  // Prefilled for whoever is paying: the persona's own contact, not one name for every organizer.
  const personaId = useDemo((s) => s.personaId);
  const [card, setCard] = React.useState(() => ({ ...TEST_CARD, name: PERSONA_BY_ID[personaId]?.contactName || "Test Cardholder" }));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Field errors show only after a submit attempt: typing into the prefilled test card should
  // not be greeted with red text before the applicant has done anything wrong.
  const [touched, setTouched] = React.useState(false);
  const fieldErrors = cardFieldErrors(card);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || pending) return;
    if (hasFieldErrors) {
      setTouched(true);
      return;
    }
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
        <Field label="Card number" className="sm:col-span-2" error={touched ? fieldErrors.number : undefined}>
          <Input
            value={card.number}
            onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
            inputMode="numeric"
            autoComplete="cc-number"
            disabled={disabled}
          />
        </Field>
        <Field label="Name on card" error={touched ? fieldErrors.name : undefined}>
          <Input
            value={card.name}
            onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
            autoComplete="cc-name"
            disabled={disabled}
          />
        </Field>
        <Field label="Expiry" error={touched ? fieldErrors.expiry : undefined}>
          <Input
            value={card.expiry}
            onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
            autoComplete="cc-exp"
            disabled={disabled}
          />
        </Field>
        <Field label="Security code" error={touched ? fieldErrors.cvc : undefined}>
          <Input
            value={card.cvc}
            onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
            autoComplete="cc-csc"
            disabled={disabled}
          />
        </Field>
      </div>
      {disabled && disabledReason ? <InlineAlert variant="info">{disabledReason}</InlineAlert> : null}
      {touched && hasFieldErrors ? <InlineAlert variant="danger">Fix the fields above to pay.</InlineAlert> : null}
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <Button type="submit" size="lg" disabled={disabled || pending} className="self-start">
        {pending ? "Processing…" : payButtonLabel(amount)}
      </Button>
    </form>
  );
}

export { CardPaymentForm };

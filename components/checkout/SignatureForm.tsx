"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignatureFormProps {
  /** True until every condition above is checked: the form still renders, but can't submit. */
  disabled?: boolean;
  disabledReason?: string;
  onSign: (signature: string) => { ok: boolean; reason?: string };
}

/** A typed full-name signature plus a consent checkbox (the quote's "accept and sign" step). */
function SignatureForm({ disabled = false, disabledReason, onSign }: SignatureFormProps) {
  const [name, setName] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canSubmit = !disabled && name.trim().length > 1 && consent;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const result = onSign(name.trim());
    setError(result.ok ? null : result.reason ?? "That couldn't be signed.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Type your full legal name to sign" hint="This typed name is your signature.">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full legal name"
          disabled={disabled}
          autoComplete="name"
        />
      </Field>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="quote-sign-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor="quote-sign-consent" className="normal-case text-sm font-normal text-fg-secondary">
          I have read and accept every condition above.
        </Label>
      </div>
      {disabled && disabledReason ? <InlineAlert variant="info">{disabledReason}</InlineAlert> : null}
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <Button type="submit" disabled={!canSubmit} className="self-start">
        Accept and sign
      </Button>
    </form>
  );
}

export { SignatureForm };

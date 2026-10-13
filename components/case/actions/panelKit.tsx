"use client"

/**
 * Shared scaffolding for every action panel: the dispatch call that shows the engine's refusal
 * reason, and the sheet-body layout (header, scrollable body, footer) every panel reuses.
 */
import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InlineAlert } from "@/components/ui/inline-alert"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useDemo } from "@/lib/state"
import type { Action } from "@/lib/state/actions"
import type { EventCase } from "@/lib/types"
import type { RulesConfig } from "@/lib/rules/types"

/** The live case plus the demo clock, config and every case (for availability checks), read fresh on every render. */
export function useCaseContext(caseId: string): { c: EventCase | undefined; today: string; cfg: RulesConfig; cases: EventCase[] } {
  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const cfg = useDemo((s) => s.cfg)
  return { c: cases.find((candidate) => candidate.id === caseId), today, cfg, cases }
}

/** How many dispatches have raised a toast: see `toastedDispatchCount()`. */
let toastedDispatches = 0

/**
 * A toast is read out by the toaster's own live region. The case screen has a status line of
 * its own for a change of state; it reads this count so that an action which changed the state
 * and raised a toast is announced once, by the toast, not twice.
 */
export function toastedDispatchCount(): number {
  return toastedDispatches
}

/**
 * Dispatches an action against a case and reports the result: a toast in plain words on
 * success (which is also what a screen reader hears), or the engine's reason, returned so the
 * panel can show it inline and never fail silently.
 */
export function useCaseDispatch(caseId: string) {
  return React.useCallback(
    (action: Action, successMessage: string): { ok: boolean; reason?: string } => {
      const result = useDemo.getState().dispatch(caseId, action);
      if (result.ok) {
        toastedDispatches += 1;
        toast.success(successMessage);
      }
      return result;
    },
    [caseId],
  )
}

interface PanelProps {
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}

/** The header every panel starts with, inside the Sheet. */
function PanelHeader({ title, description, children }: PanelProps) {
  return (
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
      {description ? <SheetDescription>{description}</SheetDescription> : null}
      {children}
    </SheetHeader>
  )
}

/** The scrollable body between the header and the footer. */
function PanelBody({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 ${className ?? ""}`}>{children}</div>
}

interface PanelActionsProps {
  error?: string | null
  onCancel: () => void
  submitLabel: React.ReactNode
  submitVariant?: "primary" | "destructive"
  disabled?: boolean
  onSubmit: () => void
}

/** The footer: the refusal reason (when there is one), Cancel, and the primary action. */
function PanelActions({ error, onCancel, submitLabel, submitVariant = "primary", disabled, onSubmit }: PanelActionsProps) {
  return (
    <SheetFooter>
      {/* Always in the DOM, so a refusal that arrives is read out once, politely. Empty, it takes back the footer's gap. */}
      <div data-slot="panel-error" aria-live="polite" className="empty:-mt-2">
        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant={submitVariant} disabled={disabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </SheetFooter>
  )
}

export { PanelHeader, PanelBody, PanelActions }

"use client"

/**
 * The right-hand Sheet every action panel opens in. `openKey` is what the URL's `?task=`
 * resolved to (`resolveOpenKey()`: an action type, or `type:arg`); the registry finds its
 * panel. A key with no panel registered leaves the sheet shut instead of opening it empty.
 *
 * Most panels are a short form and take the sheet's usual width (28rem). The ones the registry
 * calls wide (`panelWidthFor()`) get 48rem, room for two columns or a table. The width has to
 * be set on the same `sm:data-[side=right]:` rule the Sheet caps itself with: a plain
 * `sm:max-w-*` class loses to it. Below 640px a sheet is a full-width bottom sheet either way.
 */
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { parseOpenKey } from "@/lib/view/caseDetail"
import type { Party } from "@/lib/types"
import { panelFor, panelWidthFor } from "./actions/registry"

interface ActionSheetProps {
  caseId: string
  openKey: string | null
  role: Party
  onOpenChange: (open: boolean) => void
}

function ActionSheet({ caseId, openKey, role, onOpenChange }: ActionSheetProps) {
  const parsed = openKey ? parseOpenKey(openKey) : null
  const Panel = parsed ? panelFor(parsed.action, role) : undefined
  const open = Panel !== undefined
  const width = parsed ? panelWidthFor(parsed.action) : "default"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-width={width} className={width === "wide" ? "sm:data-[side=right]:max-w-3xl" : undefined}>
        {/* eslint-disable-next-line react-hooks/static-components -- Panel is looked up from the action-type registry, not defined here. */}
        {Panel && parsed ? <Panel caseId={caseId} arg={parsed.arg} role={role} onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

export { ActionSheet }

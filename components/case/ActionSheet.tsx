"use client"

/**
 * The right-hand Sheet every action panel opens in. `openKey` is the URL's `?task=` value
 * (an action type, or `type:arg`); the registry resolves it to a panel component. Unknown or
 * unregistered keys close quietly instead of showing a broken sheet.
 */
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { parseOpenKey } from "@/lib/view/caseDetail"
import type { Party } from "@/lib/types"
import { panelFor } from "./actions/registry"

interface ActionSheetProps {
  caseId: string
  openKey: string | null
  role: Party
  onOpenChange: (open: boolean) => void
}

function ActionSheet({ caseId, openKey, role, onOpenChange }: ActionSheetProps) {
  const open = openKey !== null
  const parsed = openKey ? parseOpenKey(openKey) : null
  const Panel = parsed ? panelFor(parsed.action, role) : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        {/* eslint-disable-next-line react-hooks/static-components -- Panel is looked up from the action-type registry, not defined here. */}
        {Panel && parsed ? <Panel caseId={caseId} arg={parsed.arg} role={role} onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

export { ActionSheet }

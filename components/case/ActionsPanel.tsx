"use client"

/** The sticky "Your actions" aside: every row availableActions() gives this role, in order. */
import { Button } from "@/components/ui/button"
import { StickyAside } from "@/components/ui/sticky-aside"
import { PARTY_LABEL, type Party } from "@/lib/types"
import type { ActionAvailability } from "@/lib/state/types"
import { openKeyForAction } from "@/lib/view/caseDetail"

interface ActionsPanelProps {
  role: Party
  stateLabel: string
  actions: ActionAvailability[]
  whoIsUpNote: string
  onOpen: (key: string) => void
}

function ActionsPanel({ role, stateLabel, actions, whoIsUpNote, onOpen }: ActionsPanelProps) {
  return (
    <StickyAside aria-label="Your actions" className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-fg">Your actions</p>
        <p className="text-xs text-fg-secondary">
          {PARTY_LABEL[role]} &middot; {stateLabel}
        </p>
      </div>
      {actions.length === 0 ? (
        <div className="flex flex-col gap-1.5 rounded-control border border-dashed border-line-subtle px-3.5 py-4 text-center">
          <p className="text-sm font-semibold text-fg">Nothing for you to do right now</p>
          <p className="text-xs text-fg-secondary">{whoIsUpNote}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map((action, index) => (
            <div key={`${action.type}-${index}`} className="flex flex-col gap-1">
              <Button
                type="button"
                variant={action.primary ? "primary" : "secondary"}
                className="w-full justify-center"
                disabled={!action.enabled}
                onClick={() => onOpen(openKeyForAction(action.type))}
              >
                {action.label}
              </Button>
              {!action.enabled && action.reason ? <p className="px-1 text-xs text-fg-secondary">{action.reason}</p> : null}
            </div>
          ))}
        </div>
      )}
    </StickyAside>
  )
}

export { ActionsPanel }

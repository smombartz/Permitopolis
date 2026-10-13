"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { EllipsisIcon, FilePenLineIcon, OctagonXIcon } from "lucide-react"
import { Money } from "@/components/domain/Money"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { routes } from "@/lib/routes"
import { refundIfCancelled, useDemo } from "@/lib/state"
import { canAmend } from "@/lib/view/board"
import type { EventCase } from "@/lib/types"

interface BoardMenuProps {
  c: EventCase
}

/**
 * The board's menu: change the plan, and Withdraw (before a permit) or Cancel (after). A Draft
 * changes its plan in the wizard it came from; once submitted, a change is an amendment.
 */
function BoardMenu({ c }: BoardMenuProps) {
  const today = useDemo((s) => s.demoToday)
  const cfg = useDemo((s) => s.cfg)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  if (c.ending !== null || c.state === "closed") return null

  const hasPermit = c.permit !== null
  // The figure `cancel` pays back: capped at what was paid, the deposit included.
  const refund = hasPermit ? refundIfCancelled(c, today, cfg) : null
  const amend = canAmend(c, today)

  function withdraw() {
    const result = useDemo.getState().dispatch(c.id, { type: "withdraw" })
    if (result.ok) toast.success("Application withdrawn.")
    else toast.error(result.reason ?? "That didn't go through.")
  }

  function cancel() {
    const result = useDemo.getState().dispatch(c.id, { type: "cancel" })
    if (result.ok) toast.success("Permit cancelled.")
    else toast.error(result.reason ?? "That didn't go through.")
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Board menu">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {c.state === "draft" ? (
            <DropdownMenuItem asChild>
              <Link href={routes.apply({ caseId: c.id })}>
                <FilePenLineIcon data-icon="inline-start" />
                Edit your plan
              </Link>
            </DropdownMenuItem>
          ) : amend.ok ? (
            <DropdownMenuItem asChild>
              <Link href={routes.amend(c.id)}>
                <FilePenLineIcon data-icon="inline-start" />
                Change your event
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled title={amend.reason}>
              <FilePenLineIcon data-icon="inline-start" />
              Change your event
            </DropdownMenuItem>
          )}
          {hasPermit ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
              <OctagonXIcon data-icon="inline-start" />
              Cancel
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setWithdrawOpen(true)}>
              <OctagonXIcon data-icon="inline-start" />
              Withdraw
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Withdraw this application?"
        body={c.payments.length > 0 ? "What you paid so far is refunded." : "No fees are owed; nothing has been paid yet."}
        confirmLabel="Withdraw"
        destructive
        onConfirm={withdraw}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this permit?"
        body={
          refund ? (
            <span className="flex flex-col gap-1">
              <span>
                Today&apos;s refund: <Money amount={refund.refund} /> ({refund.rule})
              </span>
              {refund.deposit > 0 && refund.refund >= refund.deposit ? (
                <span>
                  That includes your <Money amount={refund.deposit} /> deposit.
                </span>
              ) : null}
            </span>
          ) : null
        }
        confirmLabel="Cancel permit"
        destructive
        onConfirm={cancel}
      />
    </>
  )
}

export { BoardMenu }

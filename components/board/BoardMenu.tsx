"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { EllipsisIcon, FilePenLineIcon, OctagonXIcon } from "lucide-react"
import { Money } from "@/components/domain/Money"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cancellationRefund } from "@/lib/rules"
import { routes } from "@/lib/routes"
import { useDemo } from "@/lib/state"
import type { EventCase } from "@/lib/types"

interface BoardMenuProps {
  c: EventCase
}

/** Withdraw (before a permit), Cancel (after) and Amend, from the board's menu. */
function BoardMenu({ c }: BoardMenuProps) {
  const today = useDemo((s) => s.demoToday)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  if (c.ending !== null || c.state === "closed") return null

  const hasPermit = c.permit !== null
  const refund = hasPermit ? cancellationRefund(c, today) : null
  const deposit = c.feeLines.find((line) => line.kind === "deposit")

  function withdraw() {
    const result = useDemo.getState().dispatch(c.id, { type: "withdraw" })
    if (!result.ok) toast.error(result.reason ?? "That didn't go through.")
  }

  function cancel() {
    const result = useDemo.getState().dispatch(c.id, { type: "cancel" })
    if (!result.ok) toast.error(result.reason ?? "That didn't go through.")
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
          <DropdownMenuItem asChild>
            <Link href={routes.amend(c.id)}>
              <FilePenLineIcon data-icon="inline-start" />
              Amend
            </Link>
          </DropdownMenuItem>
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
              {deposit ? (
                <span>
                  Plus the <Money amount={deposit.estimate} /> deposit.
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

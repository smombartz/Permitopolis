import { Stat } from "@/components/ui/stat"
import { fmtMoney } from "@/lib/format"
import { closeoutSettlement } from "@/lib/state"
import type { EventCase } from "@/lib/types"

/**
 * How a closeout settles, in the figures reconcile_close works with: what the event ran over
 * (or came in under), how much of that the deposit covers, and what goes back or is billed.
 * The Conditions and fees tab shows it once the actual costs are in, and the Reconcile and close
 * panel shows the same figures above its button.
 */
function CloseoutSettlementStats({ c, className }: { c: EventCase; className?: string }) {
  const s = closeoutSettlement(c)
  return (
    <div data-slot="closeout-settlement" className={className ?? "grid grid-cols-2 gap-4 sm:grid-cols-3"}>
      <Stat label={s.over < 0 ? "Under estimate" : "Over estimate"} value={fmtMoney(Math.abs(s.over))} />
      <Stat label="From deposit" value={fmtMoney(s.fromDeposit)} />
      {s.bill !== null ? <Stat label="Final bill" value={fmtMoney(s.bill)} /> : <Stat label="Refund" value={fmtMoney(s.refund ?? 0)} />}
    </div>
  )
}

export { CloseoutSettlementStats }

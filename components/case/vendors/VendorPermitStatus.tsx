import { Badge } from "@/components/ui/badge"
import { VENDOR_STATUS_LABEL, type VendorPermitRow } from "@/lib/view/vendors"

const VENDOR_BADGE_VARIANT: Record<VendorPermitRow["status"], "secondary" | "default" | "warning" | "success"> = {
  not_uploaded: "secondary",
  waiting_for_you: "default",
  verified: "success",
  sent_back: "warning",
}

/**
 * A vendor's health permit, read against the "Vendors" group's own four words (not uploaded,
 * waiting for you, verified, sent back), with its valid-through date once a file is in.
 */
function VendorPermitStatusLine({ row }: { row: VendorPermitRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
      <Badge variant={VENDOR_BADGE_VARIANT[row.status]}>{VENDOR_STATUS_LABEL[row.status]}</Badge>
      {row.validThrough ? <span>Valid through {row.validThrough}</span> : null}
    </div>
  )
}

export { VendorPermitStatusLine }

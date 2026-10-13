import { Badge } from "@/components/ui/badge"
import type { Occurrence } from "@/lib/types"

type Billing = Occurrence["billing"]

const BILLING_LABEL: Record<Billing, string> = {
  paid: "Paid",
  due: "Due",
  upcoming: "Upcoming",
  skipped: "Skipped",
}

const BILLING_VARIANT: Record<Billing, "success" | "warning" | "outline" | "secondary"> = {
  paid: "success",
  due: "warning",
  upcoming: "outline",
  skipped: "secondary",
}

interface BillingBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> {
  billing: Billing
}

/**
 * Where one session of a series stands for payment: Paid, Due, Upcoming, or Skipped (a
 * blackout date, never billed). The permit's session list and the board's session schedule
 * both show it, so a session reads the same on each.
 */
function BillingBadge({ billing, ...props }: BillingBadgeProps) {
  return (
    <Badge data-slot="billing-badge" data-billing={billing} variant={BILLING_VARIANT[billing]} {...props}>
      {BILLING_LABEL[billing]}
    </Badge>
  )
}

export { BillingBadge }

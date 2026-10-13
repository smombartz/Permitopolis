import { Section } from "@/components/ui/section"
import { Progress } from "@/components/ui/progress"
import { Truncate } from "@/components/ui/truncate"
import type { EventCase, Party } from "@/lib/types"
import { vendorPermitGroup } from "@/lib/view/vendors"
import { VendorPermitStatusLine } from "@/components/case/vendors/VendorPermitStatus"
import { IssueFoodPermits } from "@/components/case/vendors/IssueFoodPermits"

/**
 * The Documents tab's "Vendors" group (workstream 5D, PRD "Vendor permits"): every food
 * vendor's health permit, by its own status word and valid-through date, with the case's
 * overall progress, and "Issue food permits" once the permit is live (a Special event). Separate from the
 * "Health & Legal" department's own accordion above (which is where a permit is actually
 * verified or sent back): this is the per-event roll-up the PRD's row describes. Renders
 * nothing for a case with no food vendors.
 */
function VendorsSection({ c, role }: { c: EventCase; role: Party }) {
  const group = vendorPermitGroup(c)
  if (!group) return null

  return (
    <Section
      title="Vendors"
      description="Every food vendor's health permit for this event."
      actions={<Progress value={group.verifiedCount} max={group.total} label={`${group.verifiedCount} of ${group.total} verified`} />}
    >
      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => (
          <li key={row.taskId} className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3">
            <Truncate text={row.vendorName} className="min-w-0 text-sm font-medium text-fg" />
            <VendorPermitStatusLine row={row} />
          </li>
        ))}
      </ul>
      <IssueFoodPermits c={c} role={role} />
    </Section>
  )
}

export { VendorsSection }

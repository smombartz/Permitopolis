import { Badge } from "@/components/ui/badge"
import type { EventCase } from "@/lib/types"

/**
 * What Public Works & Safety found at the cleanup inspection, read off the case: "Pass" or
 * "Issues found", and its notes. The closeout log shows it once logged and the Clerk's
 * Reconcile and close panel shows it above the costs, in the same words.
 */
function CleanupResult({ cleanup, notes }: { cleanup: EventCase["closeout"]["cleanup"]; notes?: string }) {
  return (
    <div data-slot="cleanup-result" className="flex flex-col gap-2">
      <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Cleanup inspection</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={cleanup === "issues" ? "warning" : "success"}>{cleanup === "issues" ? "Issues found" : "Pass"}</Badge>
        {notes ? <p className="text-sm text-fg-secondary">{notes}</p> : null}
      </div>
    </div>
  )
}

export { CleanupResult }

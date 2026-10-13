import { GavelIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * "Sent to commission" is a flag on In review, not a state (PRD): a marker here, on pipeline
 * cards and table rows, pairs with the banner `CaseDetailScreen` shows on the case itself.
 */
export function CommissionBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="commission-badge"
            tabIndex={0}
            aria-label="Sent to commission"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-surface-2 text-fg-label outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <GavelIcon className="size-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Sent to commission</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

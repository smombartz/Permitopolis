import { TriangleAlertIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STALLED_EXPLANATION = "Nobody has an open task on this case. That is a bug in the demo data or the engine.";

/**
 * A case before Permitted with nobody up is a bug (PRD "Core model"). Development builds flag
 * it in red wherever the case shows: the queue's waiting list, pipeline cards and table rows,
 * and the case's own header. Render it when `isStalled(c, today)` is true. Never shown in
 * production, and the seed carries none (tests/seed.test.ts holds that).
 */
export function StalledBadge() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="stalled-badge"
            tabIndex={0}
            className="inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border border-danger-border bg-danger-surface px-2 text-xs font-semibold text-danger-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <TriangleAlertIcon className="size-3" aria-hidden="true" />
            Stalled
          </span>
        </TooltipTrigger>
        <TooltipContent>{STALLED_EXPLANATION}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import * as React from "react"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"

/** The shell shown until useHydrated() is true, so a persisted store never flashes. */
function PageSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-skeleton"
      aria-hidden="true"
      className={cn("page-container flex flex-col gap-6 py-8", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-panel" />
        <Skeleton className="h-24 rounded-panel" />
        <Skeleton className="h-24 rounded-panel" />
      </div>
      <Skeleton className="h-64 rounded-panel" />
    </div>
  )
}

export { PageSkeleton }

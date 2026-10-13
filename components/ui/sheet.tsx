"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as SheetPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-backdrop duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Right side ≥640px (the HUD panel's resting place); below 640px it always
 * slides up from the bottom, regardless of `side`, so detail panels work as a
 * bottom sheet on applicant screens at 375px.
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-line-magnetic bg-glass-tinted bg-clip-padding text-sm text-fg shadow-hud backdrop-blur-hud transition duration-[var(--dur-soft)] ease-settle",
          // Below 640px every sheet is a bottom sheet. The side rules for left, right and top are
          // scoped to sm and up: unscoped, `data-[side=right]:w-3/4` (specificity 0,2,0, no
          // breakpoint) beat `max-sm:w-full` (0,1,0) and pinned a 75% panel to the top-left.
          "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[86vh] max-sm:w-full max-sm:rounded-t-panel max-sm:border-t",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:rounded-t-panel data-[side=bottom]:border-t",
          "sm:data-[side=left]:inset-y-0 sm:data-[side=left]:left-0 sm:data-[side=left]:h-full sm:data-[side=left]:w-3/4 sm:data-[side=left]:max-w-md sm:data-[side=left]:border-r",
          "sm:data-[side=right]:inset-y-0 sm:data-[side=right]:right-0 sm:data-[side=right]:h-full sm:data-[side=right]:w-3/4 sm:data-[side=right]:max-w-md sm:data-[side=right]:border-l",
          "sm:data-[side=top]:inset-x-0 sm:data-[side=top]:top-0 sm:data-[side=top]:h-auto sm:data-[side=top]:rounded-b-panel sm:data-[side=top]:border-b",
          "data-open:animate-in data-open:fade-in-0 max-sm:data-open:slide-in-from-bottom-10 data-[side=bottom]:data-open:slide-in-from-bottom-10 sm:data-[side=left]:data-open:slide-in-from-left-10 sm:data-[side=right]:data-open:slide-in-from-right-10 sm:data-[side=top]:data-open:slide-in-from-top-10",
          "data-closed:animate-out data-closed:fade-out-0 max-sm:data-closed:slide-out-to-bottom-10 data-[side=bottom]:data-closed:slide-out-to-bottom-10 sm:data-[side=left]:data-closed:slide-out-to-left-10 sm:data-[side=right]:data-closed:slide-out-to-right-10 sm:data-[side=top]:data-closed:slide-out-to-top-10",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 border-b border-line-subtle p-5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 border-t border-line-subtle p-5", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-lg font-bold text-fg", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-fg-secondary", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

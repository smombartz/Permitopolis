"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/** The app is light only, so the toaster never reads a theme. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-fg-accent" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin text-fg-label" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-solid)",
          "--normal-text": "var(--fg-primary)",
          "--normal-border": "var(--line-glass)",
          "--border-radius": "var(--radius-panel)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-hud! backdrop-blur-hud! font-sans!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

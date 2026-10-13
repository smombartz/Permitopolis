"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button, type buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"

interface CopyButtonProps
  extends Omit<React.ComponentProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  value: string
  label?: React.ReactNode
  copiedLabel?: React.ReactNode
}

/** Copies `value` to the clipboard and shows a brief "Copied" state. */
function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "secondary",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard access can be unavailable (older browsers, some embeds); fail quietly.
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={handleClick} {...props}>
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? copiedLabel : label}
      </Button>
      {/* The label swap is silent to a screen reader: this says it, once, while the swap lasts. */}
      <span data-slot="copy-status" role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </>
  )
}

export { CopyButton }

"use client"

import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

interface FieldControlProps {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

interface FieldProps {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactElement<FieldControlProps>
}

/**
 * Wires a label, a hint and an error to one control by id and aria-describedby,
 * so every form field in the app gets the same accessible wiring without each
 * surface reinventing it. Pass the control (Input, Select, Textarea, ...) as
 * the single child; Field assigns its id if it doesn't already have one.
 */
function Field({ label, hint, error, required, className, children }: FieldProps) {
  const generatedId = React.useId()
  const id = children.props.id ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined

  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? "true" : children.props["aria-invalid"],
  })

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { Field }

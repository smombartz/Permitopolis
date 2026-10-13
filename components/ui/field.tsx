"use client"

import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

interface FieldControlProps {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
  "aria-required"?: boolean | "true" | "false"
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
 * Wires a label, a hint and an error to one control by id and aria-describedby
 * (with aria-invalid, and aria-required when `required`), so every form field in
 * the app gets the same accessible wiring without each surface reinventing it. Pass the control (Input, Select, Textarea, ...) as
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
    // The asterisk is hidden from a screen reader; this is what says "required" there.
    "aria-required": required ? "true" : children.props["aria-required"],
  })

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      {/* The id lets a control whose own text is its value (the date button) name itself "label, value". */}
      <Label htmlFor={id} id={`${id}-label`}>
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
      {/*
        Always in the DOM, so an error that arrives is an insertion into a live region: read out
        once, politely, and again only if its words change. (It was `role="alert"`, which cut in
        on every keystroke of a field that validates as it is typed in.) Empty, it takes back the
        gap it would add.
      */}
      <div data-slot="field-error" aria-live="polite" className="empty:-mt-1.5">
        {error ? (
          <p id={errorId} className="text-xs font-medium text-danger-fg">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { Field }

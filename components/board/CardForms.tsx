"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CityServices } from "@/lib/types"
import type { FieldSpec } from "@/lib/view/cardForms"

function defaultsFor(fields: FieldSpec[], initial: Record<string, unknown> | undefined): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    const existing = initial?.[field.key]
    values[field.key] = existing ?? (field.type === "checkbox" ? false : field.type === "number" ? 0 : "")
  }
  return values
}

interface SimpleCardFormProps {
  fields: FieldSpec[]
  initial?: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => void
  submitLabel?: string
  disabled?: boolean
}

/** A handful of plain fields (text, textarea, number, checkbox, time), one small form per catalogue id. */
function SimpleCardForm({ fields, initial, onSubmit, submitLabel = "Send", disabled }: SimpleCardFormProps) {
  const [values, setValues] = React.useState(() => defaultsFor(fields, initial))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      {fields.map((field) => {
        if (field.type === "checkbox") {
          return (
            <label key={field.key} className="flex items-center gap-2.5 text-sm text-fg pointer-coarse:min-h-11">
              <Checkbox checked={Boolean(values[field.key])} onCheckedChange={(checked) => setValues((v) => ({ ...v, [field.key]: checked === true }))} />
              {field.label}
            </label>
          )
        }
        return (
          <Field key={field.key} label={field.label}>
            {field.type === "textarea" ? (
              <Textarea
                value={String(values[field.key] ?? "")}
                placeholder={field.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            ) : (
              <Input
                type={field.type === "number" ? "number" : field.type === "time" ? "time" : "text"}
                value={String(values[field.key] ?? "")}
                placeholder={field.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
              />
            )}
          </Field>
        )
      })}
      <Button type="submit" disabled={disabled} className="self-start">
        {submitLabel}
      </Button>
    </form>
  )
}

/* ---------------------------------------------------------------------- */

interface VendorRow {
  name: string
  serves: string
}

interface VendorListFormProps {
  initial?: { vendors?: VendorRow[] }
  vendorCount?: number
  onSubmit: (values: { vendors: VendorRow[] }) => void
}

/** The vendor list card: one row per food vendor, name and what it serves. */
function VendorListForm({ initial, vendorCount, onSubmit }: VendorListFormProps) {
  const startRows = initial?.vendors && initial.vendors.length > 0 ? initial.vendors : Array.from({ length: Math.max(1, vendorCount ?? 1) }, () => ({ name: "", serves: "" }))
  const [rows, setRows] = React.useState<VendorRow[]>(startRows)

  function updateRow(index: number, patch: Partial<VendorRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ vendors: rows.filter((r) => r.name.trim() !== "") })
      }}
    >
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          // A group per vendor: "Vendor name" and "Serves" are on every row, and the group says which row.
          <div key={index} role="group" aria-label={`Vendor ${index + 1}`} className="flex flex-col gap-2 rounded-control border border-line-subtle bg-surface-2 p-3 sm:flex-row sm:items-end">
            <Field label="Vendor name" className="w-full sm:flex-1">
              <Input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} placeholder="Rolling Dumpling Co." />
            </Field>
            <div className="flex items-end gap-2">
              <Field label="Serves" className="w-full sm:flex-1">
                <Input value={row.serves} onChange={(e) => updateRow(index, { serves: e.target.value })} placeholder="Dumplings and noodle bowls" />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                aria-label={`Remove vendor ${index + 1}${row.name.trim() ? `, ${row.name.trim()}` : ""}`}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setRows((r) => [...r, { name: "", serves: "" }])}>
        <PlusIcon data-icon="inline-start" />
        Add a vendor
      </Button>
      <Button type="submit" className="self-start">
        Send
      </Button>
    </form>
  )
}

/* ---------------------------------------------------------------------- */

interface CityServicesFormProps {
  defaults: CityServices | null
  onSubmit: (values: CityServices) => void
}

/** The city services request card: barricades, trash, power, and police staffing. */
function CityServicesForm({ defaults, onSubmit }: CityServicesFormProps) {
  const [values, setValues] = React.useState<CityServices>(
    defaults ?? { barricades: 0, trash: false, power: false, policeOfficers: 0, policeHours: 0 },
  )

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      <Field label="Barricades">
        <Input type="number" value={values.barricades} onChange={(e) => setValues((v) => ({ ...v, barricades: Number(e.target.value) }))} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm text-fg pointer-coarse:min-h-11">
        <Checkbox checked={values.trash} onCheckedChange={(checked) => setValues((v) => ({ ...v, trash: checked === true }))} />
        Trash collection
      </label>
      <label className="flex items-center gap-2.5 text-sm text-fg pointer-coarse:min-h-11">
        <Checkbox checked={values.power} onCheckedChange={(checked) => setValues((v) => ({ ...v, power: checked === true }))} />
        Power hookup
      </label>
      <Field label="Police officers">
        <Input type="number" value={values.policeOfficers} onChange={(e) => setValues((v) => ({ ...v, policeOfficers: Number(e.target.value) }))} />
      </Field>
      <Field label="Police hours">
        <Input type="number" value={values.policeHours} onChange={(e) => setValues((v) => ({ ...v, policeHours: Number(e.target.value) }))} />
      </Field>
      <Button type="submit" className="self-start">
        Send
      </Button>
    </form>
  )
}

export { SimpleCardForm, VendorListForm, CityServicesForm }

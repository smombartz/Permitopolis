"use client"

import * as React from "react"
import { cn } from "cn"
import { FileIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmtFileSize } from "@/lib/format"
import type { FileRef } from "@/lib/types"

interface FileDropProps {
  /** Only name, size and type are ever kept; CLAUDE.md "Uploads keep only file name, size and type". */
  onFiles: (files: FileRef[]) => void
  /** The file "Use sample file" hands back, for a demo that always has something to click. */
  sample: FileRef
  accept?: string
  multiple?: boolean
  className?: string
  label?: React.ReactNode
  hint?: React.ReactNode
}

function toFileRefs(files: FileList | null): FileRef[] {
  if (!files) return []
  return Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type }))
}

/** A drop zone with a real file input, plus a "Use sample file" button every upload has. */
function FileDrop({ onFiles, sample, accept, multiple, className, label, hint }: FileDropProps) {
  const [dragging, setDragging] = React.useState(false)
  const inputId = React.useId()

  return (
    <div
      data-slot="file-drop"
      data-dragging={dragging || undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onFiles(toFileRefs(e.dataTransfer.files))
      }}
      className={cn(
        // The file input is off screen (sr-only): while it has focus, the drop zone wears the ring.
        "flex flex-col items-center gap-3 rounded-panel border border-dashed px-6 py-8 text-center transition-colors duration-[var(--dur-fast)] ease-frost has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus-ring",
        dragging ? "border-indigo-650 bg-pill" : "border-line-subtle bg-surface-2",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-strong text-fg-label">
        <UploadIcon className="size-4.5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="cursor-pointer text-sm font-semibold text-fg">
          {label ?? "Drop a file here, or browse"}
        </label>
        {hint ? <p className="text-xs text-fg-secondary">{hint}</p> : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => onFiles(toFileRefs(e.target.files))}
      />
      <div className="flex items-center gap-2 text-xs text-fg-secondary">
        <span className="h-px w-8 bg-line-subtle" aria-hidden="true" />
        or
        <span className="h-px w-8 bg-line-subtle" aria-hidden="true" />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => onFiles([sample])}>
        <FileIcon data-icon="inline-start" />
        Use sample file
      </Button>
      <p className="font-mono text-[11px] text-fg-label">
        {sample.name} · {fmtFileSize(sample.size)}
      </p>
    </div>
  )
}

export { FileDrop }

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, DownloadIcon, LockIcon } from "lucide-react"
import { ActivityTimeline } from "@/components/domain/ActivityTimeline"
import { PartyChip } from "@/components/domain/PartyChip"
import { TaskKindLabel } from "@/components/domain/TaskKindLabel"
import { MapThumbnail } from "@/components/map"
import { CityServicesForm, SimpleCardForm, VendorListForm } from "@/components/board/CardForms"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { FileDrop } from "@/components/ui/file-drop"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Progress } from "@/components/ui/progress"
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { fmtDateShort } from "@/lib/format"
import { routes } from "@/lib/routes"
import { taskDueDate, useDemo, type Action } from "@/lib/state"
import { unlockHintFor } from "@/lib/view/board"
import { FORM_FIELDS } from "@/lib/view/cardForms"
import { PARTY_LABEL, type CityServices, type EventCase, type FileRef, type Task, type TaskHistoryEntry } from "@/lib/types"

const SAMPLE_FILE: FileRef = { name: "sample-upload.pdf", size: 240_000, type: "application/pdf" }

const DOCUMENT_HINT: Partial<Record<string, { acceptable: string; example: string }>> = {
  insurance_certificate: {
    acceptable: "A certificate of liability insurance naming the City of Permitopolis as additional insured.",
    example: "certificate-of-insurance.pdf",
  },
  vendor_health_permit: {
    acceptable: "A current health permit for this vendor, issued by the county or state.",
    example: "vendor-health-permit.pdf",
  },
  structure_specs: {
    acceptable: "Tent and stage dimensions, anchoring method and a site layout.",
    example: "tent-layout.pdf",
  },
  pyro_drone_license: {
    acceptable: "A current pyrotechnics or drone operator license.",
    example: "operator-license.pdf",
  },
  traffic_control_plan: {
    acceptable: "A map of closures, detours and barricade placement.",
    example: "traffic-control-plan.pdf",
  },
  security_medical_plan: {
    acceptable: "Security staffing and medical coverage for the event.",
    example: "security-medical-plan.pdf",
  },
  emergency_plan: {
    acceptable: "Evacuation routes and an emergency contact tree.",
    example: "emergency-plan.pdf",
  },
}

const HISTORY_STATUS_TEXT: Record<Task["status"], string> = {
  locked: "Locked",
  todo: "To do",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  done: "Accepted",
}

function historyToActivity(history: TaskHistoryEntry[]) {
  return history.map((h) => ({
    at: h.at,
    actor: h.actor,
    text: h.note ? `${HISTORY_STATUS_TEXT[h.status]}: ${h.note}` : HISTORY_STATUS_TEXT[h.status],
  }))
}

/** What the toast says once a card's action has gone through. */
const SUCCESS_TOAST: Partial<Record<Action["type"], string>> = {
  complete_task: "Sent.",
  respond_to_request: "Reply sent.",
  submit: "Application submitted.",
  submit_feedback: "Feedback sent.",
  book_again: "Next year's application started.",
}

interface BodyProps {
  c: EventCase
  task: Task
  dispatch: (action: Action) => boolean
  onClose: () => void
}

function LockedBody({ task }: { task: Task }) {
  const due = taskDueDate(task)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <LockIcon className="size-4 shrink-0 text-fg-label" aria-hidden="true" />
        {unlockHintFor(task.catalogId) ?? "This card is locked for now."}
      </div>
      {due ? <p className="text-sm text-fg">For {fmtDateShort(due)}</p> : null}
    </div>
  )
}

function DocumentBody({ task, dispatch, onClose }: BodyProps) {
  const [files, setFiles] = React.useState<FileRef[]>(task.payload.files ?? [])
  const hint = DOCUMENT_HINT[task.catalogId]
  const canResubmit = task.status === "todo" || task.status === "changes_requested" || task.status === "done"

  return (
    <div className="flex flex-col gap-4">
      {hint ? (
        <div className="flex flex-col gap-1 text-sm text-fg-secondary">
          <p>{hint.acceptable}</p>
          <p className="text-xs text-fg-label">Example: {hint.example}</p>
        </div>
      ) : null}
      {task.payload.rejectedReason ? (
        <InlineAlert variant="warning">Sent back: {task.payload.rejectedReason}</InlineAlert>
      ) : null}
      {canResubmit ? (
        <FileDrop sample={SAMPLE_FILE} onFiles={(f) => setFiles(f)} hint="PDF, up to 10MB" />
      ) : null}
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-fg">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckIcon className="size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
              {f.name}
            </li>
          ))}
        </ul>
      ) : null}
      {canResubmit ? (
        <Button
          type="button"
          disabled={files.length === 0}
          onClick={() => {
            const ok = dispatch({ type: "complete_task", taskId: task.id, files })
            if (ok) onClose()
          }}
          className="self-start"
        >
          Send
        </Button>
      ) : null}
      <ActivityTimeline items={historyToActivity(task.history)} collapsedCount={5} />
    </div>
  )
}

function FormBody({ c, task, dispatch, onClose }: BodyProps) {
  function submitForm(form: Record<string, unknown>) {
    const ok = dispatch({ type: "complete_task", taskId: task.id, form })
    if (ok) onClose()
  }

  if (task.catalogId === "vendor_list") {
    return (
      <VendorListForm
        initial={task.payload.form as { vendors?: { name: string; serves: string }[] } | undefined}
        vendorCount={c.addOns.foodVending?.vendors}
        onSubmit={submitForm}
      />
    )
  }
  if (task.catalogId === "city_services_request") {
    return (
      <CityServicesForm
        defaults={(task.payload.form as CityServices | undefined) ?? c.addOns.cityServices}
        onSubmit={(values) => submitForm(values as unknown as Record<string, unknown>)}
      />
    )
  }

  const fields = FORM_FIELDS[task.catalogId as keyof typeof FORM_FIELDS]
  return (
    <div className="flex flex-col gap-4">
      {task.catalogId === "site_plan" && c.location ? (
        <MapThumbnail highlight={{ id: c.id, location: c.location, status: "pending", tier: c.tier, label: c.location.label }} />
      ) : null}
      {fields ? (
        <SimpleCardForm fields={fields} initial={task.payload.form as Record<string, unknown> | undefined} onSubmit={submitForm} />
      ) : (
        <InlineAlert variant="info">This card has no extra fields; send it to mark it done.</InlineAlert>
      )}
    </div>
  )
}

function CityRequestBody({ task, dispatch, onClose }: BodyProps) {
  const [files, setFiles] = React.useState<FileRef[]>([])
  const [message, setMessage] = React.useState("")
  if (!task.request) return null
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert variant="warning">
        <span className="font-semibold text-fg">{PARTY_LABEL[task.request.from]} asks:</span> {task.request.message}
      </InlineAlert>
      <FileDrop sample={SAMPLE_FILE} onFiles={setFiles} hint="PDF, up to 10MB" />
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-fg">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckIcon className="size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
              {f.name}
            </li>
          ))}
        </ul>
      ) : null}
      <Textarea placeholder="A note back (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button
        type="button"
        disabled={files.length === 0}
        onClick={() => {
          const ok = dispatch({ type: "respond_to_request", taskId: task.id, files, message: message || undefined })
          if (ok) onClose()
        }}
        className="self-start"
      >
        Reply and attach
      </Button>
      <ActivityTimeline items={historyToActivity(task.history)} collapsedCount={5} />
    </div>
  )
}

function SignoffBody({ c, task, dispatch }: BodyProps) {
  const progress = task.payload.progress as { done: number; total: number } | undefined
  const done = progress?.done ?? 0
  const total = progress?.total ?? 0
  const link = `${routes.event(c.id)}?signoff=${task.id}`
  return (
    <div className="flex flex-col gap-4">
      <Progress value={done} max={total} label={`${done} of ${total} neighbors`} />
      <CopyButton value={link} label="Copy the neighbor sign-off link" copiedLabel="Link copied" />
      {done < total ? (
        <Button type="button" variant="secondary" onClick={() => dispatch({ type: "simulate_signoff" })}>
          Simulate a sign-off
          <span className="text-fg-label">(demo only)</span>
        </Button>
      ) : (
        <InlineAlert variant="success">All neighbors have signed off.</InlineAlert>
      )}
    </div>
  )
}

function CommunityNotificationBody({ task, dispatch, onClose }: BodyProps) {
  const [files, setFiles] = React.useState<FileRef[]>([])
  const canSend = task.status === "todo" || task.status === "changes_requested"
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">Post a notice where neighbors and nearby businesses will see it, then upload a photo of it posted.</p>
      {canSend ? <FileDrop sample={{ name: "posted-notice.jpg", size: 180_000, type: "image/jpeg" }} onFiles={setFiles} hint="A photo of the posted notice" /> : null}
      {canSend ? (
        <Button
          type="button"
          disabled={files.length === 0}
          onClick={() => {
            const ok = dispatch({ type: "complete_task", taskId: task.id, files })
            if (ok) onClose()
          }}
          className="self-start"
        >
          Upload a photo of the posted notice
        </Button>
      ) : (
        <InlineAlert variant="success">Posted.</InlineAlert>
      )}
    </div>
  )
}

function DownloadActionBody({ task, dispatch, onClose }: BodyProps) {
  const done = task.status === "done"
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">Each vendor displays its own temporary food permit at the event.</p>
      <Button
        type="button"
        disabled={done}
        onClick={() => {
          const ok = dispatch({ type: "complete_task", taskId: task.id })
          if (ok) onClose()
        }}
        className="self-start"
      >
        <DownloadIcon data-icon="inline-start" />
        {done ? "Downloaded" : "Download per-vendor food permits"}
      </Button>
    </div>
  )
}

function MeetingBody({ task }: BodyProps) {
  const scheduledFor = task.payload.scheduledFor as string | undefined
  return (
    <p className="text-sm text-fg">
      {scheduledFor ? `Scheduled for ${fmtDateShort(scheduledFor)}.` : "The City Clerk will schedule this."}
    </p>
  )
}

function SubmitApplicationBody({ c, task, onClose }: BodyProps) {
  const ready = task.status === "todo"
  const [error, setError] = React.useState<string | null>(null)
  const preSubmit = c.tasks.filter((t) => t.owner === "applicant" && t.catalogId !== "submit_application" && (t.status === "submitted" || t.status === "done"))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">This sends your application to the City Clerk for intake.</p>
      <ul className="flex flex-col gap-1.5 text-sm text-fg">
        {preSubmit.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <CheckIcon className="size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
            {t.title}
          </li>
        ))}
      </ul>
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <Button
        type="button"
        disabled={!ready}
        onClick={() => {
          const result = useDemo.getState().dispatch(c.id, { type: "submit" })
          if (!result.ok) {
            setError(result.reason ?? "That didn't go through.")
            return
          }
          toast.success(SUCCESS_TOAST.submit)
          onClose()
        }}
        className="self-start"
      >
        Submit application
      </Button>
    </div>
  )
}

function FeedbackBody({ task, dispatch, onClose }: BodyProps) {
  const [rating, setRating] = React.useState(5)
  const [comment, setComment] = React.useState("")
  const done = task.status === "done"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onClick={() => setRating(n)}
            disabled={done}
            className="rounded-control p-1 text-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-60"
          >
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <Textarea placeholder="Anything else?" value={comment} onChange={(e) => setComment(e.target.value)} disabled={done} />
      {done ? (
        <InlineAlert variant="success">Thank you for the feedback.</InlineAlert>
      ) : (
        <Button
          type="button"
          onClick={() => {
            if (dispatch({ type: "submit_feedback", rating, comment: comment || undefined })) onClose()
          }}
          className="self-start"
        >
          Send feedback
        </Button>
      )}
    </div>
  )
}

function BookAgainBody({ c, task, onClose }: BodyProps) {
  const router = useRouter()
  const done = task.status === "done"
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">Starts next year&apos;s application from this one, with the same plan.</p>
      <Button
        type="button"
        disabled={done}
        onClick={() => {
          const result = useDemo.getState().dispatch(c.id, { type: "book_again" })
          if (!result.ok) {
            toast.error(result.reason ?? "That didn't go through.")
            return
          }
          toast.success(SUCCESS_TOAST.book_again)
          onClose()
          const spawnedId = result.spawnedIds?.[0]
          if (spawnedId) router.push(routes.apply({ caseId: spawnedId }))
        }}
        className="self-start"
      >
        Book again next year
      </Button>
    </div>
  )
}

interface CardSheetContentProps {
  c: EventCase
  task: Task
  onClose: () => void
}

/**
 * The card detail sheet's content (PRD "Card detail sheet"). What it shows depends on the
 * card's state first (locked, then a reviewer's open request), then its catalogue id and kind.
 */
function CardSheetContent({ c, task, onClose }: CardSheetContentProps) {
  const pinned = Boolean(task.request) && task.request?.resolved === false

  // Says what happened, as the checkout and the city's panels do. A simulated sign-off only
  // moves the progress bar in front of the applicant, so it has no toast.
  function dispatch(action: Action): boolean {
    const result = useDemo.getState().dispatch(c.id, action)
    if (!result.ok) {
      toast.error(result.reason ?? "That didn't go through.")
      return false
    }
    const done = SUCCESS_TOAST[action.type]
    if (done) toast.success(done)
    return true
  }

  const props: BodyProps = { c, task, dispatch, onClose }

  let body: React.ReactNode
  if (task.status === "locked") {
    body = <LockedBody task={task} />
  } else if (pinned) {
    body = <CityRequestBody {...props} />
  } else if (task.catalogId === "submit_application") {
    body = <SubmitApplicationBody {...props} />
  } else if (task.catalogId === "feedback") {
    body = <FeedbackBody {...props} />
  } else if (task.catalogId === "book_again") {
    body = <BookAgainBody {...props} />
  } else if (task.catalogId === "neighbor_signoff") {
    body = <SignoffBody {...props} />
  } else if (task.catalogId === "community_notification") {
    body = <CommunityNotificationBody {...props} />
  } else if (task.catalogId === "vendor_food_permits") {
    body = <DownloadActionBody {...props} />
  } else if (task.kind === "meeting") {
    body = <MeetingBody {...props} />
  } else if (task.kind === "document") {
    body = <DocumentBody {...props} />
  } else if (task.kind === "form") {
    body = <FormBody {...props} />
  } else {
    body = <p className="text-sm text-fg-secondary">{task.why}</p>
  }

  return (
    <SheetContent>
      <SheetHeader>
        <TaskKindLabel kind={task.kind} />
        <SheetTitle>{task.title}</SheetTitle>
        {!pinned ? <SheetDescription>{task.why}</SheetDescription> : null}
        {task.reviewer ? <PartyChip party={task.reviewer} className="w-fit" /> : null}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{body}</div>
    </SheetContent>
  )
}

export { CardSheetContent, SAMPLE_FILE }

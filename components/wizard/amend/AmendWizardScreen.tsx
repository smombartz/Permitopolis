"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { BanIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { WizardStepper } from "@/components/ui/wizard-stepper"
import { StickyAside } from "@/components/ui/sticky-aside"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { CaseNotFound, useDocumentTitle, useIsNarrow } from "@/components/shell"
import { useDemo } from "@/lib/state"
import { routes } from "@/lib/routes"
import type { EventAnswers, WizardStep } from "@/lib/types"
import {
  WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  nextWizardStep,
  previousWizardStep,
  removeAddOnForTrigger,
  resolveWizardStep,
  scheduleOnDate,
  wizardStepIndex,
  dateGateAnnouncement,
} from "@/lib/view/wizard"
import { amendAnswersOf, amendmentGateSatisfied, buildAmendmentDiff } from "@/lib/view/amend"
import { canAmend } from "@/lib/view/board"
import { StepWhat } from "@/components/wizard/StepWhat"
import { StepWhere } from "@/components/wizard/StepWhere"
import { StepWhen } from "@/components/wizard/StepWhen"
import { StepSize } from "@/components/wizard/StepSize"
import { WizardAnnouncer } from "@/components/wizard/WizardAnnouncer"
import { AmendResultPanel } from "./AmendResultPanel"
import { AmendReviewStep } from "./AmendReviewStep"

/**
 * The amendment wizard (`/events/[id]/amend`, PRD "Amend", P1). Reopens the wizard on the same
 * record, filled in, in its own mode with its own header. Everything is a local copy of the
 * answers; nothing is dispatched until the applicant confirms on the last step
 * (brief 5A, step 1). Rendered inside `AppShell`.
 */
function AmendWizardScreen() {
  const params = useParams<{ id: string }>()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""
  const router = useRouter()
  const searchParams = useSearchParams()

  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const cfg = useDemo((s) => s.cfg)
  const dispatch = useDemo((s) => s.dispatch)
  const narrow = useIsNarrow("(max-width: 1023px)")

  const c = cases.find((candidate) => candidate.id === id)
  useDocumentTitle(c ? `${c.name || "Untitled event"} · Change your event` : null)

  // Work on a local copy of the answers, seeded from the record once on mount: nothing is
  // dispatched until the applicant confirms on the last step (brief 5A, step 1).
  const [answers, setAnswers] = React.useState<EventAnswers | null>(() => (c ? amendAnswersOf(c) : null))
  const [lateFee, setLateFee] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  if (!c) return <CaseNotFound id={id} backHref={routes.events()} backLabel="Back to My events" />

  const eligibility = canAmend(c, today)
  if (!eligibility.ok) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Change your event" title={c.name || "Untitled event"} backHref={routes.event(c.id)} backLabel="Back to your board" />
        <EmptyState icon={BanIcon} title="This event cannot be amended" text={eligibility.reason} />
      </div>
    )
  }

  if (!answers) return null;

  // Narrowed once, for the closures below: TS does not carry the guards above into a nested
  // function declaration's body.
  const kase = c
  const currentAnswers = answers

  const stepParam = searchParams.get("step")
  const step: WizardStep = resolveWizardStep(stepParam, "what")
  const ctx = { today, cases, cfg }
  const diff = buildAmendmentDiff(kase, currentAnswers, ctx, { lateFee })
  const leadTimeDays = cfg.leadTimeDays[diff.tierAfter]

  function patch(update: Partial<EventAnswers>): void {
    setAnswers((prev) => (prev ? { ...prev, ...update } : prev))
  }

  function goToStep(nextStep: WizardStep): void {
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("step", nextStep)
    router.replace(`${routes.amend(kase.id)}?${qs.toString()}`)
  }

  function moveToDate(date: string): void {
    patch({ schedule: scheduleOnDate(currentAnswers.schedule, date, currentAnswers.eventType) })
  }

  function applyWhatIf(triggerId: Parameters<typeof removeAddOnForTrigger>[1]): void {
    patch({ addOns: removeAddOnForTrigger(currentAnswers.addOns, triggerId) })
  }

  function confirm(): void {
    setError(null)
    const result = dispatch(kase.id, { type: "amend", answers: currentAnswers, lateFee })
    if (!result.ok) {
      setError(result.reason ?? "That didn't go through.")
      return
    }
    router.push(routes.event(kase.id))
  }

  const ready = amendmentGateSatisfied(diff, lateFee)
  const previous = previousWizardStep(step)
  const next = nextWizardStep(step)

  let stepContent: React.ReactNode
  switch (step) {
    case "what":
      stepContent = <StepWhat answers={answers} onChange={patch} />
      break
    case "where":
      stepContent = <StepWhere answers={answers} onChange={patch} ctx={ctx} ignoreCaseId={c.id} />
      break
    case "when":
      stepContent = (
        <StepWhen
          answers={answers}
          onChange={patch}
          onLateFee={setLateFee}
          lateFee={lateFee}
          panel={{
            tier: diff.tierAfter,
            summary: diff.summary,
            triggers: [],
            whatIf: [],
            leadTimeDays,
            dateGate: diff.gate,
            components: [],
            reviewers: [],
            fees: { lines: [], fees: 0, deposit: 0, total: diff.feeAfter },
            capacityWarning: null,
          }}
          today={today}
        />
      )
      break
    case "size":
      stepContent = <StepSize answers={answers} onChange={patch} cfg={cfg} />
      break
    case "plan":
      stepContent = (
        <AmendReviewStep
          diff={diff}
          leadTimeDays={leadTimeDays}
          gateBanner={{ lateFee, onNewDate: moveToDate, onDropAddOn: applyWhatIf, onLateFee: setLateFee }}
          ready={ready}
          error={error}
          onConfirm={confirm}
        />
      )
      break
  }

  return (
    <div className={narrow ? "flex flex-col gap-6 pb-20" : "flex flex-col gap-6"}>
      {/* The tier the change makes, and the date gate, read out as the ordinary wizard reads them. */}
      <WizardAnnouncer tier={diff.tierAfter} summary={diff.summary} gateMessage={dateGateAnnouncement(diff.gate, leadTimeDays, lateFee)} />
      <PageHeader eyebrow="Change your event" title={c.name || "Untitled event"} backHref={routes.event(c.id)} backLabel="Back to your board" />

      <WizardStepper
        steps={WIZARD_STEPS.map((s) => ({ label: WIZARD_STEP_LABEL[s] }))}
        current={wizardStepIndex(step)}
        reached={WIZARD_STEPS.length - 1}
        onStepSelect={(index) => goToStep(WIZARD_STEPS[index])}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {stepContent}
          {step !== "plan" ? (
            <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <Button type="button" variant="secondary" disabled={!previous} onClick={() => previous && goToStep(previous)}>
                Back
              </Button>
              {next ? (
                <Button type="button" onClick={() => goToStep(next)}>
                  Next
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <Button type="button" variant="secondary" disabled={!previous} onClick={() => previous && goToStep(previous)}>
                Back
              </Button>
            </div>
          )}
        </div>

        {!narrow ? (
          <StickyAside>
            <AmendResultPanel diff={diff} />
          </StickyAside>
        ) : null}
      </div>

      {narrow ? (
        <>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line-magnetic bg-glass-tinted px-4 py-3 text-left shadow-hud backdrop-blur-hud outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span className="min-w-0 truncate text-sm text-fg-secondary">{diff.summary}</span>
            <span className="shrink-0 text-xs font-semibold text-fg-accent">Details</span>
          </button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[86vh]">
              <SheetHeader>
                <SheetTitle>Your change</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <AmendResultPanel diff={diff} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  )
}

export { AmendWizardScreen }

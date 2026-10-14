"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { WizardStepper } from "@/components/ui/wizard-stepper";
import { StickyAside } from "@/components/ui/sticky-aside";
import { useSettle } from "@/components/ui/use-settle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CaseNotFound, useDocumentTitle, useIsNarrow } from "@/components/shell";
import { useDemo } from "@/lib/state";
import { classify, requirements } from "@/lib/rules";
import { routes } from "@/lib/routes";
import { PERSONA_BY_ID } from "@/lib/data/people";
import { TierBadge } from "@/components/domain";
import { cn } from "@/lib/utils";
import { EMPTY_ADDONS, type EventAnswers, type ISODate, type TriggerId, type WizardStep } from "@/lib/types";
import {
  WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  buildResultPanel,
  dateGateAnnouncement,
  furthestAnsweredStep,
  nextWizardStep,
  previousWizardStep,
  removeAddOnForTrigger,
  resolveWizardStep,
  scheduleOnDate,
  wizardStepIndex,
} from "@/lib/view/wizard";
import { ResultPanel } from "./ResultPanel";
import { WizardAnnouncer } from "./WizardAnnouncer";
import { StepWhat } from "./StepWhat";
import { StepWhere } from "./StepWhere";
import { StepWhen } from "./StepWhen";
import { StepSize } from "./StepSize";
import { StepPlan } from "./StepPlan";

function blankAnswers(): EventAnswers {
  return { eventType: null, name: "", location: null, schedule: null, attendance: null, addOns: EMPTY_ADDONS };
}

/**
 * The applicant wizard, `/apply?case=<id>&step=what|where|when|size|plan`. Rendered inside
 * `AppShell`, which already gates the role and the hydration skeleton, so this starts straight
 * with its `PageHeader` the way every shell screen does.
 */
function WizardScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseIdParam = searchParams.get("case");
  const stepParam = searchParams.get("step");

  const cases = useDemo((s) => s.cases);
  const demoToday = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);
  const personaId = useDemo((s) => s.personaId);
  const dispatch = useDemo((s) => s.dispatch);
  const createDraft = useDemo((s) => s.createDraft);
  const updateDraft = useDemo((s) => s.updateDraft);
  const narrow = useIsNarrow("(max-width: 1023px)");
  const phone = useIsNarrow("(max-width: 639px)");

  const [pendingAnswers, setPendingAnswers] = React.useState<EventAnswers>(blankAnswers);
  const [accountCreated, setAccountCreated] = React.useState(false);
  const [primaryError, setPrimaryError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const savedTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // The draft this visit created, kept until the URL carries its id. createDraft() is immediate
  // but router.replace() is a transition, so for a moment the URL still says "no case": without
  // this, every change made in that moment would start another draft ("J", "Ja", ...). The ref
  // is for the handlers (two changes inside one event), the state for what is drawn.
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const createdRef = React.useRef<string | null>(null);
  // The URL has caught up and is the only source again: a later visit to a blank /apply starts fresh.
  if (caseIdParam && createdId) setCreatedId(null);
  React.useEffect(() => {
    if (caseIdParam) createdRef.current = null;
  }, [caseIdParam]);

  const draftId = caseIdParam ?? createdId;
  const draft = React.useMemo(() => (draftId ? cases.find((c) => c.id === draftId) : undefined), [cases, draftId]);
  const unknownCase = Boolean(caseIdParam) && !draft;
  const notADraft = Boolean(draft) && draft!.state !== "draft";
  // The URL's step wins, with or without a draft: Next and the stepper only rewrite the URL, so
  // a blank wizard has to follow it too. Failing that, a draft opens at its saved step and a
  // blank wizard at step 1 (What are you planning?).
  const step: WizardStep = resolveWizardStep(stepParam, draft?.wizardStep ?? "what");

  const answers: EventAnswers = draft ?? pendingAnswers;
  useDocumentTitle(answers.name ? `${answers.name} · Plan an event` : null);
  // The furthest step shown on this visit, for the draft it was shown for (a blank wizard keeps
  // its count when its first entry starts the draft; another draft starts over). With the step
  // the answers themselves reach, it is how far the stepper's edit links go: a presenter who
  // goes back from Size to Where still has When and Size one click away.
  const stepIndex = wizardStepIndex(step);
  const seenFor = draftId ?? null;
  const [seen, setSeen] = React.useState<{ draftId: string | null; index: number }>({ draftId: seenFor, index: stepIndex });
  const seenIndex = seen.draftId === seenFor || seen.draftId === null ? seen.index : 0;
  if (seen.draftId !== seenFor || stepIndex > seen.index) setSeen({ draftId: seenFor, index: Math.max(stepIndex, seenIndex) });
  const reached = Math.max(stepIndex, seenIndex, furthestAnsweredStep(answers));
  const ctx = { today: demoToday, cases, cfg };
  const panel = buildResultPanel(answers, ctx, { lateFee: draft?.flags.lateFee, ignoreCaseId: draft?.id });

  // A tier change is announced and ringed from here, not from ResultPanel: below 1024px the
  // panel is only mounted while its sheet is open, and the change is usually caused by a field
  // on the step itself.
  const previousTier = React.useRef(panel.tier);
  const [tierHighlight, setTierHighlight] = React.useState(false);
  React.useEffect(() => {
    if (previousTier.current !== panel.tier) {
      previousTier.current = panel.tier;
      setTierHighlight(true);
      const timeout = setTimeout(() => setTierHighlight(false), 900);
      return () => clearTimeout(timeout);
    }
  }, [panel.tier]);

  // Next, Back and the stepper swap the step in place; the new step settles in so the change reads.
  const stepRef = useSettle<HTMLDivElement>(step);

  // A case that is no longer a Draft (S2's jump after it has been booked, say) belongs on its
  // board, not in the wizard.
  React.useEffect(() => {
    if (notADraft) router.replace(routes.event(draft!.id));
  }, [notADraft, draft, router]);

  // Keep the step in the URL once a draft exists, the way every other filter/tab state does.
  // Skipped for a case that is being redirected away (the effect above owns that navigation).
  React.useEffect(() => {
    if (draft && !notADraft && stepParam !== step) router.replace(routes.apply({ caseId: draft.id, step }));
  }, [draft, notADraft, step, stepParam, router]);

  React.useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  if (unknownCase) {
    return <CaseNotFound id={caseIdParam!} backHref={routes.events()} backLabel="Back to My events" />;
  }
  if (notADraft) return null;

  const persona = PERSONA_BY_ID[personaId];
  const tasks = draft ? requirements(draft, classify(draft, cfg), { caseId: draft.id, today: demoToday, cfg }) : [];

  function flashSaved(): void {
    setSaved(true);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setSaved(false), 1600);
  }

  /** Every field change autosaves. The Draft is created on the applicant's first entry. */
  function ensureDraft(patch: Partial<EventAnswers>): void {
    const existingId = draft?.id ?? createdRef.current;
    if (existingId) {
      updateDraft(existingId, patch);
    } else {
      const merged = { ...pendingAnswers, ...patch };
      setPendingAnswers(merged);
      const id = createDraft(personaId, merged);
      createdRef.current = id;
      setCreatedId(id);
      router.replace(routes.apply({ caseId: id, step }));
    }
    flashSaved();
  }

  function goToStep(nextStep: WizardStep): void {
    if (draft) updateDraft(draft.id, { wizardStep: nextStep });
    router.replace(draft ? routes.apply({ caseId: draft.id, step: nextStep }) : routes.apply({ step: nextStep }));
  }

  function applyWhatIf(triggerId: TriggerId): void {
    ensureDraft({ addOns: removeAddOnForTrigger(answers.addOns, triggerId) });
  }

  /** The date gate's "Use <date>" fix, from step 5 (step 3 moves the date itself). */
  function moveToDate(date: ISODate): void {
    ensureDraft({ schedule: scheduleOnDate(answers.schedule, date, answers.eventType) });
  }

  function setLateFee(on: boolean): void {
    if (!draft) return;
    updateDraft(draft.id, { lateFee: on });
    flashSaved();
  }

  function handlePrimaryAction(): void {
    if (!draft) return;
    setPrimaryError(null);
    if (panel.tier === "instant") {
      router.push(routes.quote(draft.id));
      return;
    }
    const result = dispatch(draft.id, { type: "create_board" });
    if (!result.ok) {
      setPrimaryError(result.reason ?? "That didn't go through.");
      return;
    }
    router.push(routes.event(draft.id));
  }

  const previous = previousWizardStep(step);
  const next = nextWizardStep(step);

  let stepContent: React.ReactNode;
  switch (step) {
    case "what":
      stepContent = <StepWhat answers={answers} onChange={ensureDraft} />;
      break;
    case "where":
      stepContent = <StepWhere answers={answers} onChange={ensureDraft} ctx={ctx} ignoreCaseId={draft?.id} />;
      break;
    case "when":
      stepContent = (
        <StepWhen answers={answers} onChange={ensureDraft} onLateFee={setLateFee} lateFee={draft?.flags.lateFee ?? false} panel={panel} today={demoToday} />
      );
      break;
    case "size":
      stepContent = <StepSize answers={answers} onChange={ensureDraft} cfg={cfg} />;
      break;
    case "plan":
      stepContent = (
        <StepPlan
          answers={answers}
          panel={panel}
          cfg={cfg}
          today={demoToday}
          lateFee={draft?.flags.lateFee ?? false}
          tasks={tasks}
          hasBoard={(draft?.tasks.length ?? 0) > 0}
          personaName={persona?.name ?? "you"}
          onStepLink={goToStep}
          onNewDate={moveToDate}
          onDropAddOn={applyWhatIf}
          onLateFee={setLateFee}
          compactFees={phone}
          onPrimaryAction={handlePrimaryAction}
          primaryError={primaryError}
          accountCreated={accountCreated}
          onCreateAccount={() => setAccountCreated(true)}
        />
      );
      break;
  }

  return (
    <div className={narrow ? "flex flex-col gap-6 pb-20" : "flex flex-col gap-6"}>
      <WizardAnnouncer tier={panel.tier} summary={panel.summary} gateMessage={dateGateAnnouncement(panel.dateGate, panel.leadTimeDays, draft?.flags.lateFee ?? false)} />
      <PageHeader
        eyebrow="Apply for a permit"
        title={answers.name || "New event"}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(routes.events())}>
            Save and finish later
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <WizardStepper
          steps={WIZARD_STEPS.map((s) => ({ label: WIZARD_STEP_LABEL[s] }))}
          current={stepIndex}
          reached={reached}
          onStepSelect={(index) => goToStep(WIZARD_STEPS[index])}
          className="flex-1"
        />
        <span className="shrink-0 text-xs text-fg-secondary" aria-live="polite">
          {saved ? "Saved" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div ref={stepRef}>{stepContent}</div>
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
        </div>

        {!narrow ? (
          <StickyAside aria-label="Your plan so far">
            <ResultPanel panel={panel} onApplyWhatIf={applyWhatIf} highlight={tierHighlight} />
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
            <span className="flex min-w-0 items-center gap-2">
              <span
                data-slot="wizard-bar-tier"
                data-highlight={tierHighlight ? "true" : undefined}
                className={cn("inline-flex shrink-0 rounded-full transition-shadow duration-[var(--dur-soft)] ease-frost", tierHighlight && "shadow-[0_0_0_4px_var(--pill)]")}
              >
                <TierBadge tier={panel.tier} />
              </span>
              <span className="min-w-0 truncate text-sm text-fg-secondary">{panel.summary}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-fg-accent">Details</span>
          </button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[86vh]">
              <SheetHeader>
                <SheetTitle>Your plan</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <ResultPanel panel={panel} onApplyWhatIf={applyWhatIf} highlight={tierHighlight} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

export { WizardScreen };

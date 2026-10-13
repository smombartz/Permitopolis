"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemo } from "@/lib/state";
import { DEMO_PATHS, type DemoPath, type DemoStep } from "@/lib/data/demoScript";
import { activeDemoPathOf, pathProgress } from "@/lib/view/coach";
import { PARTY_LABEL } from "@/lib/types";

/**
 * The demo coach: a slim, dismissible strip under the top bar naming the current step of the
 * demo path the presenter picked. Shown only while Demo hints are on. Which path is the
 * store's `activeDemoPath` (set by the demo guide, this strip's own menu, the command palette
 * and every scenario jump; cleared by Reset and by dismissing the strip), so the strip stays
 * with the presenter on pages that name no case (My queue, Active permits, a blank wizard) and
 * a dismissal holds across the applicant's and the city's shells. Which step is
 * `pathProgress()`, read off the cases, so it is right after a reload, after the presenter
 * improvises, and after Reset: never counted from clicks.
 */
function CoachStrip() {
  const hints = useDemo((s) => s.hints);
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const cases = useDemo((s) => s.cases);
  const activeDemoPath = useDemo((s) => s.activeDemoPath);
  const setActiveDemoPath = useDemo((s) => s.setActiveDemoPath);
  const setRole = useDemo((s) => s.setRole);
  const setPersona = useDemo((s) => s.setPersona);
  const router = useRouter();

  const path = hints ? activeDemoPathOf(activeDemoPath) : undefined;
  if (!path) return null;

  const progress = pathProgress(path, { cases, role, personaId, today: demoToday });
  const { step, stepIndex, totalSteps, done } = progress;

  function goTo(target: DemoStep) {
    setRole(target.role);
    if (target.persona) setPersona(target.persona);
    router.push(target.page);
  }

  function startPath(p: DemoPath) {
    setActiveDemoPath(p.id);
    goTo(p.steps[0]);
  }

  const needsSwitch = step.role !== role || Boolean(step.persona && step.persona !== personaId);

  return (
    <div className="page-container pt-4">
      <Callout className="items-center" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="shrink-0 font-semibold text-fg-pill">{`Path ${path.id} · ${done ? "Done" : `Step ${stepIndex + 1} of ${totalSteps}`}`}</p>
            <p className="min-w-0 flex-1 text-fg-pill">{done ? `${path.title}: every step is done.` : step.text}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!done ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => goTo(step)}>
                {needsSwitch ? `Switch to ${PARTY_LABEL[step.role]}` : "Go to this step"}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost">
                  Next path
                  <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Demo paths</DropdownMenuLabel>
                {DEMO_PATHS.map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => startPath(p)}>
                    Path {p.id}: {p.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss the demo coach" onClick={() => setActiveDemoPath(null)}>
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Callout>
    </div>
  );
}

export { CoachStrip };

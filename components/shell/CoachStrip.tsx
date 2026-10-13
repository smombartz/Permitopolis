"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { activeDemoPathId, pathProgress } from "@/lib/view/coach";
import { PARTY_LABEL } from "@/lib/types";

/**
 * The demo coach: a slim, dismissible strip under the top bar naming the step of the demo
 * path the case (or wizard) on screen is built on. Shown only while Demo hints are on; reads
 * `activeDemoPathId()` off the URL and `pathProgress()` off the store, so it is right after a
 * reload, after the presenter improvises, and after Reset — never counted from clicks. It
 * reads `useSearchParams()`, so AppShell/CityShell mount it under its own `<Suspense>`, the
 * same way they mount `<RememberPath />`.
 */
function CoachStrip() {
  const hints = useDemo((s) => s.hints);
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const cases = useDemo((s) => s.cases);
  const setRole = useDemo((s) => s.setRole);
  const setPersona = useDemo((s) => s.setPersona);
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  // Dismissed strips remember the path id, not just "dismissed", so moving on to another path
  // (or back to this one on a later visit) shows the strip again.
  const [dismissedPathId, setDismissedPathId] = React.useState<number | null>(null);

  const pathId = hints ? activeDemoPathId(pathname, search.toString()) : null;
  const path = pathId ? DEMO_PATHS.find((p) => p.id === pathId) : undefined;

  if (!path || path.id === dismissedPathId) return null;

  const progress = pathProgress(path, { cases, role, personaId, today: demoToday });
  const { step, stepIndex, totalSteps, done } = progress;

  function goTo(target: DemoStep) {
    setRole(target.role);
    if (target.persona) setPersona(target.persona);
    router.push(target.page);
  }

  function startPath(p: DemoPath) {
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
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss the demo coach" onClick={() => setDismissedPathId(path.id)}>
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Callout>
    </div>
  );
}

export { CoachStrip };

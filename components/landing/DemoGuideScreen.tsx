"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Section } from "@/components/ui/section";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateText, PartyChip } from "@/components/domain";
import { PARTY_ICON } from "@/components/domain/icons";
import { buildSeed, useDemo, useHydrated } from "@/lib/state";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { DEMO_DATE_JUMPS, DEMO_PATHS, SCENARIO_JUMPS, type DemoPath } from "@/lib/data/demoScript";
import { PERSONA_BY_ID } from "@/lib/data/people";
import { fmtDate } from "@/lib/format";
import { homeFor, routes } from "@/lib/routes";
import { PARTY_LABEL, type Party } from "@/lib/types";
import { demoPathJump, WHAT_IS_FAKED } from "@/lib/view/landing";

const ROLE_DESCRIPTION: Record<Party, string> = {
  applicant: "Describes the event, answers requests, accepts the quote, pays, and runs it.",
  clerk: "Intake, routing, quotes, payments, permit issuance and closeout.",
  pws: "Street closures and routes, security plans, structures, day-of operations.",
  hl: "Food and vendor permits, insurance certificates, accessibility plans.",
};

const ROLE_ORDER: Party[] = ["applicant", "clerk", "pws", "hl"];

/**
 * The demo guide at `/demo`: what the prototype is, the four roles, the demo date, Reset, the
 * seven demo paths, the six scenarios and what's faked. No shell, so it gates on
 * `useHydrated()` the way every shell-less, store-reading screen does (unlike the landing
 * page: Reset and every jump here write to the store, so none of it can run before then).
 */
function DemoGuideScreen() {
  const hydrated = useHydrated();
  const router = useRouter();
  const demoToday = useDemo((s) => s.demoToday);
  const seed = React.useMemo(() => buildSeed(), []);
  const [resetOpen, setResetOpen] = React.useState(false);

  function startPath(path: DemoPath) {
    if (!hydrated) return;
    const jump = demoPathJump(path, seed);
    const state = useDemo.getState();
    state.setRole(jump.role);
    if (jump.personaId) state.setPersona(jump.personaId);
    router.push(jump.href);
  }

  function startScenario(caseId: string) {
    if (!hydrated) return;
    const jump = SCENARIO_JUMPS.find((j) => j.caseId === caseId);
    if (!jump) return;
    const state = useDemo.getState();
    state.setRole(jump.role);
    state.setPersona(jump.personaId);
    router.push(jump.path);
  }

  function handleSetDemoToday(date: string) {
    if (!hydrated) return;
    useDemo.getState().setDemoToday(date);
  }

  function handleReset() {
    useDemo.getState().reset();
    router.push(homeFor(useDemo.getState().role));
  }

  if (!hydrated) {
    return (
      <div className="app-ground min-h-dvh">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="app-ground min-h-dvh">
      <main className="page-container flex flex-col gap-12 py-10">
        <PageHeader
          eyebrow="Demo guide"
          title="Presenting Permitopolis"
          backHref={routes.home()}
          backLabel="Back to Permitopolis"
          description="Everything a presenter needs to run the demo: the roles, the date, the rehearsed paths, and a reset button."
          actions={
            <Button variant="destructive" onClick={() => setResetOpen(true)}>
              <RotateCcwIcon aria-hidden="true" />
              Reset demo data
            </Button>
          }
        />

        <Section title="What this is">
          <p className="max-w-[72ch] text-sm text-fg-secondary">
            Permitopolis is a clickable, front-end-only prototype of a city&rsquo;s event-permitting site. An
            applicant describes an event in a five-step wizard and gets a tier, the permits it needs, and a board of
            to-do cards; the City Clerk, Public Works &amp; Safety and Health &amp; Legal each see every case&rsquo;s
            state, whose move it is, and the active permits. Everything lives in one in-browser store, seeded with 38
            cases on a fixed demo date — there is no backend, and Reset always brings it back exactly as it was.
          </p>
        </Section>

        <Section title="The four roles" description="One role switcher in the top bar moves between all four.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_ORDER.map((role) => {
              const Icon = PARTY_ICON[role];
              return (
                <Panel key={role} variant="plain" className="flex flex-col gap-2 p-4">
                  <Icon className="size-5 text-fg-label" aria-hidden="true" />
                  <p className="font-semibold text-fg">{PARTY_LABEL[role]}</p>
                  <p className="text-sm text-fg-secondary">{ROLE_DESCRIPTION[role]}</p>
                </Panel>
              );
            })}
          </div>
        </Section>

        <Section
          title="The demo date"
          description={`Today is ${fmtDate(demoToday)}. Moving it forward doesn't undo anything; Reset does. The top bar's Demo menu offers the same jumps plus a full calendar.`}
        >
          <div className="flex flex-wrap gap-2">
            {DEMO_DATE_JUMPS.map((jump) => (
              <Button
                key={jump.date}
                type="button"
                variant={jump.date === demoToday ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={jump.date === demoToday}
                onClick={() => handleSetDemoToday(jump.date)}
              >
                <DateText date={jump.date} />
                <span className="font-normal text-fg-secondary">{jump.note}</span>
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Demo paths" description="Each path runs from a fresh seed. P0 paths are needed for the demo; P1 should still work.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {DEMO_PATHS.map((path) => (
              <Panel key={path.id} variant="frosted" className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Path {path.id}</p>
                    <h3 className="text-base font-bold text-fg">{path.title}</h3>
                  </div>
                  <Badge variant={path.priority === "P0" ? "default" : "secondary"}>{path.priority}</Badge>
                </div>
                <p className="text-sm text-fg-secondary">{path.summary}</p>
                <ol className="flex flex-col gap-2">
                  {path.steps.map((step, index) => {
                    const persona = step.persona ? PERSONA_BY_ID[step.persona] : undefined;
                    return (
                      <li key={index} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-bold text-fg-label">
                          {index + 1}
                        </span>
                        <div className="flex flex-1 flex-col gap-1">
                          <PartyChip party={step.role} suffix={persona && persona.id !== "new" ? persona.name : undefined} />
                          <p className="text-fg-secondary">{step.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <Button type="button" size="sm" className="w-fit" onClick={() => startPath(path)}>
                  Start this path
                </Button>
              </Panel>
            ))}
          </div>
        </Section>

        <Section title="The six scenarios" description="S1 through S6, as the seed leaves them on May 3, 2027.">
          <Panel variant="frosted" className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Up on May 3</TableHead>
                  <TableHead>
                    <span className="sr-only">Jump</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SCENARIO_JUMPS.map((jump) => (
                  <TableRow key={jump.id}>
                    <TableCell className="font-medium text-fg">{jump.label}</TableCell>
                    {/* The longest of these is about 115 characters: it wraps, so Jump stays in view. */}
                    <TableCell className="py-2 whitespace-normal text-fg-secondary">{jump.state}</TableCell>
                    <TableCell className="w-px">
                      <Button type="button" variant="ghost" size="sm" onClick={() => startScenario(jump.caseId)}>
                        Jump
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </Section>

        <Section title="What is faked">
          <ul className="flex flex-col gap-2 text-sm text-fg-secondary">
            {WHAT_IS_FAKED.map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo?"
        body={`This restores every case, the demo date and the role switcher to the seed exactly as it was on ${fmtDate(DEFAULT_DEMO_TODAY)}. There is no undo.`}
        confirmLabel="Reset demo data"
        destructive
        onConfirm={handleReset}
      />
    </div>
  );
}

export { DemoGuideScreen };

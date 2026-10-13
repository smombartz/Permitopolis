"use client"

import Link from "next/link"
import { CalendarPlusIcon } from "lucide-react"
import { EventRow } from "@/components/board/EventRow"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { routes } from "@/lib/routes"
import { useDemo } from "@/lib/state"
import { myEvents } from "@/lib/view/board"

/**
 * My events (PRD "Applicant to-do board" > My events): the current persona's cases, what
 * needs them first, then by event date; ended and closed events under Past. A persona with
 * no events at all gets the empty state.
 */
function MyEventsScreen() {
  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const personaId = useDemo((s) => s.personaId)
  const { active, past } = myEvents(cases, personaId, today)

  const planAction = (
    <Button asChild>
      <Link href={routes.apply()}>
        <CalendarPlusIcon data-icon="inline-start" />
        Plan an event
      </Link>
    </Button>
  )

  if (active.length === 0 && past.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Applicant" title="My events" actions={planAction} />
        <EmptyState
          icon={CalendarPlusIcon}
          title="No events yet"
          text="Start the wizard to describe your event and see what it needs."
          action={
            <Button asChild>
              <Link href={routes.apply()}>Plan an event</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Applicant" title="My events" description="Your events and what they need from you next." actions={planAction} />

      {active.length > 0 ? (
        <div className="flex flex-col gap-3">
          {active.map((item) => (
            <EventRow key={item.case.id} item={item} today={today} />
          ))}
        </div>
      ) : null}

      {past.length > 0 ? (
        <Section title="Past">
          <div className="flex flex-col gap-3">
            {past.map((item) => (
              <EventRow key={item.case.id} item={item} today={today} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

export { MyEventsScreen }

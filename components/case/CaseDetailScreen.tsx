"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeftIcon, FileLockIcon } from "lucide-react"
import { CaseHeader, EndingBanner } from "@/components/domain"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CaseNotFound } from "@/components/shell"
import { PERSONA_BY_ID } from "@/lib/data/people"
import { routes } from "@/lib/routes"
import { availableActions, eventDate, isVisibleToCity, nextMove, waitingOn, useDemo } from "@/lib/state"
import { STATE_LABEL, type Dept, type Party } from "@/lib/types"
import { CASE_TABS, CASE_TAB_LABEL, backTarget, headerReviewClock, isCaseTab } from "@/lib/view/caseDetail"
import { ActionSheet } from "./ActionSheet"
import { ActionsPanel } from "./ActionsPanel"
import { ActivityTab } from "./tabs/ActivityTab"
import { ConditionsFeesTab } from "./tabs/ConditionsFeesTab"
import { DocumentsTab } from "./tabs/DocumentsTab"
import { OverviewTab } from "./tabs/OverviewTab"
import { ReviewsTab } from "./tabs/ReviewsTab"

function isDept(role: Party): role is Dept {
  return role !== "applicant"
}

/**
 * The city's case detail (plan 8, workstream 3F): header with the stepper, hold and review
 * clock; Who's up; five tabs; a sticky action panel driven by availableActions(); every action
 * panel registered by type. Built for the three city roles; CityShell has already kept the
 * Applicant off this page.
 */
function CaseDetailScreen() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const searchParams = useSearchParams()

  const cases = useDemo((s) => s.cases)
  const role = useDemo((s) => s.role)
  const today = useDemo((s) => s.demoToday)
  const cfg = useDemo((s) => s.cfg)

  const c = cases.find((candidate) => candidate.id === id)

  const announcementRef = React.useRef<string | undefined>(undefined)
  const [announcement, setAnnouncement] = React.useState("")
  React.useEffect(() => {
    if (!c) return
    const label = c.ending ? `Ended: ${c.ending.replace("_", " ")}` : STATE_LABEL[c.state]
    if (announcementRef.current !== undefined && announcementRef.current !== label) setAnnouncement(`${c.name}: now ${label}.`)
    announcementRef.current = label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.state, c?.ending])

  if (!c) {
    return <CaseNotFound id={id} backHref={routes.city.cases()} backLabel="Back to cases" />
  }

  if (!isVisibleToCity(c)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Case" title={id} backHref={backTarget(searchParams.get("from"))} backLabel="Back" />
        <EmptyState
          icon={FileLockIcon}
          title="This application is still a draft"
          text="Drafts are not visible to the city until the applicant submits (or books, for an Instant event). Check back once it has moved further."
        />
      </div>
    )
  }

  const tabParam = searchParams.get("tab")
  const tab = isCaseTab(tabParam) ? tabParam : "overview"
  const taskParam = searchParams.get("task")

  function go(next: { tab?: string; task?: string | null }) {
    const nextParams = new URLSearchParams(searchParams.toString())
    if (next.tab !== undefined) nextParams.set("tab", next.tab)
    if (next.task !== undefined) {
      if (next.task === null) nextParams.delete("task")
      else nextParams.set("task", next.task)
    }
    const query = nextParams.toString()
    router.replace(query ? `${routes.city.case(id)}?${query}` : routes.city.case(id))
  }

  const applicantName = PERSONA_BY_ID[c.applicantId]?.name ?? "The applicant"
  const statuses = waitingOn(c, today)
  const sentence = nextMove(c, today, applicantName)
  const ctx = { today, cases, cfg }
  const actions = isDept(role) ? availableActions(c, role, ctx) : []
  const headerClock = isDept(role) ? headerReviewClock(c, role, today) : null

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={backTarget(searchParams.get("from"))}
        className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-medium text-fg-secondary outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to cases
      </Link>
      <CaseHeader
        name={c.name}
        tier={c.tier}
        caseId={c.id}
        applicantName={applicantName}
        eventDate={eventDate(c, today)}
        today={today}
        state={c.state}
        ending={c.ending}
        hold={c.dateHold}
        reviewClock={headerClock ? { dayCount: headerClock.day, allowedDays: headerClock.of, paused: headerClock.paused, pausedDays: headerClock.pausedDays } : null}
      />
      {c.ending ? <EndingBanner ending={c.ending} reason={c.endingReason} /> : null}
      {!c.ending && c.flags.sentToCommission ? <Banner variant="info">This case has been sent to the commission.</Banner> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Tabs value={tab} onValueChange={(v) => go({ tab: v })} className="min-w-0">
          <TabsList variant="line" className="flex-wrap">
            {CASE_TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {CASE_TAB_LABEL[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="pt-5">
            <OverviewTab
              c={c}
              today={today}
              cfg={cfg}
              applicantName={applicantName}
              whoIsUp={statuses}
              nextMove={sentence}
              onSelectTask={(taskId) => go({ task: taskId })}
            />
          </TabsContent>
          <TabsContent value="reviews" className="pt-5">
            <ReviewsTab c={c} role={role} onOpen={(key) => go({ task: key })} />
          </TabsContent>
          <TabsContent value="documents" className="pt-5">
            <DocumentsTab c={c} role={role} onOpen={(key) => go({ task: key })} />
          </TabsContent>
          <TabsContent value="conditions" className="pt-5">
            <ConditionsFeesTab c={c} />
          </TabsContent>
          <TabsContent value="activity" className="pt-5">
            <ActivityTab c={c} />
          </TabsContent>
        </Tabs>

        <ActionsPanel role={role} stateLabel={STATE_LABEL[c.state]} actions={actions} whoIsUpNote={sentence} onOpen={(key) => go({ task: key })} />
      </div>

      <ActionSheet caseId={c.id} openKey={taskParam} role={role} onOpenChange={(open) => !open && go({ task: null })} />

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}

export { CaseDetailScreen }

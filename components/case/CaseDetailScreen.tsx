"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { FileLockIcon } from "lucide-react"
import { CaseHeader, EndingBanner, StalledBadge } from "@/components/domain"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { InlineAlert } from "@/components/ui/inline-alert"
import { BackLink, PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CaseNotFound, useDocumentTitle } from "@/components/shell"
import { applicantNameOf } from "@/lib/data/people"
import { routes } from "@/lib/routes"
import { availableActions, eventDate, isStalled, isVisibleToCity, nextMove, waitingOn, useDemo } from "@/lib/state"
import { ENDING_LABEL, STATE_LABEL, type Dept, type Party } from "@/lib/types"
import { amendmentHeadline, amendmentReview } from "@/lib/view/amend"
import { CASE_TABS, CASE_TAB_LABEL, caseBackLink, headerReviewClock, isCaseTab, isHoldExpiringTomorrow, ownTaskRows, resolveOpenKey } from "@/lib/view/caseDetail"
import { ActionSheet } from "./ActionSheet"
import { toastedDispatchCount } from "./actions/panelKit"
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
  useDocumentTitle(c && isVisibleToCity(c) ? `${c.name} · Case` : null)

  // A change of state is read out once. An action taken on this screen raises a toast, and the
  // toaster reads that out; this line is for a change nothing toasted (the demo date moving a
  // case on to Event day, a hold expiring), so the two never say the same thing twice.
  const announcementRef = React.useRef<string | undefined>(undefined)
  const toastsSeen = React.useRef(toastedDispatchCount())
  const [announcement, setAnnouncement] = React.useState("")
  React.useEffect(() => {
    if (!c) return
    const label = c.ending ? ENDING_LABEL[c.ending] : STATE_LABEL[c.state]
    const toasted = toastedDispatchCount() !== toastsSeen.current
    if (announcementRef.current !== undefined && announcementRef.current !== label) setAnnouncement(toasted ? "" : `${c.name}: now ${label}.`)
    announcementRef.current = label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.state, c?.ending])
  // After the effect above, on every render: a toast for an action that left the state alone is not held against the next change.
  React.useEffect(() => {
    toastsSeen.current = toastedDispatchCount()
  })

  if (!c) {
    return <CaseNotFound id={id} backHref={routes.city.cases()} backLabel="Back to cases" />
  }

  const back = caseBackLink(searchParams.get("from"), role)

  if (!isVisibleToCity(c)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Case" title={id} backHref={back.href} backLabel={back.label} />
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
  // `?task=` is a task's id when the link came from a list or from Who's up, and an open key
  // when one of this screen's own buttons wrote it. Either way it resolves to one panel, or none.
  const openKey = resolveOpenKey(c, searchParams.get("task"), role)

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

  const applicantName = applicantNameOf(c)
  const statuses = waitingOn(c, today)
  const sentence = nextMove(c, today, applicantName)
  const ctx = { today, cases, cfg }
  const actions = isDept(role) ? availableActions(c, role, ctx) : []
  // What the role has open and no row above reaches: on any tab but Overview, the only way to it.
  const ownTasks = isDept(role) ? ownTaskRows(c, role, statuses.find((s) => s.party === role)?.openTasks ?? [], actions) : []
  const headerClock = isDept(role) ? headerReviewClock(c, role, today) : null
  // A pending amendment: what it changes and whose move it is, for every city role.
  const amendment = c.ending ? null : amendmentReview(c, cfg)

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={back.href}>{back.label}</BackLink>
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
      {/* The same dev-only chip the lists show (it renders nothing in production). */}
      {!c.ending && isStalled(c, today) ? <StalledBadge /> : null}
      {c.ending ? <EndingBanner ending={c.ending} reason={c.endingReason} /> : null}
      {!c.ending && c.flags.sentToCommission ? <Banner variant="info">This case has been sent to the commission.</Banner> : null}
      {amendment ? (
        <Banner variant="info" data-slot="amendment-pending">
          <p>
            <strong>Amendment pending: {amendmentHeadline(amendment)}.</strong> {amendment.status} The permit covers the original plan until the amendment is in effect.
          </p>
        </Banner>
      ) : null}
      {!c.ending && isHoldExpiringTomorrow(c.dateHold, today) ? <InlineAlert variant="warning">This case&apos;s date hold expires tomorrow.</InlineAlert> : null}

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
            <ActivityTab c={c} role={role} />
          </TabsContent>
        </Tabs>

        <ActionsPanel role={role} stateLabel={c.ending ? ENDING_LABEL[c.ending] : STATE_LABEL[c.state]} tasks={ownTasks} actions={actions} whoIsUpNote={sentence} onOpen={(key) => go({ task: key })} />
      </div>

      <ActionSheet caseId={c.id} openKey={openKey} role={role} onOpenChange={(open) => !open && go({ task: null })} />

      <div role="status" data-slot="case-state-announcement" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}

export { CaseDetailScreen }

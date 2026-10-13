"use client"

import { WhoIsUp } from "@/components/domain"
import { Chip, ChipDot } from "@/components/ui/chip"
import { KeyValueList } from "@/components/ui/key-value"
import { Section } from "@/components/ui/section"
import { MapThumbnail } from "@/components/map/MapThumbnail"
import type { PartyStatus } from "@/lib/state/types"
import type { EventCase, ISODate } from "@/lib/types"
import { buildOverview } from "@/lib/view/caseDetail"
import type { RulesConfig } from "@/lib/rules/types"

interface OverviewTabProps {
  c: EventCase
  today: ISODate
  cfg: RulesConfig
  applicantName: string
  whoIsUp: PartyStatus[]
  nextMove: string
  onSelectTask: (taskId: string) => void
}

function OverviewTab({ c, today, cfg, applicantName, whoIsUp, nextMove, onSelectTask }: OverviewTabProps) {
  const overview = buildOverview(c, cfg)

  return (
    <div className="flex flex-col gap-8">
      <WhoIsUp items={whoIsUp} today={today} applicantName={applicantName} nextMove={nextMove} onSelectTask={onSelectTask} />

      <Section title="Event summary">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-5">
            <KeyValueList columns={2} items={overview.rows} />
            {overview.triggers.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {overview.triggers.map((t) => (
                    <Chip key={t.id}>
                      <ChipDot className="text-fg-tertiary" /> {/* guard-allow-tertiary: a dot, not text */}
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
            {overview.components.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What the permit covers</p>
                <ul className="flex flex-col gap-1">
                  {overview.components.map((comp) => (
                    <li key={comp.id} className="text-sm text-fg">
                      {comp.label} <span className="text-fg-label">&middot; {comp.approvedBy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {overview.mapHighlight ? <MapThumbnail highlight={overview.mapHighlight} className="w-full lg:w-64" /> : null}
        </div>
      </Section>
    </div>
  )
}

export { OverviewTab }

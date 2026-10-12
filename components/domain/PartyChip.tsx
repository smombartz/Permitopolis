import { cn } from "cn"
import { PARTY_LABEL, type Party } from "@/lib/types"
import { PARTY_ICON } from "@/components/domain/icons"

const PARTY_CLASS: Record<Party, string> = {
  applicant: "border-party-applicant-border bg-party-applicant-surface text-party-applicant-fg",
  clerk: "border-party-clerk-border bg-party-clerk-surface text-party-clerk-fg",
  pws: "border-party-pws-border bg-party-pws-surface text-party-pws-fg",
  hl: "border-party-hl-border bg-party-hl-surface text-party-hl-fg",
}

interface PartyChipProps extends React.ComponentProps<"span"> {
  party: Party
  /** Replaces the label, e.g. an applicant's org name instead of "Applicant". */
  label?: React.ReactNode
  /** Appended after the label, e.g. "Applicant · 4d" for a waiting-on chip. */
  suffix?: React.ReactNode
}

/** Identity chip: icon + color dot + label. Color never stands alone (CLAUDE.md). */
function PartyChip({ party, label, suffix, className, ...props }: PartyChipProps) {
  const Icon = PARTY_ICON[party]
  return (
    <span
      data-slot="party-chip"
      data-party={party}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        PARTY_CLASS[party],
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label ?? PARTY_LABEL[party]}</span>
      {suffix ? <span className="shrink-0">· {suffix}</span> : null}
    </span>
  )
}

export { PartyChip }

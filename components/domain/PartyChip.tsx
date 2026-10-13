import { cn } from "cn"
import { PARTY_LABEL, type Party } from "@/lib/types"
import { PartyAvatar } from "@/components/domain/PartyAvatar"

interface PartyChipProps extends React.ComponentProps<"span"> {
  party: Party
  /** Replaces the label, e.g. an applicant's org name instead of "Applicant". */
  label?: React.ReactNode
  /** Appended after the label, e.g. "Applicant · 4d" for a waiting-on chip. */
  suffix?: React.ReactNode
}

/**
 * Identity chip (plan 3.2): the party hue is confined to the leading avatar
 * tile only. The chip itself sits on a neutral surface with ink text, so
 * color never carries the chip's meaning alone.
 */
function PartyChip({ party, label, suffix, className, ...props }: PartyChipProps) {
  return (
    <span
      data-slot="party-chip"
      data-party={party}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-line-subtle bg-surface-2 pr-2.5 pl-0.5 text-xs font-medium whitespace-nowrap text-fg",
        className
      )}
      {...props}
    >
      {/* The chip's own text label is the accessible name; the tile is decorative here. */}
      <PartyAvatar party={party} size="sm" aria-hidden="true" />
      <span className="truncate">{label ?? PARTY_LABEL[party]}</span>
      {suffix ? <span className="shrink-0 text-fg-secondary">· {suffix}</span> : null}
    </span>
  )
}

export { PartyChip }

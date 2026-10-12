import { cn } from "cn"
import { cva, type VariantProps } from "class-variance-authority"
import { PARTY_LABEL, type Party } from "@/lib/types"
import { PARTY_ICON } from "@/components/domain/icons"

const PARTY_CLASS: Record<Party, string> = {
  applicant: "border-party-applicant-border bg-party-applicant-surface text-party-applicant",
  clerk: "border-party-clerk-border bg-party-clerk-surface text-party-clerk",
  pws: "border-party-pws-border bg-party-pws-surface text-party-pws",
  hl: "border-party-hl-border bg-party-hl-surface text-party-hl",
}

const avatarVariants = cva("inline-flex shrink-0 items-center justify-center rounded-full border", {
  variants: {
    size: {
      sm: "size-6 [&_svg]:size-3",
      default: "size-8 [&_svg]:size-3.5",
      lg: "size-10 [&_svg]:size-4.5",
    },
  },
  defaultVariants: { size: "default" },
})

interface PartyAvatarProps extends React.ComponentProps<"span">, VariantProps<typeof avatarVariants> {
  party: Party
}

/** A small identity tile. Always used next to the party's name (never color alone). */
function PartyAvatar({ party, size, className, ...props }: PartyAvatarProps) {
  const Icon = PARTY_ICON[party]
  return (
    <span
      data-slot="party-avatar"
      data-party={party}
      title={PARTY_LABEL[party]}
      className={cn(avatarVariants({ size }), PARTY_CLASS[party], className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <span className="sr-only">{PARTY_LABEL[party]}</span>
    </span>
  )
}

export { PartyAvatar }

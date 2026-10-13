import { cn } from "cn"
import { cva, type VariantProps } from "class-variance-authority"

const personaAvatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border border-line-subtle bg-surface-2 font-semibold text-fg-label",
  {
    variants: {
      size: {
        sm: "size-6 text-[10px]",
        default: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "default" },
  }
)

interface PersonaAvatarProps extends React.ComponentProps<"span">, VariantProps<typeof personaAvatarVariants> {
  /** The persona's or organization's name, e.g. "Riverfront Running Club". */
  name: string
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** A persona's or organization's initials in a neutral tile: not a party role, so no identity tint. */
function PersonaAvatar({ name, size, className, ...props }: PersonaAvatarProps) {
  return (
    <span
      data-slot="persona-avatar"
      role="img"
      aria-label={name}
      title={name}
      className={cn(personaAvatarVariants({ size }), className)}
      {...props}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  )
}

export { PersonaAvatar }

import { cn } from "cn"
import { CalendarIcon, CalendarOffIcon, CalendarXIcon } from "lucide-react"
import { fmtDate } from "@/lib/format"
import type { DateHold } from "@/lib/types"

interface HoldStatusProps extends React.ComponentProps<"span"> {
  hold: DateHold;
}

/** "Date held until Fri, May 14" / "No date hold yet" / "Hold released" / "Hold expired". */
function HoldStatus({ hold, className, ...props }: HoldStatusProps) {
  const { Icon, text, tone } = describe(hold);
  return (
    <span
      data-slot="hold-status"
      data-status={hold.status}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        tone === "danger" ? "text-danger-fg" : tone === "muted" ? "text-fg-tertiary" : "text-fg-secondary",
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}

function describe(hold: DateHold): { Icon: typeof CalendarIcon; text: string; tone: "default" | "muted" | "danger" } {
  switch (hold.status) {
    case "held":
      return { Icon: CalendarIcon, text: hold.expiresOn ? `Date held until ${fmtDate(hold.expiresOn)}` : "Date held", tone: "default" };
    case "expired":
      return { Icon: CalendarXIcon, text: "Hold expired", tone: "danger" };
    case "released":
      return { Icon: CalendarOffIcon, text: "Hold released", tone: "muted" };
    case "none":
    default:
      return { Icon: CalendarOffIcon, text: "No date hold yet", tone: "muted" };
  }
}

export { HoldStatus };

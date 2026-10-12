import { cn } from "cn"
import { fmtDate, fmtDateShort } from "@/lib/format"
import type { ISODate, ISODateTime } from "@/lib/types"

interface DateTextProps extends React.ComponentProps<"span"> {
  date: ISODate | ISODateTime;
  /** "Sat, Jun 26" instead of "Sat, Jun 26, 2027". */
  short?: boolean;
}

/** A date in mono, the table/row treatment: "Sat, Jun 26, 2027". */
function DateText({ date, short = false, className, ...props }: DateTextProps) {
  return (
    <span data-slot="date-text" className={cn("font-mono text-[13px] tabular-nums text-fg", className)} {...props}>
      {short ? fmtDateShort(date) : fmtDate(date)}
    </span>
  );
}

export { DateText };

import { Badge } from "@/components/ui/badge";
import { fmtDateShort } from "@/lib/format";
import type { SessionRow } from "@/lib/view/permit";

const MARK_LABEL: Record<SessionRow["billing"], string> = {
  paid: "Paid",
  due: "Due",
  upcoming: "Upcoming",
  skipped: "Skipped",
};

const MARK_VARIANT: Record<SessionRow["billing"], "success" | "warning" | "outline" | "secondary"> = {
  paid: "success",
  due: "warning",
  upcoming: "outline",
  skipped: "secondary",
};

/** A series' sessions, each with its paid/due/upcoming/skipped mark. */
function SessionList({ rows }: { rows: SessionRow[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.date} className="flex items-center justify-between gap-2 text-sm">
          <span className="font-mono text-[13px] tabular-nums text-fg">{fmtDateShort(row.date)}</span>
          <Badge variant={MARK_VARIANT[row.billing]}>{MARK_LABEL[row.billing]}</Badge>
        </li>
      ))}
    </ul>
  );
}

export { SessionList };

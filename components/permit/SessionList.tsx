import { BillingBadge, DateText } from "@/components/domain";
import type { SessionRow } from "@/lib/view/permit";

/** A series' sessions, each with its paid/due/upcoming/skipped mark. */
function SessionList({ rows }: { rows: SessionRow[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.date} className="flex items-center justify-between gap-2 text-sm">
          <DateText date={row.date} short />
          <BillingBadge billing={row.billing} />
        </li>
      ))}
    </ul>
  );
}

export { SessionList };

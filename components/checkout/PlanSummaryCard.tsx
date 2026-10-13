import { KeyValueList } from "@/components/ui/key-value";
import { fmtNumber } from "@/lib/format";
import type { PlanSummary } from "@/lib/view/checkout";

/** The plan summary both checkout modes show: what, where, when, how many. */
function PlanSummaryCard({ plan }: { plan: PlanSummary }) {
  return (
    <KeyValueList
      columns={2}
      items={[
        { label: "Event", value: plan.name },
        { label: "Where", value: plan.placeLabel },
        { label: "When", value: plan.whenLabel },
        { label: "Attendance", value: plan.attendance !== null ? fmtNumber(plan.attendance) : null },
      ]}
    />
  );
}

export { PlanSummaryCard };

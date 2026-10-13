import { Panel } from "@/components/ui/panel";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cancellationRows, feeScheduleRows } from "@/lib/view/landing";
import { SectionHeading } from "./SectionHeading";

/** Fees and cancellations (plan 7, row 7): both schedules rendered straight from the config. */
function FeesPanels() {
  const fees = feeScheduleRows();
  const cancellation = cancellationRows();

  return (
    <section id="fees" className="page-container flex flex-col gap-10 py-[var(--section-space)]">
      <SectionHeading
        eyebrow="Fees and cancellations"
        title="What it costs, and what comes back"
        lead="Every number here comes straight from the city's fee schedule — the same numbers the wizard quotes you."
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel variant="frosted" className="flex flex-col gap-3 p-6">
          <h3 className="text-sm font-bold text-fg">Fee schedule</h3>
          <dl className="flex flex-col divide-y divide-line-subtle">
            {fees.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                <dt className="text-fg-secondary">{row.label}</dt>
                <dd className="shrink-0 font-mono text-[13px] font-medium text-fg">{row.amount}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel variant="frosted" className="flex flex-col gap-4 p-6">
          <h3 className="text-sm font-bold text-fg">Cancelling</h3>
          <ul className="flex flex-col gap-3 text-sm text-fg-secondary">
            {cancellation.map((label) => (
              <li key={label} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <InlineAlert variant="success">The refundable cleanup deposit is always refunded in full.</InlineAlert>
        </Panel>
      </div>
    </section>
  );
}

export { FeesPanels };

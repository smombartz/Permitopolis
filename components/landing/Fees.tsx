import { InlineAlert } from "@/components/ui/inline-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cancellationRows, feeScheduleRows } from "@/lib/view/landing";
import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "fees-heading";

/** Fees and cancellations: the fee schedule as a table and the cancellation schedule as a list, both rendered straight from the config. */
function Fees() {
  const fees = feeScheduleRows();
  const cancellation = cancellationRows();

  return (
    <section id={SECTION_ID.fees} aria-labelledby={HEADING_ID} className="page-container flex scroll-mt-6 flex-col gap-6 py-6 sm:py-8">
      <SectionHeading
        id={HEADING_ID}
        title="Fees and cancellations"
        lead="These figures come from the city's fee schedule. They are the same figures the application quotes you."
      />
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-lg font-bold text-fg">Fee schedule</h3>
          <div className="overflow-hidden rounded-control border border-line-subtle">
            <Table aria-label="Fee schedule">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col" className="text-right">
                    Fee
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((row) => (
                  <TableRow key={row.label}>
                    <th scope="row" className="px-3 py-2.5 text-left align-middle font-normal text-fg-secondary">
                      {row.label}
                    </th>
                    <TableCell className="h-auto py-2.5 text-right font-medium whitespace-normal text-fg">{row.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-lg font-bold text-fg">If you cancel</h3>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 text-base text-fg-secondary marker:text-fg-label">
            {cancellation.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <InlineAlert variant="success" className="text-sm">
            The refundable cleanup deposit is always refunded in full.
          </InlineAlert>
        </div>
      </div>
    </section>
  );
}

export { Fees };

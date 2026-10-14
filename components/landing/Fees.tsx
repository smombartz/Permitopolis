import { cn } from "cn";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cancellationRows, feeScheduleRows } from "@/lib/view/landing";
import { SECTION, SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "fees-heading";

/** Fees and cancellations: two frosted panels, the fee schedule as a table and the cancellation schedule as a list, both rendered straight from the config. */
function Fees() {
  const fees = feeScheduleRows();
  const cancellation = cancellationRows();

  return (
    <section id={SECTION_ID.fees} aria-labelledby={HEADING_ID} className={cn(SECTION, "gap-12")}>
      <SectionHeading
        id={HEADING_ID}
        eyebrow="Costs"
        title="Fees and cancellations"
        lead="These figures come from the city's fee schedule. They are the same figures the application quotes you."
      />
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[1.3fr_1fr]">
        <Panel variant="frosted" className="flex min-w-0 flex-col overflow-hidden">
          <h3 className="px-6 pt-6 pb-4 text-h4 font-bold text-fg">Fee schedule</h3>
          <Table aria-label="Fee schedule">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">
                  Item
                </TableHead>
                <TableHead scope="col" className="pr-6 text-right">
                  Fee
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((row) => (
                <TableRow key={row.label}>
                  <th scope="row" className="py-2.5 pr-3 pl-6 text-left align-middle font-normal text-fg-secondary">
                    {row.label}
                  </th>
                  <TableCell numeric className="h-auto py-2.5 pr-6 text-right whitespace-normal">
                    {row.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Panel variant="frosted" className="flex min-w-0 flex-col gap-4 p-6">
          <h3 className="text-h4 font-bold text-fg">If you cancel</h3>
          <ul className="flex flex-col gap-3 text-base text-fg-secondary">
            {cancellation.map((label) => (
              <li key={label} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <InlineAlert variant="success" className="text-sm">
            The refundable cleanup deposit is always refunded in full.
          </InlineAlert>
        </Panel>
      </div>
    </section>
  );
}

export { Fees };

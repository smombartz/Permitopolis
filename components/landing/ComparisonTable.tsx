import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIER_LABEL, type Tier } from "@/lib/types";
import { blockPartyNote, comparisonRows } from "@/lib/view/landing";
import { SectionHeading } from "./SectionHeading";

const TIERS: Tier[] = ["instant", "reviewed", "special"];

/** What sets the tier (plan 7, row 5): the comparison table, triggers against tiers. */
function ComparisonTable() {
  const rows = comparisonRows();

  return (
    <section className="page-container flex flex-col gap-10 py-[var(--section-space)]">
      <SectionHeading
        eyebrow="What sets the tier"
        title="Every trigger, one tier each"
        lead="One trigger is enough to move an event up. Here's exactly what moves it, read straight off the rules engine."
      />
      <Panel variant="frosted" className="overflow-hidden p-0">
        <Table aria-label="Which tier each trigger sets">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 z-20 bg-surface-solid">
                Trigger
              </TableHead>
              {TIERS.map((tier) => (
                <TableHead
                  key={tier}
                  scope="col"
                  className={cn("text-center", tier === "reviewed" && "bg-indigo-500/10")}
                >
                  {TIER_LABEL[tier]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <th scope="row" className="sticky left-0 z-10 h-11 bg-surface-solid px-3 text-left align-middle font-medium whitespace-nowrap text-fg">
                  {row.label}
                </th>
                {TIERS.map((tier) => {
                  const applies = row.tier === tier;
                  return (
                    <TableCell key={tier} className={cn("text-center", tier === "reviewed" && "bg-indigo-500/5")}>
                      {applies ? (
                        <>
                          <CheckIcon className="inline size-4 text-fg-accent" aria-hidden="true" />
                          <span className="sr-only">Applies to {TIER_LABEL[tier]}</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-fg-tertiary">{/* guard-allow-tertiary: decorative em dash */}
                            &mdash;
                          </span>
                          <span className="sr-only">Does not apply to {TIER_LABEL[tier]}</span>
                        </>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <p className="max-w-[72ch] text-sm text-fg-secondary">{blockPartyNote()}</p>
    </section>
  );
}

export { ComparisonTable };

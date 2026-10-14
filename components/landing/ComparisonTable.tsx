import { CheckIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIER_LABEL, type Tier } from "@/lib/types";
import { blockPartyNote, comparisonRows } from "@/lib/view/landing";
import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "what-decides-heading";
const TIERS: Tier[] = ["instant", "reviewed", "special"];

/** What decides the tier: the triggers against the three tiers, as a plain table with no column singled out. */
function ComparisonTable() {
  const rows = comparisonRows();

  return (
    <section id={SECTION_ID.whatDecides} aria-labelledby={HEADING_ID} className="page-container flex scroll-mt-6 flex-col gap-6 py-6 sm:py-8">
      <SectionHeading
        id={HEADING_ID}
        title="What decides the tier"
        lead="Any one of these is enough to put an event in a tier. An event with several takes the highest."
      />
      <div className="overflow-hidden rounded-control border border-line-subtle">
        <Table aria-label="Which tier each trigger sets">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 z-20 bg-surface-solid">
                Trigger
              </TableHead>
              {TIERS.map((tier) => (
                <TableHead key={tier} scope="col" className="text-center">
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
                    <TableCell key={tier} className="text-center">
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
      </div>
      <p className="max-w-[72ch] text-sm text-fg-secondary">{blockPartyNote()}</p>
    </section>
  );
}

export { ComparisonTable };

"use client";

import Link from "next/link";
import { ChevronRightIcon, ClipboardCheckIcon } from "lucide-react";
import { EventTitle, PartyChip, TierBadge } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { PERSONA_BY_ID } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import type { CloseoutRow } from "@/lib/view/active";

function applicantNameOf(applicantId: string): string {
  return PERSONA_BY_ID[applicantId]?.name ?? "Unknown applicant";
}

/** Closeout: events still being reconciled, with the remaining steps and who holds them. */
export function ActiveCloseoutView({ rows }: { rows: CloseoutRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardCheckIcon} title="Nothing in Closeout" text="Every event is reconciled or still to come." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.case.id}>
          <Panel variant="plain" className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-48 flex-1">
              <Link href={routes.city.case(row.case.id)} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                <EventTitle name={row.case.name} applicantName={applicantNameOf(row.case.applicantId)} />
              </Link>
            </div>
            <TierBadge tier={row.case.tier} />
            <div className="flex flex-wrap items-center gap-1.5">
              {row.holders.length === 0 ? (
                <span className="text-sm text-fg-secondary">Nobody is up</span>
              ) : (
                row.holders.map((party) => <PartyChip key={party} party={party} />)
              )}
            </div>
            <ul className="min-w-56 flex-1 list-disc pl-4 text-sm text-fg-secondary">
              {row.remainingSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${row.case.name}`}>
              <Link href={routes.city.case(row.case.id)}>
                <ChevronRightIcon />
              </Link>
            </Button>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

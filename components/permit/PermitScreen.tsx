"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FileQuestionIcon } from "lucide-react";
import { PermitCard } from "@/components/permit/PermitCard";
import { PermitPrintStyles } from "@/components/permit/PermitPrintStyles";
import { CaseNotFound } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import { permitPageInfo } from "@/lib/view/permit";

/**
 * The permit page (`/events/[id]/permit`), inside AppShell, mobile-first (applicants carry it
 * on a phone). A case with no permit yet, or an ended one, explains why instead.
 */
function PermitScreen() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);

  const c = cases.find((x) => x.id === id);
  if (!c) return <CaseNotFound id={id} backHref={routes.events()} backLabel="Back to your events" />;

  const info = permitPageInfo(c);

  return (
    <div className="flex flex-col gap-5">
      <PermitPrintStyles />
      <PageHeader
        eyebrow="Permit"
        title={c.name}
        backHref={routes.event(c.id)}
        backLabel="Back to your board"
        actions={
          info.ready ? (
            <Button variant="secondary" onClick={() => window.print()} className="no-print">
              Download PDF
            </Button>
          ) : undefined
        }
      />
      {info.ready ? (
        <PermitCard c={c} today={today} cfg={cfg} />
      ) : (
        <EmptyState
          icon={FileQuestionIcon}
          title="No permit to show"
          text={info.message}
          action={
            <Button asChild variant="secondary">
              <Link href={info.href ?? routes.event(c.id)}>{info.label ?? "Back to your board"}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

export { PermitScreen };

"use client";

import { useParams } from "next/navigation";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { ConditionList } from "@/components/domain";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/utils";
import { fmtDate, fmtNumber, fmtTimeRange } from "@/lib/format";
import { eventDate, permittedPlan, useDemo, useHydrated } from "@/lib/state";
import { verifyStatus } from "@/lib/view/permit";

/**
 * The public check at `/verify/[id]`: what an officer sees after scanning the permit's QR
 * code. No shell, no role. High contrast, big type, works at 375px.
 */
function VerifyScreen() {
  const hydrated = useHydrated();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);

  if (!hydrated) {
    return (
      <div className="app-ground min-h-dvh">
        <PageSkeleton />
      </div>
    );
  }

  const record = cases.find((x) => x.id === id);
  const result = verifyStatus(record);
  // What the permit covers: the plan from before a pending amendment, never the amended one.
  const c = record ? permittedPlan(record) : undefined;
  const when = c?.schedule ? eventDate(c, today) : null;

  return (
    <main className="app-ground page-container flex min-h-dvh flex-col items-center justify-center gap-8 py-10 text-center">
      <div className={cn("flex flex-col items-center gap-3", result.valid ? "text-success-fg" : "text-danger-fg")}>
        {result.valid ? (
          <CircleCheckIcon className="size-20" aria-hidden="true" />
        ) : (
          <CircleXIcon className="size-20" aria-hidden="true" />
        )}
        <h1 className="text-display font-extrabold">{result.valid ? "Valid" : "Not valid"}</h1>
        {result.reason ? <p className="text-lg font-medium text-fg-secondary">{result.reason}</p> : null}
      </div>

      {c ? (
        <div className="flex w-full max-w-md flex-col gap-5 rounded-panel border border-line-subtle bg-surface-1 p-6 text-left">
          <div>
            <p className="text-h4 font-bold text-fg">{c.name}</p>
            <p className="text-sm text-fg-secondary">{c.location?.label ?? "Place not provided"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Date and hours</p>
            <p className="text-sm text-fg">
              {when && c.schedule ? `${fmtDate(when)}, ${fmtTimeRange(c.schedule.start, c.schedule.end)}` : "Not provided"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Attendance</p>
            <p className="text-sm text-fg">{c.attendance !== null ? `${fmtNumber(c.attendance)} people` : "Not provided"}</p>
          </div>
          {record?.flags.amendmentPending ? (
            <p className="text-sm font-medium text-warning-fg">A change to this event is pending. Until it is approved, the permit covers only what is shown here.</p>
          ) : null}
          {c.conditions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Conditions</p>
              <ConditionList conditions={c.conditions} />
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export { VerifyScreen };

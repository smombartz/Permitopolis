"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { SessionList } from "@/components/permit/SessionList";
import { CaseId, ConditionList, Money, TierBadge } from "@/components/domain";
import { MapThumbnail } from "@/components/map";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Separator } from "@/components/ui/separator";
import { CITY_STAFF_BY_DEPT } from "@/lib/data/people";
import { fmtDate, fmtNumber, fmtTimeRange } from "@/lib/format";
import { classify } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules";
import { routes } from "@/lib/routes";
import { permittedPlan, refundIfCancelled } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";
import { sessionRows } from "@/lib/view/permit";

const noSubscription = () => () => {};

/**
 * The site's own origin, so the QR code holds a URL a phone can open and not only a path. Empty
 * on the server and on the first client render, then the browser's.
 */
function useOrigin(): string {
  return React.useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => "",
  );
}

/**
 * The permit itself: mobile-first (applicants carry it on a phone), and what prints through
 * `PermitPrintStyles`'s visibility pattern when `id="permit-print-area"` is targeted.
 */
function PermitCard({ c: record, today, cfg }: { c: EventCase; today: ISODate; cfg: RulesConfig }) {
  // The plan the permit covers. While an amendment is pending that is the plan from before it
  // (PRD: "the current permit stays valid for the original plan until the amendment is
  // approved"): its place, hours, tier and what it covers, not the amended ones on the record.
  const c = permittedPlan(record);
  const cls = classify(c, cfg);
  const contact = CITY_STAFF_BY_DEPT.clerk;
  // What `cancel` would pay back today: capped at what was paid, the deposit included.
  const refund = refundIfCancelled(record, today, cfg);
  const bands = [...cfg.cancellation].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const rows = sessionRows(c);
  const isSeries = !!c.schedule?.recurrence;
  const verifyPath = routes.verify(c.id);
  const origin = useOrigin();

  return (
    <div
      id="permit-print-area"
      className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface-1 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <Eyebrow>Permitopolis event permit</Eyebrow>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h4 font-bold text-fg">{c.name}</h2>
          <TierBadge tier={c.tier} />
        </div>
        <CaseId id={c.id} />
        {c.flags.amendmentPending ? (
          <p className="text-xs font-medium text-warning-fg">
            An amendment is pending. This permit covers the original plan until it&rsquo;s approved.
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <QRCodeSVG value={`${origin}${verifyPath}`} size={148} />
        <div className="flex flex-col items-center gap-1 text-center sm:items-end sm:text-right">
          <p className="text-sm font-semibold text-fg">Scan to verify this permit</p>
          <p className="font-mono text-xs text-fg-secondary">{verifyPath}</p>
          {/* What the scan opens, for whoever is holding the permit rather than scanning it. */}
          <Link
            href={verifyPath}
            className="no-print rounded-control text-sm font-medium text-fg-accent underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Open the verification page
          </Link>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Place</p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {c.location ? <MapThumbnail highlight={{ id: c.id, location: c.location, status: "permitted", tier: c.tier, label: c.location.label }} className="max-w-48" /> : null}
          <p className="text-sm text-fg">{c.location?.label ?? "Not provided"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Date and hours</p>
        {c.schedule ? (
          isSeries ? (
            <>
              <p className="text-sm text-fg">
                {fmtTimeRange(c.schedule.start, c.schedule.end)} · {rows.length} session{rows.length === 1 ? "" : "s"}
              </p>
              <SessionList rows={rows} />
            </>
          ) : (
            <p className="text-sm text-fg">
              {fmtDate(c.schedule.date)}, {fmtTimeRange(c.schedule.start, c.schedule.end)}
            </p>
          )
        ) : (
          <p className="text-sm text-fg-label">Not provided</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Attendance</p>
        <p className="text-sm text-fg">{c.attendance !== null ? `${fmtNumber(c.attendance)} people` : "Not provided"}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">This permit covers</p>
        <ul className="flex flex-col gap-1 text-sm text-fg">
          {cls.components.map((component) => (
            <li key={component.id}>
              {component.label} <span className="text-fg-label">· {component.approvedBy}</span>
            </li>
          ))}
        </ul>
      </div>

      {c.conditions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Conditions</p>
          <ConditionList conditions={c.conditions} />
        </div>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Day-of contact</p>
        <p className="text-sm text-fg">
          {contact.name}, {contact.title}
        </p>
        <p className="font-mono text-sm text-fg-secondary">{contact.phone}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Cancellation schedule</p>
        <ul aria-label="Cancellation schedule" className="flex flex-col gap-1 text-sm">
          {bands.map((band) => {
            const appliesToday = refund.canCancel && band.label === refund.rule;
            return (
              <li key={band.label} aria-current={appliesToday ? "true" : undefined} className={appliesToday ? "font-semibold text-fg" : "text-fg-secondary"}>
                {band.label}
                {appliesToday ? <span className="font-medium text-fg-accent"> · Applies today</span> : null}
              </li>
            );
          })}
        </ul>
        {refund.deposit > 0 ? (
          <p className="text-sm text-fg-secondary">
            Your <Money amount={refund.deposit} /> deposit is returned in full, whenever you cancel.
          </p>
        ) : null}
        {refund.canCancel ? (
          <p className="text-sm text-fg">
            If cancelled today ({fmtDate(today)}): <Money amount={refund.refund} /> refund{refund.deposit > 0 && refund.refund >= refund.deposit ? ", deposit included" : ""}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { PermitCard };

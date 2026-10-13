import { QRCodeSVG } from "qrcode.react";
import { SessionList } from "@/components/permit/SessionList";
import { CaseId, ConditionList, TierBadge } from "@/components/domain";
import { MapThumbnail } from "@/components/map";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Separator } from "@/components/ui/separator";
import { CITY_STAFF_BY_DEPT } from "@/lib/data/people";
import { fmtDate, fmtMoney, fmtNumber, fmtTimeRange } from "@/lib/format";
import { cancellationRefund, classify } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules";
import { routes } from "@/lib/routes";
import type { EventCase, ISODate } from "@/lib/types";
import { sessionRows } from "@/lib/view/permit";

/**
 * The permit itself: mobile-first (applicants carry it on a phone), and what prints through
 * `PermitPrintStyles`'s visibility pattern when `id="permit-print-area"` is targeted.
 */
function PermitCard({ c, today, cfg }: { c: EventCase; today: ISODate; cfg: RulesConfig }) {
  const cls = classify(c, cfg);
  const contact = CITY_STAFF_BY_DEPT.clerk;
  const refund = cancellationRefund(c, today, cfg);
  const rows = sessionRows(c);
  const isSeries = !!c.schedule?.recurrence;

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
        <QRCodeSVG value={routes.verify(c.id)} size={148} />
        <div className="flex flex-col items-center gap-1 text-center sm:items-end sm:text-right">
          <p className="text-sm font-semibold text-fg">Scan to verify this permit</p>
          <p className="font-mono text-xs text-fg-secondary">{routes.verify(c.id)}</p>
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
        <p className="text-sm text-fg">{refund.rule}</p>
        <p className="text-sm text-fg">
          If cancelled today ({fmtDate(today)}): <span className="font-mono tabular-nums">{fmtMoney(refund.refund)}</span> refund.
        </p>
      </div>
    </div>
  );
}

export { PermitCard };

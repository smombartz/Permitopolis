import * as React from "react";
import { cn } from "cn";
import { Eyebrow } from "@/components/ui/eyebrow";

interface SectionHeadingProps {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}

/**
 * The eyebrow pill above every section headline (Rime & Ink "Treatments"), the section's `<h2>`
 * at the display scale with a balanced wrap 20px below it, and an optional lead paragraph.
 *
 * When an anchor lands on the section (`data-arrived` on the `SECTION` group), the eyebrow lights
 * like a step marker on the scroll thread: lit in 240ms, released over the settle duration.
 */
function SectionHeading({ id, eyebrow, title, lead, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col items-start gap-5", className)}>
      <Eyebrow className="transition-[border-color,box-shadow] duration-[var(--dur-settle)] ease-frost group-data-arrived/section:border-indigo-650 group-data-arrived/section:shadow-step-lit group-data-arrived/section:duration-[var(--dur-gentle)]">
        {eyebrow}
      </Eyebrow>
      {/* 48px below 640px: at 60px "cancellations" is wider than a 335px column. */}
      <h2 id={id} className="text-feature font-bold text-balance break-words text-fg sm:text-display">
        {title}
      </h2>
      {lead ? <p className="max-w-[640px] text-lead text-pretty text-fg-secondary">{lead}</p> : null}
    </div>
  );
}

export { SectionHeading };

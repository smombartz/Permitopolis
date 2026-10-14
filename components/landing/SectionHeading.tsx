import * as React from "react";
import { cn } from "cn";

interface SectionHeadingProps {
  id?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}

/**
 * A section's `<h2>` over an ink rule, with an optional plain lead paragraph: the heading of a
 * city office's page, not a marketing headline (no eyebrow pill, no display type).
 */
function SectionHeading({ id, title, lead, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h2 id={id} className="border-b-2 border-ink-950 pb-2 text-h4 font-bold break-words text-fg sm:text-card">
        {title}
      </h2>
      {lead ? <p className="max-w-[68ch] text-base text-pretty text-fg-secondary">{lead}</p> : null}
    </div>
  );
}

export { SectionHeading };

import * as React from "react";
import { cn } from "cn";
import { Eyebrow } from "@/components/ui/eyebrow";

interface SectionHeadingProps {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  /** The night section's own text tokens, in place of the light-ground ones. */
  tone?: "light" | "night";
}

/**
 * The eyebrow pill above every section headline (Rime & Ink "Pills and treatments"), the
 * section's `<h2>` at the display scale with a balanced wrap, and an optional lead paragraph.
 */
function SectionHeading({ id, eyebrow, title, lead, align = "left", tone = "light", className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-5", align === "center" && "items-center text-center", className)}>
      <Eyebrow className={tone === "night" ? "border-night-line bg-white/10 text-night-fg-secondary" : undefined}>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className={cn(
          // 48px below 640px: at 60px "workspace," is within a few pixels of a 335px column.
          "text-feature font-bold text-balance break-words sm:text-display",
          tone === "night" ? "text-night-fg" : "text-fg",
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p className={cn("max-w-[640px] text-lead text-pretty", tone === "night" ? "text-night-fg-secondary" : "text-fg-secondary")}>{lead}</p>
      ) : null}
    </div>
  );
}

export { SectionHeading };

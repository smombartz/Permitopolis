"use client";

/**
 * Settings, section 5: the condition and request templates from lib/data/templates.ts, by
 * department, read-only. These are the exact lists the review panel's condition builder and
 * request picker, and the quote builder, offer from.
 */
import { Section } from "@/components/ui/section";
import { InlineAlert } from "@/components/ui/inline-alert";
import { CopyButton } from "@/components/ui/copy-button";
import { DEPT_ICON } from "@/components/domain";
import { CONDITION_TEMPLATES, REQUEST_TEMPLATES } from "@/lib/data/templates";
import { DEPTS, PARTY_LABEL } from "@/lib/types";

function TemplatesSection() {
  return (
    <Section title="Templates" description="Condition wording and request wording, by department. They appear in the review, request and quote panels.">
      <InlineAlert variant="info">Read-only in the prototype.</InlineAlert>

      <div className="grid gap-6 lg:grid-cols-3">
        {DEPTS.map((dept) => {
          const Icon = DEPT_ICON[dept];
          return (
            <div key={dept} className="flex flex-col gap-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
                <Icon className="size-4 text-fg-label" aria-hidden="true" />
                {PARTY_LABEL[dept]}
              </h3>

              <TemplateList title="Condition templates" items={CONDITION_TEMPLATES[dept]} />
              <TemplateList title="Request templates" items={REQUEST_TEMPLATES[dept]} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function TemplateList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{title}</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start justify-between gap-2 rounded-control bg-surface-2 px-3 py-2 text-sm text-fg-secondary">
            <span className="min-w-0">{item}</span>
            <CopyButton value={item} label="Copy" size="sm" variant="ghost" className="shrink-0" aria-label={`Copy: ${item}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { TemplatesSection };

import { cn } from "cn";
import { Panel } from "@/components/ui/panel";
import { Eyebrow } from "@/components/ui/eyebrow";
import { TierBadge } from "@/components/domain";
import { Money } from "@/components/domain/Money";
import { TIER_LABEL, type EventCase, type Tier } from "@/lib/types";
import { plural } from "@/lib/format";
import { tierCards } from "@/lib/view/landing";
import { SectionHeading } from "./SectionHeading";

const TIER_COPY: Record<Tier, string> = {
  instant: "A bookable space, within capacity, no add-ons. Book it and pay — the permit is yours right away.",
  reviewed: "A plaza, a crowd of 100 or more, or an add-on like sound, alcohol or vendors. The Clerk pulls in whichever department the add-ons need.",
  special: "A street or route closure, 1,000 or more people, fireworks or heavy city resources. Every department reviews it.",
};

interface EventTiersProps {
  seed: EventCase[];
}

/** The three-card grid (plan 7, row 4): Instant, Reviewed and Special event. */
function EventTiers({ seed }: EventTiersProps) {
  const cards = tierCards(seed);

  return (
    <section id="event-tiers" className="page-container flex flex-col gap-12 py-[var(--section-space)]">
      <SectionHeading
        eyebrow="Event tiers"
        title="Three tiers, no guessing which one"
        lead="You never pick a tier. You describe the event, and the rules engine sorts it for you — every time, the same way."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Panel
            key={card.tier}
            variant="frosted"
            className={cn(
              "flex flex-col gap-5 p-6",
              card.tier === "reviewed" && "border-indigo-650/60 shadow-[0_0_0_1px_var(--indigo-650)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <TierBadge tier={card.tier} />
              {card.tier === "reviewed" ? <Eyebrow>Most common</Eyebrow> : null}
            </div>
            <h3 className="text-card font-bold text-fg">{TIER_LABEL[card.tier]}</h3>
            <p className="text-sm text-fg-secondary">{TIER_COPY[card.tier]}</p>
            <dl className="flex flex-col gap-2 border-t border-line-subtle pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-label">Lead time</dt>
                <dd className="font-medium text-fg">{plural(card.leadTimeDays, "day")} notice</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-label">Reviewed by</dt>
                <dd className="text-right font-medium text-fg">{card.reviewerText}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-label">Typical fee</dt>
                <dd>
                  <Money amount={card.typicalFee} className="text-sm font-bold text-fg" />
                </dd>
              </div>
            </dl>
            <p className="text-xs text-fg-secondary">
              e.g. {card.example.title} &middot; {card.example.applicantName}
            </p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

export { EventTiers };

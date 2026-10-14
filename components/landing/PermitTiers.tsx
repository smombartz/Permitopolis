import { cn } from "cn";
import { TIER_ICON } from "@/components/domain";
import { Money } from "@/components/domain/Money";
import { TIER_LABEL, type EventCase, type Tier } from "@/lib/types";
import { plural } from "@/lib/format";
import { tierCards } from "@/lib/view/landing";
import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "permit-tiers-heading";

const TIER_COPY: Record<Tier, string> = {
  instant: "A bookable space, within its capacity, with no add-ons. Book it and pay, and the permit is issued right away.",
  reviewed: "A plaza, a crowd of 100 or more, or an add-on such as sound, alcohol or vendors. The City Clerk brings in the departments the add-ons need.",
  special: "A street or route closure, 1,000 or more people, fireworks or heavy use of city resources. Every department reviews it.",
};

const TIER_ICON_CLASS: Record<Tier, string> = {
  instant: "text-tier-instant",
  reviewed: "text-tier-reviewed",
  special: "text-tier-special",
};

interface PermitTiersProps {
  seed: EventCase[];
}

/**
 * The three tiers as summary rows: when each applies, then the notice it needs, who reviews it
 * and a typical fee, all read from the rules and the seed (`tierCards`). Rows of equal weight;
 * no tier is promoted over another.
 */
function PermitTiers({ seed }: PermitTiersProps) {
  const cards = tierCards(seed);

  return (
    <section id={SECTION_ID.permitTiers} aria-labelledby={HEADING_ID} className="page-container flex scroll-mt-6 flex-col gap-6 py-6 sm:py-8">
      <SectionHeading
        id={HEADING_ID}
        title="Permit tiers"
        lead="Every event falls into one of three tiers. You do not choose one: you describe the event and the city's rules sort it, the same way every time."
      />
      <ul aria-label="The three permit tiers" className="flex flex-col">
        {cards.map((card) => {
          const Icon = TIER_ICON[card.tier];
          return (
            <li key={card.tier} className="grid grid-cols-1 gap-x-10 gap-y-3 border-b border-line-subtle py-6 first:pt-1 md:grid-cols-[13rem_1fr]">
              <h3 className="flex items-center gap-2.5 self-start text-h4 font-bold text-fg">
                <Icon className={cn("size-5 shrink-0", TIER_ICON_CLASS[card.tier])} aria-hidden="true" />
                {TIER_LABEL[card.tier]}
              </h3>
              <div className="flex min-w-0 flex-col gap-4">
                <p className="max-w-[68ch] text-base text-fg-secondary">{TIER_COPY[card.tier]}</p>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-fg-label">Notice needed</dt>
                    <dd className="text-base font-semibold text-fg">{plural(card.leadTimeDays, "day")}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-fg-label">Reviewed by</dt>
                    <dd className="text-base font-semibold text-fg">{card.reviewerText}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-fg-label">Typical fee</dt>
                    <dd>
                      <Money amount={card.typicalFee} className="text-base font-semibold text-fg" />
                    </dd>
                  </div>
                </dl>
                <p className="text-sm text-fg-secondary">
                  Example: {card.example.title}, {card.example.applicantName}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export { PermitTiers };

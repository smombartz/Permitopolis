import { cn } from "cn";
import { Panel } from "@/components/ui/panel";
import { TIER_ICON } from "@/components/domain";
import { Money } from "@/components/domain/Money";
import { TIER_LABEL, type EventCase, type Tier } from "@/lib/types";
import { plural } from "@/lib/format";
import { tierCards } from "@/lib/view/landing";
import { SECTION, SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "permit-tiers-heading";

const TIER_COPY: Record<Tier, string> = {
  instant: "A bookable space, within its capacity, with no add-ons. Book it and pay, and the permit is issued right away.",
  reviewed: "A plaza, a crowd of 100 or more, or an add-on such as sound, alcohol or vendors. The City Clerk brings in the departments the add-ons need.",
  special: "A street or route closure, 1,000 or more people, fireworks or heavy use of city resources. Every department reviews it.",
};

// The tier's tint is confined to a small tile behind its icon, the way a party's is to its avatar.
const TIER_TILE_CLASS: Record<Tier, string> = {
  instant: "border-tier-instant-border bg-tier-instant-surface text-tier-instant-fg",
  reviewed: "border-tier-reviewed-border bg-tier-reviewed-surface text-tier-reviewed-fg",
  special: "border-tier-special-border bg-tier-special-surface text-tier-special-fg",
};

// Rime & Ink's overline: 11px/700 uppercase at .12em, in the label ink.
const OVERLINE = "text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase";

interface PermitTiersProps {
  seed: EventCase[];
}

/**
 * The three tiers as rows of one frosted panel: when each applies, then the notice it needs, who
 * reviews it and a typical fee, all read from the rules and the seed (`tierCards`). Rows of equal
 * weight; no tier is promoted over another.
 */
function PermitTiers({ seed }: PermitTiersProps) {
  const cards = tierCards(seed);

  return (
    <section id={SECTION_ID.permitTiers} aria-labelledby={HEADING_ID} className={cn(SECTION, "gap-12")}>
      <SectionHeading
        id={HEADING_ID}
        eyebrow="Three tiers"
        title="Permit tiers"
        lead="Every event falls into one of three tiers. You do not choose one: you describe the event and the city's rules sort it, the same way every time."
      />
      <Panel variant="frosted" className="px-5 sm:px-8">
        <ul aria-label="The three permit tiers" className="flex flex-col divide-y divide-line-subtle">
          {cards.map((card) => {
            const Icon = TIER_ICON[card.tier];
            return (
              <li key={card.tier} className="grid grid-cols-1 gap-x-10 gap-y-4 py-7 md:grid-cols-[15rem_1fr]">
                <h3 className="flex items-center gap-3 self-start text-h4 font-bold text-fg">
                  <span
                    aria-hidden="true"
                    className={cn("flex size-9 shrink-0 items-center justify-center rounded-control border", TIER_TILE_CLASS[card.tier])}
                  >
                    <Icon className="size-4 stroke-[2px]" />
                  </span>
                  {TIER_LABEL[card.tier]}
                </h3>
                <div className="flex min-w-0 flex-col gap-5">
                  <p className="max-w-[68ch] text-base text-pretty text-fg-secondary">{TIER_COPY[card.tier]}</p>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <dt className={OVERLINE}>Notice needed</dt>
                      <dd className="text-base font-semibold text-fg">{plural(card.leadTimeDays, "day")}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className={OVERLINE}>Reviewed by</dt>
                      <dd className="text-base font-semibold text-fg">{card.reviewerText}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className={OVERLINE}>Typical fee</dt>
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
      </Panel>
    </section>
  );
}

export { PermitTiers };

import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "how-to-apply-heading";

/** The wizard's five questions, under the names the wizard gives them. */
const STEPS = [
  {
    title: "What are you planning?",
    body: "Choose the type of event and give it a name: a picnic, a performance, a market, a race, a block party or a class. The type sets a few defaults, such as a route map for a race.",
  },
  {
    title: "Where?",
    body: "Choose a shelter or a field, mark an area on the plaza or the Great Lawn, or select the streets you need. Each place shows whether it is available before you choose it.",
  },
  {
    title: "When?",
    body: "Set the date and times. An event can repeat weekly or every two weeks. The date is checked as you enter it: you are told if it is booked, blacked out or affected by another event nearby.",
  },
  {
    title: "How big and what's included?",
    body: "Say how many people are coming and what you need: amplified sound, alcohol, vendors, tents or city services. Each one shows its fee and which department reviews it.",
  },
  {
    title: "Your plan at a glance",
    body: "Review the tier, the permits it covers, who reviews it and the full fee estimate before you create your application.",
  },
];

/**
 * How to apply: the five wizard questions as a plain numbered list, then what happens after. An
 * ordered list with square markers, the way a city office writes out a procedure.
 */
function HowToApply() {
  return (
    <section id={SECTION_ID.howToApply} aria-labelledby={HEADING_ID} className="page-container flex scroll-mt-6 flex-col gap-6 py-6 sm:py-8">
      <SectionHeading
        id={HEADING_ID}
        title="How to apply"
        lead="The application is five questions. The tier, the permits and the fee estimate update with each answer, so you know what the event needs before you commit to it."
      />
      <ol className="flex max-w-[76ch] flex-col">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4 border-b border-line-subtle py-5 first:pt-1 sm:gap-5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-control border-2 border-ink-950 text-base font-bold text-fg"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5 pt-1">
              <h3 className="text-lg font-bold text-fg">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="text-base text-fg-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex max-w-[76ch] flex-col gap-1.5 border-l-4 border-ink-950 bg-page px-5 py-4">
        <h3 className="text-lg font-bold text-fg">After you apply</h3>
        <p className="text-base text-fg-secondary">
          Your event gets a to-do board. Every document to upload and every action to take is a card on it, with
          the reason it is needed and the date it is due.
        </p>
      </div>
    </section>
  );
}

export { HowToApply };

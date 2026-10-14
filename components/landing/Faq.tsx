import { cn } from "cn";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Panel } from "@/components/ui/panel";
import { faqItems } from "@/lib/view/landing";
import { SECTION, SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "questions-heading";

/** Common questions: an 8-item accordion on a frosted panel, answered from the PRD and the config. */
function Faq() {
  const items = faqItems();

  return (
    <section id={SECTION_ID.questions} aria-labelledby={HEADING_ID} className={cn(SECTION, "gap-12")}>
      <SectionHeading id={HEADING_ID} eyebrow="Questions" title="Common questions" />
      <Panel variant="frosted" className="max-w-[860px] p-2 sm:p-4">
        <Accordion type="single" collapsible>
          {items.map((item) => (
            <AccordionItem key={item.question} value={item.question} className="px-2">
              <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
              <AccordionContent className="max-w-[68ch] text-base">
                <p>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Panel>
    </section>
  );
}

export { Faq };

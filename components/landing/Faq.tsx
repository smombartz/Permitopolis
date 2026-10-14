import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqItems } from "@/lib/view/landing";
import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "questions-heading";

/** Common questions: an 8-item accordion, answered from the PRD and the config. */
function Faq() {
  const items = faqItems();

  return (
    <section id={SECTION_ID.questions} aria-labelledby={HEADING_ID} className="page-container flex scroll-mt-6 flex-col gap-6 py-6 sm:py-8">
      <SectionHeading id={HEADING_ID} title="Common questions" />
      <Accordion type="single" collapsible className="max-w-[76ch] border-y border-line-subtle">
        {items.map((item) => (
          <AccordionItem key={item.question} value={item.question}>
            <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
            <AccordionContent className="text-base">
              <p>{item.answer}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export { Faq };

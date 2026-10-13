import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Panel } from "@/components/ui/panel";
import { faqItems } from "@/lib/view/landing";
import { SectionHeading } from "./SectionHeading";

/** Questions (plan 7, row 9): an 8-item FAQ accordion, answered from the PRD and the config. */
function Faq() {
  const items = faqItems();

  return (
    <section id="questions" className="page-container flex flex-col gap-10 py-[var(--section-space)]">
      <SectionHeading eyebrow="Questions" title="Before you start" />
      <Panel variant="frosted" className="p-2 sm:p-4">
        <Accordion type="single" collapsible className="divide-y divide-line-subtle">
          {items.map((item) => (
            <AccordionItem key={item.question} value={item.question} className="px-2">
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
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

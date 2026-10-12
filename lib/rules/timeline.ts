/**
 * planTimeline(): milestones worked back from the event date. Instant events
 * return only event_day.
 */
import type { EventAnswers, ISODate } from "@/lib/types";
import { DEFAULT_CONFIG } from "./config";
import { dueDate } from "./shared";
import type { Classification, RulesConfig, TimelineStep } from "./types";

export const planTimeline = (a: EventAnswers, cls: Classification, today: ISODate, cfg: RulesConfig = DEFAULT_CONFIG): TimelineStep[] => {
  const eventDate = a.schedule?.date ?? today;
  const steps: TimelineStep[] = [];
  const addStep = (key: TimelineStep["key"], label: string, date: ISODate) => steps.push({ key, label, date });

  if (cls.tier === "instant") {
    addStep("event_day", "Event day", eventDate);
    return steps;
  }

  const submitBy = dueDate(eventDate, -cls.leadTimeDays, cfg);
  const reviewsDoneBy = dueDate(submitBy, cfg.sla.reviewDays[cls.tier], cfg);
  const quotePaidBy = dueDate(reviewsDoneBy, cfg.hold.daysAfterQuote, cfg);

  addStep("submit_by", "Submit by", submitBy);
  addStep("reviews_done_by", "Reviews done by", reviewsDoneBy);
  addStep("quote_paid_by", "Quote paid by", quotePaidBy);
  if (cls.tier === "special") {
    addStep("walkthrough", "Walkthrough", dueDate(eventDate, -cfg.sla.walkthroughDaysBefore, cfg));
  }
  addStep("event_day", "Event day", eventDate);

  return steps;
};

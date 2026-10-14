"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { handleRadioGroupKeyDown, radioTabIndex } from "@/components/ui/radio-keys";
import { EVENT_TYPE_LABEL, type EventAnswers, type EventType } from "@/lib/types";
import { EVENT_TYPES } from "@/lib/view/wizard";
import { EVENT_TYPE_BLURB, EVENT_TYPE_ICON } from "./constants";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface StepWhatProps {
  answers: EventAnswers;
  onChange: (patch: Partial<EventAnswers>) => void;
}

/** Step 1: the event type cards, the event name and an optional one-line description. */
function StepWhat({ answers, onChange }: StepWhatProps) {
  function selectType(type: EventType) {
    onChange({ eventType: type });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-bold text-fg">What are you planning?</h2>
        <p className="mt-1 text-sm text-fg-secondary">Pick the kind of event. It sets a few sensible defaults you can change later.</p>
      </div>

      {/* One tab stop, and the arrow keys move through the kinds: a radio group's own keyboard. */}
      <div role="radiogroup" aria-label="Event type" className="grid grid-cols-1 gap-3 sm:grid-cols-2" onKeyDown={handleRadioGroupKeyDown}>
        {EVENT_TYPES.map((type, index) => {
          const Icon = EVENT_TYPE_ICON[type];
          const selected = answers.eventType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={radioTabIndex(selected, answers.eventType !== null, index)}
              onClick={() => selectType(type)}
              className={cn(
                "flex items-start gap-3 rounded-panel border bg-surface-1 p-4 text-left transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-hover",
                FOCUS_RING,
                selected ? "border-indigo-650 bg-pill" : "border-line-subtle",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-control",
                  selected ? "bg-indigo-650 text-fg-on-accent" : "bg-surface-2 text-fg-label",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-fg">{EVENT_TYPE_LABEL[type]}</span>
                <span className="text-xs text-fg-secondary">{EVENT_TYPE_BLURB[type]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Field label="Event name" required>
        <Input
          value={answers.name}
          placeholder="Jazz in the Plaza"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <Field label="Description" hint={answers.eventType === "other" ? "Tell us what kind of event this is." : "Optional, one line."}>
        <Textarea
          value={answers.description ?? ""}
          placeholder={answers.eventType === "other" ? "A book swap and story hour for kids" : "A short description"}
          rows={2}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>
    </div>
  );
}

export { StepWhat };

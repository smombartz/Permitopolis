"use client";

import * as React from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { availability, occupiedWindow, type RulesCtx } from "@/lib/rules";
import type { Availability, EventAnswers, Location } from "@/lib/types";

export interface StepWhereProps {
  answers: EventAnswers;
  onChange: (patch: Partial<EventAnswers>) => void;
  ctx: RulesCtx;
  ignoreCaseId?: string;
}

/**
 * Step 2: the map. It opens on Bookable spaces whatever the event type (the picker is not given
 * the type), and on the value's own tab once a place is chosen. Choosing a street or route puts
 * the Street/Route closure trigger on the live result panel at once, just by changing `location`
 * (the panel recomputes classify() on every change); nothing extra is needed here for that.
 */
function StepWhere({ answers, onChange, ctx, ignoreCaseId }: StepWhereProps) {
  const schedule = answers.schedule;

  const availabilityOf = React.useCallback(
    (location: Location): Availability | undefined => {
      if (!schedule) return undefined;
      const window = occupiedWindow(schedule);
      return availability(location, { date: schedule.date, start: window.start, end: window.end }, ctx, ignoreCaseId);
    },
    [schedule, ctx, ignoreCaseId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h5 font-bold text-fg">Where?</h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Pick a bookable space, draw an area, choose street segments, or draw a route. A list under the map does the same by keyboard.
        </p>
      </div>
      <LocationPicker
        value={answers.location}
        onChange={(location) => onChange({ location })}
        availabilityOf={availabilityOf}
      />
    </div>
  );
}

export { StepWhere };

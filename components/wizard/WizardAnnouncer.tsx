"use client";

import * as React from "react";
import type { Tier } from "@/lib/types";

/** `message` once `key` has changed since the first render; empty until then. */
function useChangeAnnouncement(key: string, message: string): string {
  const previous = React.useRef(key);
  const [announcement, setAnnouncement] = React.useState("");
  React.useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    setAnnouncement(message);
  }, [key, message]);
  return announcement;
}

interface WizardAnnouncerProps {
  tier: Tier;
  /** The classification in a sentence, read out when the tier changes. */
  summary: string;
  /** `dateGateAnnouncement()`: why the date cannot stand, or empty while it can. */
  gateMessage: string;
}

/**
 * What the wizard says to a screen reader as the applicant types: a change of tier, and a
 * change at the date gate, each once and politely. Nothing on arrival.
 *
 * Both are said from here and from nowhere else. The live panel and the date gate's banner
 * show the same news, but a wide window has the two side by side (two announcements for one
 * change) and a narrow one mounts the panel only while its sheet is open (none). So those are
 * plain content, and these two lines are the announcement.
 */
function WizardAnnouncer({ tier, summary, gateMessage }: WizardAnnouncerProps) {
  const tierAnnouncement = useChangeAnnouncement(tier, summary);
  const gateAnnouncement = useChangeAnnouncement(gateMessage, gateMessage || "That date works now.");
  return (
    <>
      <span data-slot="wizard-tier-announcement" className="sr-only" role="status">
        {tierAnnouncement}
      </span>
      <span data-slot="wizard-date-announcement" className="sr-only" role="status">
        {gateAnnouncement}
      </span>
    </>
  );
}

export { WizardAnnouncer };

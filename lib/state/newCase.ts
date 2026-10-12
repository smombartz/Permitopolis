import { classify } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules/types";
import { EMPTY_ADDONS } from "@/lib/types";
import type { EventAnswers, EventCase } from "@/lib/types";
import type { StateApi } from "./types";

/**
 * Keeps a Draft's tier and triggers in step with its answers. create_board stores them when the
 * plan is confirmed; until then (and when the applicant goes back and edits) this is what makes
 * `case.tier` safe to show in a list and safe for availableActions() to branch on. The store
 * runs it on createDraft and updateDraft; the seed replay should run it on a new Draft too.
 * Anything that is not a Draft is returned unchanged.
 */
export function classifyDraft(c: EventCase, cfg?: RulesConfig): EventCase {
  if (c.state !== "draft") return c;
  const cls = classify(c, cfg);
  return { ...c, tier: cls.tier, triggers: cls.triggers };
}

/** A blank Draft: tier instant, empty collections, no ending, no date hold. */
export const newCase: StateApi["newCase"] = (args) => {
  const answers: EventAnswers = {
    eventType: null,
    name: "",
    location: null,
    schedule: null,
    attendance: null,
    addOns: EMPTY_ADDONS,
    ...args.answers,
  };
  const case_: EventCase = {
    ...answers,
    id: args.id,
    applicantId: args.applicantId,
    tier: "instant",
    triggers: [],
    state: "draft",
    ending: null,
    endingReason: null,
    dateHold: { status: "none", placedOn: null, expiresOn: null },
    reviews: [],
    tasks: [],
    conditions: [],
    feeLines: [],
    payments: [],
    activity: [],
    permit: null,
    flags: {
      sentToCommission: false,
      lateFee: false,
      signed: false,
      acceptedComplete: false,
      amendmentPending: false,
    },
    closeout: { cleanup: null, notes: "", hoursLoggedOn: null, balance: null, refund: null, feedback: null },
    wizardStep: args.wizardStep ?? "what",
    createdAt: args.createdAt,
    submittedAt: null,
    clonedFrom: null,
  };
  return case_;
};

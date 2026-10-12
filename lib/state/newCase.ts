import { EMPTY_ADDONS } from "@/lib/types";
import type { EventAnswers, EventCase } from "@/lib/types";
import type { StateApi } from "./types";

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

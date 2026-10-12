import { classify, occurrences } from "@/lib/rules";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import { EMPTY_ADDONS } from "@/lib/types";
import type { EventAnswers, EventCase } from "@/lib/types";
import type { StateApi } from "./types";

/**
 * Keeps a Draft's tier and triggers in step with its answers. create_board stores them when the
 * plan is confirmed; until then (and when the applicant goes back and edits) this is what makes
 * `case.tier` safe to show in a list and safe for availableActions() to branch on. syncDraft()
 * below runs it together with the sessions. Anything that is not a Draft is returned unchanged.
 */
export function classifyDraft(c: EventCase, cfg?: RulesConfig): EventCase {
  if (c.state !== "draft") return c;
  const cls = classify(c, cfg);
  return { ...c, tier: cls.tier, triggers: cls.triggers };
}

/**
 * Lists every session of the schedule with its availability, from the rules engine: a session
 * on a blackout date is 'skipped', so it is neither billed nor held. Whoever built the schedule
 * (the wizard, a seed script, "Book again") does not have to get this right. A session already
 * paid or due keeps its billing.
 */
export function withSessions(c: EventCase, ctx: RulesCtx): EventCase {
  if (!c.location || !c.schedule) return c;
  const billed = new Map(c.schedule.occurrences.map((o) => [o.date, o.billing]));
  const sessions = occurrences(c.schedule, c.location, ctx, c.id).map((o) => {
    const before = billed.get(o.date);
    return o.billing !== "skipped" && (before === "paid" || before === "due") ? { ...o, billing: before } : o;
  });
  return { ...c, schedule: { ...c.schedule, occurrences: sessions } };
}

/**
 * Everything a Draft derives from its answers, in one step: the sessions of its schedule, then
 * its tier and triggers. The store runs it on createDraft and on every updateDraft, and the seed
 * replay runs it on a new Draft, so fees, the date gate and a booking all count the sessions the
 * schedule has now and never a list an earlier edit left behind.
 */
export function syncDraft(c: EventCase, ctx: RulesCtx): EventCase {
  if (c.state !== "draft") return c;
  return classifyDraft(withSessions(c, ctx), ctx.cfg);
}

/** A blank Draft: tier instant, empty collections, no ending, no date hold, and its first activity entry. */
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
    activity: [{ at: args.createdAt, actor: "applicant", text: "Started a draft." }],
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

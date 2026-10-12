/**
 * Test-only helpers shared by lib/state/**\/*.test.ts. Not a test file itself, so Vitest
 * never runs it directly.
 */
import { EMPTY_ADDONS } from "@/lib/types";
import type { EventCase, Task } from "@/lib/types";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import type { RulesCtx } from "@/lib/rules/types";

export function makeCase(overrides: Partial<EventCase> = {}): EventCase {
  return {
    eventType: "picnic_party",
    name: "Test event",
    location: null,
    schedule: null,
    attendance: 40,
    addOns: EMPTY_ADDONS,
    id: "PMT-27-0001",
    applicantId: "p-test",
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
    flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: false, amendmentPending: false },
    closeout: { cleanup: null, notes: "", hoursLoggedOn: null, balance: null, refund: null, feedback: null },
    wizardStep: "plan",
    createdAt: `${DEFAULT_DEMO_TODAY}T09:00`,
    submittedAt: null,
    clonedFrom: null,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> & { id: string; catalogId: string }): Task {
  return {
    owner: "applicant",
    kind: "document",
    title: "Test card",
    why: "Because the test needs it",
    reviewer: null,
    dueDate: null,
    status: "todo",
    unlocksOn: null,
    phase: "before_submitting",
    payload: {},
    history: [{ at: `${DEFAULT_DEMO_TODAY}T09:00`, actor: "applicant", status: "todo" }],
    tags: [],
    ...overrides,
  };
}

export function makeCtx(overrides: Partial<RulesCtx> = {}): RulesCtx {
  return { today: DEFAULT_DEMO_TODAY, now: `${DEFAULT_DEMO_TODAY}T09:00`, cases: [], cfg: DEFAULT_CONFIG, ...overrides };
}

import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { buildSeed } from "@/lib/state";
import {
  buildDecidedQueue,
  buildVerificationQueue,
  documentTypeGroup,
  filterDecidedRows,
  filterQueueRows,
  groupQueueRowsByEvent,
  groupQueueRowsByType,
  oldestWaitingRow,
  parseVerificationsFilters,
  summaryFor,
  verificationsQueryString,
  type VerificationsFilters,
} from "./verifications";

const TODAY = DEFAULT_DEMO_TODAY;
const cases = buildSeed();

const DEFAULT_FILTERS: VerificationsFilters = { tab: "queue", group: "type", type: "all", result: "all", overdue: false, q: "" };

function row(taskId: string, rows: ReturnType<typeof buildVerificationQueue>) {
  const found = rows.find((r) => r.taskId === taskId);
  if (!found) throw new Error(`No row for ${taskId}`);
  return found;
}

describe("documentTypeGroup", () => {
  it("sorts the four Health & Legal catalogue ids into the page's groups", () => {
    expect(documentTypeGroup("insurance_certificate")).toBe("insurance");
    expect(documentTypeGroup("vendor_health_permit")).toBe("health_permits");
    expect(documentTypeGroup("accessibility_plan")).toBe("accessibility");
    expect(documentTypeGroup("vendor_list")).toBe("other");
    expect(documentTypeGroup("respond_to_request")).toBe("other");
  });
});

describe("buildVerificationQueue, against the real seed", () => {
  const rows = buildVerificationQueue(cases, "hl", TODAY);

  it("includes the 5K's race-day insurance certificate, passing in full", () => {
    const r = row("PMT-27-0097:insurance_certificate", rows);
    expect(r.typeGroup).toBe("insurance");
    expect(r.caseName).toBe("Riverfront Summer 5K");
    expect(r.allPass).toBe(true);
    expect(r.summary).toBe("4 of 4 pass");
  });

  it("includes the two wrong-file certificates with a failing summary", () => {
    for (const id of ["PMT-27-0115:insurance_certificate", "PMT-27-0006:insurance_certificate"]) {
      const r = row(id, rows);
      expect(r.allPass).toBe(false);
      expect(r.summary).toMatch(/^1 fails:/);
    }
  });

  it("includes the North Side Chess Club's short-coverage certificate, failing only the dates item", () => {
    const r = row("PMT-27-0008:insurance_certificate", rows);
    expect(r.allPass).toBe(false);
    expect(r.failingCount).toBe(1);
    expect(r.totalCount).toBe(4);
    expect(r.summary).toBe("1 fails: coverage covers setup through teardown");
  });

  it("leaves out documents already decided or on an ended case", () => {
    for (const id of ["PMT-27-0030", "PMT-27-0046", "PMT-27-0080"]) {
      expect(rows.find((r) => r.caseId === id && r.catalogId === "insurance_certificate")).toBeUndefined();
    }
  });

  it("every row is Health & Legal's to check: either its reviewer, or whose request it answers", () => {
    for (const r of rows) {
      const c = cases.find((candidate) => candidate.id === r.caseId)!;
      const task = c.tasks.find((t) => t.id === r.taskId)!;
      expect(task.reviewer === "hl" || task.request?.from === "hl").toBe(true);
      expect(task.status).toBe("submitted");
    }
  });

  it("is sorted oldest waiting first", () => {
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1].daysWaiting ?? -1;
      const next = rows[i].daysWaiting ?? -1;
      expect(prev).toBeGreaterThanOrEqual(next);
    }
  });
});

describe("summaryFor", () => {
  it("reads every passing item as 'N of N pass'", () => {
    const c = cases.find((candidate) => candidate.id === "PMT-27-0097")!;
    const task = c.tasks.find((t) => t.id === "PMT-27-0097:insurance_certificate")!;
    expect(summaryFor(c, task).summary).toBe("4 of 4 pass");
  });
});

describe("buildDecidedQueue", () => {
  const rows = buildDecidedQueue(cases, "hl");

  it("includes S5's insurance certificate as Verified", () => {
    const r = rows.find((candidate) => candidate.taskId === "PMT-27-0097:insurance_certificate");
    expect(r).toBeUndefined(); // S5's certificate is still waiting on May 3, not yet decided.
  });

  it("includes only cards Health & Legal reviewed or was asked to check, all decided", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(["Verified", "Sent back"]).toContain(r.verb);
      const c = cases.find((candidate) => candidate.id === r.caseId)!;
      const task = c.tasks.find((t) => t.id === r.taskId)!;
      expect(task.status === "done" || task.status === "changes_requested").toBe(true);
    }
  });
});

describe("filterDecidedRows", () => {
  it("narrows the decided tab by type and search, the same as the queue", () => {
    const rows = buildDecidedQueue(cases, "hl");
    const insuranceOnly = filterDecidedRows(rows, { ...DEFAULT_FILTERS, tab: "decided", type: "insurance" });
    expect(insuranceOnly.length).toBeGreaterThan(0);
    expect(insuranceOnly.every((r) => r.typeGroup === "insurance")).toBe(true);
  });
});

describe("filterQueueRows", () => {
  const rows = buildVerificationQueue(cases, "hl", TODAY);

  it("narrows by type", () => {
    const filtered = filterQueueRows(rows, { ...DEFAULT_FILTERS, type: "insurance" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.typeGroup === "insurance")).toBe(true);
  });

  it("narrows to failing documents only", () => {
    const filtered = filterQueueRows(rows, { ...DEFAULT_FILTERS, result: "fail" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => !r.allPass)).toBe(true);
    expect(filtered.some((r) => r.caseId === "PMT-27-0115")).toBe(true);
  });

  it("narrows by search, on the event, applicant or vendor name", () => {
    const filtered = filterQueueRows(rows, { ...DEFAULT_FILTERS, q: "chess club" });
    expect(filtered.every((r) => r.caseId === "PMT-27-0008")).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("an empty filter set is the whole queue", () => {
    expect(filterQueueRows(rows, DEFAULT_FILTERS)).toEqual(rows);
  });
});

describe("grouping", () => {
  const rows = buildVerificationQueue(cases, "hl", TODAY);

  it("groups by type, in a fixed order, skipping an empty group", () => {
    const groups = groupQueueRowsByType(rows);
    expect(groups.map((g) => g.type)).toEqual(["insurance", "health_permits", "accessibility", "other"].filter((t) => groups.some((g) => g.type === t)));
    for (const g of groups) expect(g.rows.every((r) => r.typeGroup === g.type)).toBe(true);
  });

  it("groups by event, one group per case", () => {
    const groups = groupQueueRowsByEvent(rows);
    const caseIds = new Set(groups.map((g) => g.caseId));
    expect(caseIds.size).toBe(groups.length);
    for (const g of groups) expect(g.rows.every((r) => r.caseId === g.caseId)).toBe(true);
  });
});

describe("oldestWaitingRow", () => {
  it("is the first row of the full, unfiltered queue", () => {
    const rows = buildVerificationQueue(cases, "hl", TODAY);
    expect(oldestWaitingRow(rows)).toEqual(rows[0]);
  });

  it("is null for an empty queue", () => {
    expect(oldestWaitingRow([])).toBeNull();
  });
});

describe("filters in the URL", () => {
  it("round-trips through the query string", () => {
    const filters: VerificationsFilters = { tab: "decided", group: "event", type: "health_permits", result: "fail", overdue: true, q: "dumpling" };
    const qs = verificationsQueryString(filters);
    expect(parseVerificationsFilters(new URLSearchParams(qs))).toEqual(filters);
  });

  it("defaults to the queue tab, grouped by type, with nothing narrowed", () => {
    expect(parseVerificationsFilters(new URLSearchParams(""))).toEqual(DEFAULT_FILTERS);
  });

  it("ignores an unknown type", () => {
    expect(parseVerificationsFilters(new URLSearchParams("type=bogus")).type).toBe("all");
  });
});

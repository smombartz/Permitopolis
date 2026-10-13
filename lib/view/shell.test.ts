import { describe, expect, it } from "vitest";
import { makeCase } from "@/lib/state/testSupport";
import { routes } from "@/lib/routes";
import { applicantCaseIdFromHref, caseIdFromPath, cityToolLinks, pathForCase, pathForPersona, resolveRoleSwitch } from "./shell";

describe("caseIdFromPath", () => {
  it("reads a case id off an applicant event page and its subpages", () => {
    expect(caseIdFromPath("/events/PMT-27-0118", "applicant")).toBe("PMT-27-0118");
    expect(caseIdFromPath("/events/PMT-27-0118/quote", "applicant")).toBe("PMT-27-0118");
    expect(caseIdFromPath("/events/PMT-27-0118/permit", "applicant")).toBe("PMT-27-0118");
    expect(caseIdFromPath("/events/PMT-27-0118/amend", "applicant")).toBe("PMT-27-0118");
  });

  it("reads a case id off a city case page and its tabs", () => {
    expect(caseIdFromPath("/city/cases/PMT-27-0097", "clerk")).toBe("PMT-27-0097");
    expect(caseIdFromPath("/city/cases/PMT-27-0097?tab=reviews", "clerk")).toBe("PMT-27-0097");
  });

  it("is null off any other page, including the city cases list", () => {
    expect(caseIdFromPath("/events", "applicant")).toBeNull();
    expect(caseIdFromPath("/city/cases", "clerk")).toBeNull();
    expect(caseIdFromPath("/city/queue", "pws")).toBeNull();
    expect(caseIdFromPath("/apply", "applicant")).toBeNull();
  });

  it("looks at the applicant's own route even when asked for a city case id, and vice versa", () => {
    // Asking with the wrong role's pattern never matches the other role's path shape.
    expect(caseIdFromPath("/events/PMT-27-0118", "clerk")).toBeNull();
    expect(caseIdFromPath("/city/cases/PMT-27-0097", "applicant")).toBeNull();
  });
});

describe("applicantCaseIdFromHref", () => {
  it("reads the case off an event page, its subpages, and the wizard reopened on a draft", () => {
    expect(applicantCaseIdFromHref("/events/PMT-27-0118")).toBe("PMT-27-0118");
    expect(applicantCaseIdFromHref("/events/PMT-27-0118/quote")).toBe("PMT-27-0118");
    expect(applicantCaseIdFromHref("/events/PMT-27-0118?card=PMT-27-0118:pay_fees")).toBe("PMT-27-0118");
    expect(applicantCaseIdFromHref(routes.apply({ caseId: "PMT-27-0142", step: "when" }))).toBe("PMT-27-0142");
  });

  it("is null for My events, a blank wizard and any city page", () => {
    expect(applicantCaseIdFromHref("/events")).toBeNull();
    expect(applicantCaseIdFromHref("/apply")).toBeNull();
    expect(applicantCaseIdFromHref("/apply?step=where")).toBeNull();
    expect(applicantCaseIdFromHref("/city/cases/PMT-27-0097")).toBeNull();
  });
});

describe("pathForCase", () => {
  it("builds the applicant's event board path", () => {
    expect(pathForCase("applicant", "PMT-27-0118")).toBe(routes.event("PMT-27-0118"));
  });

  it("builds a city case path for every city role", () => {
    expect(pathForCase("clerk", "PMT-27-0097")).toBe(routes.city.case("PMT-27-0097"));
    expect(pathForCase("pws", "PMT-27-0097")).toBe(routes.city.case("PMT-27-0097"));
    expect(pathForCase("hl", "PMT-27-0097")).toBe(routes.city.case("PMT-27-0097"));
  });
});

describe("resolveRoleSwitch", () => {
  const cases = [
    makeCase({ id: "PMT-27-0118", applicantId: "downtown-arts-collective", state: "needs_info" }),
    makeCase({ id: "PMT-27-0142", applicantId: "sunrise-yoga-club", state: "draft", wizardStep: "when" }),
  ];

  it("keeps the current path when the role does not change", () => {
    expect(
      resolveRoleSwitch({
        fromRole: "clerk",
        toRole: "clerk",
        pathname: "/city/cases/PMT-27-0097",
        cases,
        lastPathByRole: {},
      }),
    ).toEqual({ path: "/city/cases/PMT-27-0097" });
  });

  it("keeps the URL when switching between two city roles, case page or not", () => {
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/city/cases/PMT-27-0118", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/cases/PMT-27-0118" });
    expect(
      resolveRoleSwitch({ fromRole: "hl", toRole: "clerk", pathname: "/city/queue", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/queue" });
  });

  it("follows a case from the applicant's board to the matching city role, with no persona to set", () => {
    expect(
      resolveRoleSwitch({ fromRole: "applicant", toRole: "clerk", pathname: "/events/PMT-27-0118/quote", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/cases/PMT-27-0118" });
  });

  it("follows a case from a city role to the applicant, and sets that case's own persona", () => {
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "applicant", pathname: "/city/cases/PMT-27-0118", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/events/PMT-27-0118", personaId: "downtown-arts-collective" });
  });

  it("falls back to the role's remembered path off a case page", () => {
    expect(
      resolveRoleSwitch({
        fromRole: "applicant",
        toRole: "clerk",
        pathname: "/events",
        cases,
        lastPathByRole: { clerk: "/city/cases?tier=special" },
      }),
    ).toEqual({ path: "/city/cases?tier=special" });
  });

  it("falls back to the role's home with nothing remembered", () => {
    expect(
      resolveRoleSwitch({ fromRole: "applicant", toRole: "hl", pathname: "/apply", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/queue" });
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "applicant", pathname: "/city/queue", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/events" });
  });

  it("does not follow a Draft to the city: it is the applicant's alone", () => {
    expect(
      resolveRoleSwitch({ fromRole: "applicant", toRole: "clerk", pathname: "/events/PMT-27-0142", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/queue" });
    expect(
      resolveRoleSwitch({
        fromRole: "applicant",
        toRole: "pws",
        pathname: "/events/PMT-27-0142",
        cases,
        lastPathByRole: { pws: "/city/work-orders" },
      }),
    ).toEqual({ path: "/city/work-orders" });
  });

  it("follows a Draft back to the applicant all the same (a typed-in city URL)", () => {
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "applicant", pathname: "/city/cases/PMT-27-0142", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/events/PMT-27-0142", personaId: "sunrise-yoga-club" });
  });

  it("returns to the applicant's remembered page with that page's own persona", () => {
    // Left on the Arts Collective's quote, then a scenario jump picked another organizer.
    expect(
      resolveRoleSwitch({
        fromRole: "clerk",
        toRole: "applicant",
        pathname: "/city/queue",
        cases,
        lastPathByRole: { applicant: "/events/PMT-27-0118/quote" },
      }),
    ).toEqual({ path: "/events/PMT-27-0118/quote", personaId: "downtown-arts-collective" });
    // The wizard, reopened on a draft: the step in the query string comes back too.
    expect(
      resolveRoleSwitch({
        fromRole: "hl",
        toRole: "applicant",
        pathname: "/city/verifications",
        cases,
        lastPathByRole: { applicant: "/apply?case=PMT-27-0142&step=size" },
      }),
    ).toEqual({ path: "/apply?case=PMT-27-0142&step=size", personaId: "sunrise-yoga-club" });
  });

  it("leaves the persona alone when the remembered applicant page is not about a case", () => {
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "applicant", pathname: "/city/queue", cases, lastPathByRole: { applicant: "/events" } }),
    ).toEqual({ path: "/events" });
  });

  it("goes home when the remembered applicant page is about a case that no longer exists", () => {
    expect(
      resolveRoleSwitch({
        fromRole: "clerk",
        toRole: "applicant",
        pathname: "/city/queue",
        cases,
        lastPathByRole: { applicant: "/events/PMT-27-9999" },
      }),
    ).toEqual({ path: "/events" });
  });

  it("falls back when the case on screen does not exist (a stale or typed-in id)", () => {
    expect(
      resolveRoleSwitch({
        fromRole: "applicant",
        toRole: "clerk",
        pathname: "/events/PMT-27-9999",
        cases,
        lastPathByRole: {},
      }),
    ).toEqual({ path: "/city/queue" });
  });
});

describe("pathForPersona", () => {
  const cases = [
    makeCase({ id: "PMT-27-0109", applicantId: "maya-chen", state: "permitted" }),
    makeCase({ id: "PMT-27-0142", applicantId: "sunrise-yoga-club", state: "draft", wizardStep: "when" }),
    makeCase({ id: "PMT-27-0150", applicantId: "two-events", state: "draft", wizardStep: "what" }),
    makeCase({ id: "PMT-27-0151", applicantId: "two-events", state: "submitted" }),
  ];

  it("starts the wizard for someone with no event yet", () => {
    expect(pathForPersona("new", cases)).toBe("/apply");
  });

  it("reopens the wizard where it was left for someone whose only event is a draft", () => {
    expect(pathForPersona("sunrise-yoga-club", cases)).toBe("/apply?case=PMT-27-0142&step=when");
  });

  it("opens My events for everyone else", () => {
    expect(pathForPersona("maya-chen", cases)).toBe("/events");
    expect(pathForPersona("two-events", cases)).toBe("/events");
  });
});

describe("cityToolLinks", () => {
  it("gives the City Clerk intake, payments and settings", () => {
    expect(cityToolLinks("clerk").map((l) => l.label)).toEqual(["Intake", "Payments", "Settings"]);
  });

  it("gives Public Works & Safety closures/routes and work orders", () => {
    expect(cityToolLinks("pws").map((l) => l.label)).toEqual(["Closures and routes", "Work orders"]);
  });

  it("gives Health & Legal verifications and inspections", () => {
    expect(cityToolLinks("hl").map((l) => l.label)).toEqual(["Verifications", "Inspections"]);
  });
});

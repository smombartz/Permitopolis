import { describe, expect, it } from "vitest";
import { makeCase } from "@/lib/state/testSupport";
import { routes } from "@/lib/routes";
import { PICKABLE_PERSONA_IDS } from "@/lib/data/people";
import {
  actingAsName,
  applicantCaseIdFromHref,
  applicantLanding,
  caseIdFromPath,
  cityPageIsFor,
  cityToolLinks,
  cityToolOwner,
  pageIsFor,
  pathForCase,
  pathForPersona,
  resolvePersonaPick,
  resolveRoleSwitch,
  userMenuPersonaIds,
} from "./shell";

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

  it("keeps the URL when switching between two city roles on a shared page, case page or not", () => {
    expect(
      resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/city/cases/PMT-27-0118", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/cases/PMT-27-0118" });
    expect(
      resolveRoleSwitch({ fromRole: "hl", toRole: "clerk", pathname: "/city/queue", cases, lastPathByRole: {} }),
    ).toEqual({ path: "/city/queue" });
  });

  it("keeps the URL on every page the city roles share: My queue, Cases, a case and Active permits", () => {
    for (const pathname of ["/city/queue", "/city/cases", "/city/cases/PMT-27-0118", "/city/active"]) {
      for (const [fromRole, toRole] of [["clerk", "pws"], ["pws", "hl"], ["hl", "clerk"]] as const) {
        expect(resolveRoleSwitch({ fromRole, toRole, pathname, cases, lastPathByRole: { [toRole]: "/city/cases?tier=special" } }), `${fromRole} to ${toRole} on ${pathname}`).toEqual({ path: pathname });
      }
    }
  });

  it("does not take a role onto another role's tool page: path 4's last step leaves the Clerk's Intake for the queue", () => {
    // The Clerk confirmed routing from Intake, then switches to Public Works & Safety.
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/city/intake", cases, lastPathByRole: {} })).toEqual({ path: "/city/queue" });
    // With a page of its own remembered, the role goes back to that, query string included.
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/city/intake", cases, lastPathByRole: { pws: "/city/cases?waiting=me" } })).toEqual({ path: "/city/cases?waiting=me" });
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/city/payments", cases, lastPathByRole: { pws: "/city/work-orders" } })).toEqual({ path: "/city/work-orders" });
    // Every tool page, to every role that does not own it.
    const tools: Record<string, string> = { "/city/intake": "clerk", "/city/payments": "clerk", "/city/settings": "clerk", "/city/map": "pws", "/city/work-orders": "pws", "/city/verifications": "hl", "/city/inspections": "hl" };
    for (const [pathname, owner] of Object.entries(tools)) {
      for (const toRole of ["clerk", "pws", "hl"] as const) {
        const fromRole = toRole === "clerk" ? "pws" : "clerk";
        expect(resolveRoleSwitch({ fromRole, toRole, pathname, cases, lastPathByRole: {} }), `${pathname} to ${toRole}`).toEqual({ path: toRole === owner ? pathname : "/city/queue" });
      }
    }
  });

  it("never lands a role on another role's tool page from memory either", () => {
    // A remembered page that is not the role's own (stored before the rule, or typed in) is passed over.
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "hl", pathname: "/city/intake", cases, lastPathByRole: { hl: "/city/work-orders" } })).toEqual({ path: "/city/queue" });
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "pws", pathname: "/events", cases, lastPathByRole: { pws: "/city/intake?tab=special" } })).toEqual({ path: "/city/queue" });
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "clerk", pathname: "/events", cases, lastPathByRole: { clerk: "/city/intake?tab=special" } })).toEqual({ path: "/city/intake?tab=special" });
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

describe("resolveRoleSwitch, on a page opened under the wrong role", () => {
  const cases = [
    makeCase({ id: "PMT-27-0097", applicantId: "riverfront-running-club", state: "quote_sent" }),
    makeCase({ id: "PMT-27-0142", applicantId: "sunrise-yoga-club", state: "draft", wizardStep: "when" }),
  ];
  const remembered = { clerk: "/city/cases?tier=special", pws: "/city/work-orders", hl: "/city/verifications", applicant: "/events" };

  it("the Applicant on a city case: each city role stays on that case, whatever it remembers", () => {
    for (const toRole of ["clerk", "pws", "hl"] as const) {
      expect(resolveRoleSwitch({ fromRole: "applicant", toRole, pathname: "/city/cases/PMT-27-0097", cases, lastPathByRole: remembered })).toEqual({ path: "/city/cases/PMT-27-0097" });
    }
  });

  it("the Applicant on a shared city list stays there too", () => {
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "hl", pathname: "/city/active", cases, lastPathByRole: remembered })).toEqual({ path: "/city/active" });
  });

  it("the Applicant on a tool page: its owner stays, another role goes to its own last page", () => {
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "clerk", pathname: "/city/intake", cases, lastPathByRole: remembered })).toEqual({ path: "/city/intake" });
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "pws", pathname: "/city/intake", cases, lastPathByRole: remembered })).toEqual({ path: "/city/work-orders" });
    expect(resolveRoleSwitch({ fromRole: "applicant", toRole: "hl", pathname: "/city/intake", cases, lastPathByRole: {} })).toEqual({ path: "/city/queue" });
  });

  it("a city role on an event page: the Applicant stays on it, as that event's own applicant", () => {
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "applicant", pathname: "/events/PMT-27-0097/quote", cases, lastPathByRole: remembered })).toEqual({
      path: "/events/PMT-27-0097/quote",
      personaId: "riverfront-running-club",
    });
    // My events is about nobody's case, and an unknown id is the page's own to explain.
    expect(resolveRoleSwitch({ fromRole: "pws", toRole: "applicant", pathname: "/events", cases, lastPathByRole: {} })).toEqual({ path: "/events" });
    expect(resolveRoleSwitch({ fromRole: "pws", toRole: "applicant", pathname: "/events/PMT-27-9999", cases, lastPathByRole: remembered })).toEqual({ path: "/events/PMT-27-9999" });
  });

  it("a city role on the wizard: the Applicant stays, as the draft's owner when the link names one", () => {
    expect(resolveRoleSwitch({ fromRole: "hl", toRole: "applicant", pathname: "/apply", search: "?case=PMT-27-0142&step=when", cases, lastPathByRole: remembered })).toEqual({
      path: "/apply",
      personaId: "sunrise-yoga-club",
    });
    expect(resolveRoleSwitch({ fromRole: "hl", toRole: "applicant", pathname: "/apply", cases, lastPathByRole: remembered })).toEqual({ path: "/apply" });
  });

  it("between two city roles on an event page nothing moves: the page still asks for the Applicant", () => {
    expect(resolveRoleSwitch({ fromRole: "clerk", toRole: "pws", pathname: "/events/PMT-27-0097", cases, lastPathByRole: {} })).toEqual({ path: "/events/PMT-27-0097" });
  });
});

describe("pageIsFor", () => {
  it("the wizard and the event pages are the Applicant's; city pages are a city role's, tools by owner", () => {
    for (const path of ["/apply", "/events", "/events/PMT-27-0097", "/events/PMT-27-0097/quote?pay=final"]) {
      expect(pageIsFor("applicant", path), path).toBe(true);
      expect(pageIsFor("clerk", path), path).toBe(false);
    }
    for (const path of ["/city/queue", "/city/cases?tier=special", "/city/cases/PMT-27-0097", "/city/active"]) {
      expect(pageIsFor("applicant", path), path).toBe(false);
      for (const role of ["clerk", "pws", "hl"] as const) expect(pageIsFor(role, path), `${role} ${path}`).toBe(true);
    }
    expect(pageIsFor("clerk", "/city/intake")).toBe(true);
    expect(pageIsFor("pws", "/city/intake")).toBe(false);
  });

  it("the landing page, the demo guide and the public check are nobody's", () => {
    for (const path of ["/", "/demo", "/verify/PMT-27-0109"]) {
      for (const role of ["applicant", "clerk", "pws", "hl"] as const) expect(pageIsFor(role, path), `${role} ${path}`).toBe(false);
    }
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

describe("the user menu: who is acting, who it offers, and where a pick lands", () => {
  const cases = [
    makeCase({ id: "PMT-27-0097", applicantId: "riverfront-running-club", state: "quote_sent" }),
    makeCase({ id: "PMT-27-0109", applicantId: "maya-chen", state: "permitted" }),
    makeCase({ id: "PMT-27-0121", applicantId: "downtown-art-walk-committee", state: "in_review" }),
    makeCase({ id: "PMT-27-0142", applicantId: "sunrise-yoga-club", state: "draft", wizardStep: "when" }),
  ];

  it("names a city role by its label and the Applicant by the persona", () => {
    expect(actingAsName("clerk", "maya-chen")).toBe("City Clerk");
    expect(actingAsName("pws", "new")).toBe("Public Works & Safety");
    expect(actingAsName("applicant", "maya-chen")).toBe("Maya Chen");
    expect(actingAsName("applicant", "new")).toBe("New applicant");
    expect(actingAsName("applicant", "nobody-in-the-data")).toBe("New applicant");
  });

  it("the Applicant lands as itself, where it is", () => {
    expect(applicantLanding({ fromRole: "applicant", personaId: "maya-chen", pathname: "/events/PMT-27-0109", cases, lastPathByRole: {} })).toEqual({
      personaId: "maya-chen",
      path: "/events/PMT-27-0109",
    });
  });

  it("a city role on a case lands as that case's organizer, on its board", () => {
    expect(applicantLanding({ fromRole: "clerk", personaId: "maya-chen", pathname: "/city/cases/PMT-27-0097", cases, lastPathByRole: {} })).toEqual({
      personaId: "riverfront-running-club",
      path: "/events/PMT-27-0097",
    });
  });

  it("off a case, a city role lands on the remembered applicant page as its organizer, then as the last applicant used", () => {
    expect(
      applicantLanding({ fromRole: "hl", personaId: "new", pathname: "/city/queue", cases, lastPathByRole: { applicant: "/events/PMT-27-0109/permit" } }),
    ).toEqual({ personaId: "maya-chen", path: "/events/PMT-27-0109/permit" });
    expect(applicantLanding({ fromRole: "hl", personaId: "maya-chen", pathname: "/city/queue", cases, lastPathByRole: {} })).toEqual({
      personaId: "maya-chen",
      path: "/events",
    });
  });

  it("offers the six scenario organizers and New applicant, with a landing applicant outside them first", () => {
    expect(userMenuPersonaIds("maya-chen")).toEqual(PICKABLE_PERSONA_IDS);
    expect(userMenuPersonaIds("new")).toEqual(PICKABLE_PERSONA_IDS);
    expect(userMenuPersonaIds("downtown-art-walk-committee")).toEqual(["downtown-art-walk-committee", ...PICKABLE_PERSONA_IDS]);
    // Someone the data does not know has no name to show: not offered.
    expect(userMenuPersonaIds("nobody-in-the-data")).toEqual(PICKABLE_PERSONA_IDS);
  });

  it("from a city role, picking the landing applicant follows the case; picking anyone else opens their own page", () => {
    const landing = applicantLanding({ fromRole: "clerk", personaId: "maya-chen", pathname: "/city/cases/PMT-27-0097", cases, lastPathByRole: {} });
    expect(resolvePersonaPick({ picked: "riverfront-running-club", fromRole: "clerk", landing, cases })).toBe("/events/PMT-27-0097");
    expect(resolvePersonaPick({ picked: "maya-chen", fromRole: "clerk", landing, cases })).toBe("/events");
    expect(resolvePersonaPick({ picked: "sunrise-yoga-club", fromRole: "clerk", landing, cases })).toBe("/apply?case=PMT-27-0142&step=when");
    expect(resolvePersonaPick({ picked: "new", fromRole: "clerk", landing, cases })).toBe("/apply");
  });

  it("from a city role, the landing applicant comes back to the remembered page", () => {
    const lastPathByRole = { applicant: "/events/PMT-27-0109/permit" };
    const landing = applicantLanding({ fromRole: "pws", personaId: "new", pathname: "/city/active", cases, lastPathByRole });
    expect(resolvePersonaPick({ picked: "maya-chen", fromRole: "pws", landing, cases })).toBe("/events/PMT-27-0109/permit");
  });

  it("a landing that is only the Applicant's home starts on the applicant's own page: New applicant gets a blank wizard", () => {
    const landing = applicantLanding({ fromRole: "clerk", personaId: "new", pathname: "/city/settings", cases, lastPathByRole: {} });
    expect(landing).toEqual({ personaId: "new", path: "/events" });
    expect(resolvePersonaPick({ picked: "new", fromRole: "clerk", landing, cases })).toBe("/apply");
  });

  it("as the Applicant, a pick always opens that applicant's own page, even their own name on a case", () => {
    const landing = applicantLanding({ fromRole: "applicant", personaId: "maya-chen", pathname: "/events/PMT-27-0109", cases, lastPathByRole: {} });
    expect(resolvePersonaPick({ picked: "maya-chen", fromRole: "applicant", landing, cases })).toBe("/events");
    expect(resolvePersonaPick({ picked: "riverfront-running-club", fromRole: "applicant", landing, cases })).toBe("/events");
  });
});

describe("cityToolOwner and cityPageIsFor (the PRD's route map)", () => {
  it("names the one role each tool page belongs to, with or without a query string", () => {
    expect(["/city/intake", "/city/intake?tab=reviewed", "/city/payments", "/city/settings"].map(cityToolOwner)).toEqual(["clerk", "clerk", "clerk", "clerk"]);
    expect(["/city/map", "/city/work-orders"].map(cityToolOwner)).toEqual(["pws", "pws"]);
    expect(["/city/verifications", "/city/inspections"].map(cityToolOwner)).toEqual(["hl", "hl"]);
  });

  it("is null for the shared city pages and for everything outside the city area", () => {
    for (const path of ["/city/queue", "/city/cases", "/city/cases/PMT-27-0097?tab=reviews", "/city/active?view=map", "/events", "/apply", "/"]) {
      expect(cityToolOwner(path), path).toBeNull();
    }
  });

  it("a role has the shared pages and its own tools, and nobody else's", () => {
    expect(cityPageIsFor("pws", "/city/queue")).toBe(true);
    expect(cityPageIsFor("pws", "/city/work-orders")).toBe(true);
    expect(cityPageIsFor("pws", "/city/intake")).toBe(false);
    expect(cityPageIsFor("hl", "/city/map")).toBe(false);
    expect(cityPageIsFor("clerk", "/city/settings")).toBe(true);
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

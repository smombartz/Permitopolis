import { describe, expect, it } from "vitest";
import { homeFor, routes } from "./routes";

describe("routes", () => {
  it("builds the PRD's route map", () => {
    expect(routes.home()).toBe("/");
    expect(routes.apply()).toBe("/apply");
    expect(routes.apply({ caseId: "PMT-27-0142", step: "when" })).toBe("/apply?case=PMT-27-0142&step=when");
    expect(routes.event("PMT-27-0118")).toBe("/events/PMT-27-0118");
    expect(routes.quote("PMT-27-0097")).toBe("/events/PMT-27-0097/quote");
    expect(routes.quote("PMT-27-0142", { pay: "session", date: "2027-06-13" })).toBe(
      "/events/PMT-27-0142/quote?pay=session&date=2027-06-13",
    );
    expect(routes.quote("PMT-27-0031", { pay: "final" })).toBe("/events/PMT-27-0031/quote?pay=final");
    expect(routes.permit("PMT-27-0109")).toBe("/events/PMT-27-0109/permit");
    expect(routes.verify("PMT-27-0109")).toBe("/verify/PMT-27-0109");
    expect(routes.city.queue()).toBe("/city/queue");
    expect(routes.city.case("PMT-27-0097", { task: "PMT-27-0097:verify_document" })).toBe(
      "/city/cases/PMT-27-0097?task=PMT-27-0097%3Averify_document",
    );
    expect(routes.city.cases({ tier: "special", waiting: "me" })).toBe("/city/cases?tier=special&waiting=me");
    expect(routes.city.active({ view: "calendar" })).toBe("/city/active?view=calendar");
  });

  it("sends each role home", () => {
    expect(homeFor("applicant")).toBe("/events");
    expect(homeFor("clerk")).toBe("/city/queue");
    expect(homeFor("hl")).toBe("/city/queue");
  });
});

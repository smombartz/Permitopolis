import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { planTimeline } from "./timeline";
import { answers, addOns, areaLocation, inventoryLocation, routeLocation, schedule } from "./test-helpers";
import { RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";

describe("planTimeline", () => {
  it("Instant returns only event_day", () => {
    const a = answers({ location: inventoryLocation(["shelter-3"]), schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }) });
    const cls = classify(a);
    const steps = planTimeline(a, cls, "2027-05-03");
    expect(steps.map((s) => s.key)).toEqual(["event_day"]);
    expect(steps[0].date).toBe("2027-05-22");
  });

  it("Standard returns submit_by, reviews_done_by, quote_paid_by and event_day, in order", () => {
    const a = answers({ location: areaLocation("city-hall-plaza"), schedule: schedule({ date: "2027-06-18", start: "18:00", end: "21:00" }), attendance: 150 });
    const cls = classify(a);
    const steps = planTimeline(a, cls, "2027-04-01");
    expect(steps.map((s) => s.key)).toEqual(["submit_by", "reviews_done_by", "quote_paid_by", "event_day"]);
    const dates = steps.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("Special also gets a walkthrough milestone before the event", () => {
    const a = answers({
      location: routeLocation(RIVERFRONT_5K_ROUTE, { miles: 3.1 }),
      schedule: schedule({ date: "2027-07-11", start: "07:00", end: "11:00" }),
      attendance: 1200,
      addOns: addOns({ amplifiedSound: true }),
    });
    const cls = classify(a);
    const steps = planTimeline(a, cls, "2027-02-01");
    expect(steps.map((s) => s.key)).toEqual(["submit_by", "reviews_done_by", "quote_paid_by", "walkthrough", "event_day"]);
    const walkthrough = steps.find((s) => s.key === "walkthrough")!;
    expect(walkthrough.date < "2027-07-11").toBe(true);
  });
});

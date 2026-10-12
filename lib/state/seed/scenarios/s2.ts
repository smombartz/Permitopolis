/**
 * S2 · Sunrise Yoga Club weekly class. Instant (13-session series), Draft: the applicant is
 * mid-wizard, just past "when", with no steps at all.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, weeklySchedule } from "../helpers";

const answers: EventAnswers = {
  eventType: "class_meetup",
  name: "Sunrise Yoga Club weekly class",
  location: inventoryLocation(["field-4"]),
  schedule: weeklySchedule("2027-06-06", "08:00", "09:00", "2027-08-29"),
  attendance: 20,
  addOns: addOns({}),
};

export const S2: SeedScript = {
  id: "PMT-27-0142",
  key: "S2",
  applicantId: "sunrise-yoga-club",
  createdAt: "2027-05-03T07:40",
  answers,
  wizardStep: "when",
  steps: [],
  expect: { tier: "instant", state: "draft" },
  notes: "Reserved: Field 4 every Sunday Jun 6-Aug 29 is off-limits to every other seed case.",
};

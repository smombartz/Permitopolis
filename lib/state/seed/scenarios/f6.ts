/**
 * F6 · Little League Opening Day. Instant, Permitted. 90 people keeps it under the Reviewed
 * threshold (plan 3.3 fix).
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, singleSchedule, step } from "../helpers";

const CASE_ID = "PMT-27-0010";

const answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Little League Opening Day",
  description: "Opening day ceremony and first games of the season.",
  location: inventoryLocation(["field-1", "field-2"]),
  schedule: singleSchedule("2027-05-15", "09:00", "15:00"),
  attendance: 90,
  addOns: addOns({}),
};

export const F6: SeedScript = {
  id: CASE_ID,
  key: "F6",
  applicantId: "permitopolis-little-league",
  createdAt: "2027-04-20T09:00",
  answers,
  steps: [
    step("2027-04-20T09:00", "applicant", { type: "create_board" }),
    step("2027-04-20T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "permitted" },
};

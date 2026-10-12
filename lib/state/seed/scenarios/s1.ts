/**
 * S1 · Maya Chen's 40th birthday picnic. Instant, Permitted: booked and paid Apr 26.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, singleSchedule, step } from "../helpers";

const answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Maya Chen's 40th birthday picnic",
  description: "A birthday picnic for family and friends.",
  location: inventoryLocation(["shelter-3"]),
  schedule: singleSchedule("2027-05-22", "11:00", "16:00"),
  attendance: 45,
  addOns: addOns({}),
};

export const S1: SeedScript = {
  id: "PMT-27-0109",
  key: "S1",
  applicantId: "maya-chen",
  createdAt: "2027-04-26T09:00",
  answers,
  steps: [
    step("2027-04-26T09:00", "applicant", { type: "create_board" }),
    step("2027-04-26T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "permitted" },
  notes: "Demo path 7 (amend) starts here in P1.",
};

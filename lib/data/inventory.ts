/**
 * Permitopolis places. Fictional; capacities and rates are placeholders for the demo.
 * Reference data, FROZEN after Phase 0: ids are used by the seed, the map and the rules.
 */

export type SpaceKind = "shelter" | "field" | "plaza" | "open_area";
export type Zone = "riverside-park" | "great-lawn" | "downtown";

export interface Space {
  id: string;
  kind: SpaceKind;
  /** e.g. "Shelter 3". */
  name: string;
  /** e.g. "Shelter 3, Riverside Park". */
  label: string;
  zone: Zone;
  /** Counts as a park for park-wide blackout dates. */
  isPark: boolean;
  /** Bookable spaces: people. */
  capacity?: number;
  /** Plazas and open areas: total drawable area. */
  squareFeet?: number;
  /** Plazas and open areas: hard cap whatever area is drawn. */
  maxPeople?: number;
  rate: { amount: number; per: "hour" | "day" };
  amenities: string[];
  /** Street names that give access; an impacted street impacts the space. */
  accessVia: string[];
}

export const SPACES: Space[] = [
  {
    id: "shelter-1",
    kind: "shelter",
    name: "Shelter 1",
    label: "Shelter 1, Riverside Park",
    zone: "riverside-park",
    isPark: true,
    capacity: 30,
    rate: { amount: 25, per: "hour" },
    amenities: ["4 picnic tables", "Charcoal grill"],
    accessVia: ["River Road"],
  },
  {
    id: "shelter-2",
    kind: "shelter",
    name: "Shelter 2",
    label: "Shelter 2, Riverside Park",
    zone: "riverside-park",
    isPark: true,
    capacity: 40,
    rate: { amount: 25, per: "hour" },
    amenities: ["6 picnic tables", "Charcoal grill", "Water tap"],
    accessVia: ["River Road"],
  },
  {
    id: "shelter-3",
    kind: "shelter",
    name: "Shelter 3",
    label: "Shelter 3, Riverside Park",
    zone: "riverside-park",
    isPark: true,
    capacity: 60,
    rate: { amount: 25, per: "hour" },
    amenities: ["8 picnic tables", "2 charcoal grills", "Water tap", "Power outlet"],
    accessVia: ["River Road"],
  },
  {
    id: "shelter-4",
    kind: "shelter",
    name: "Shelter 4",
    label: "Shelter 4, Riverside Park",
    zone: "riverside-park",
    isPark: true,
    capacity: 120,
    rate: { amount: 25, per: "hour" },
    amenities: ["16 picnic tables", "4 charcoal grills", "Water tap", "Power outlets", "Restrooms nearby"],
    accessVia: ["River Road"],
  },
  ...[1, 2, 3, 4].map(
    (n): Space => ({
      id: `field-${n}`,
      kind: "field",
      name: `Field ${n}`,
      label: `Field ${n}, Riverside Park`,
      zone: "riverside-park",
      isPark: true,
      capacity: 150,
      rate: { amount: 20, per: "hour" },
      amenities: n <= 2 ? ["Backstop", "Bleachers"] : ["Open grass", "Goal posts on request"],
      accessVia: ["River Road"],
    }),
  ),
  {
    id: "great-lawn",
    kind: "open_area",
    name: "Great Lawn",
    label: "Great Lawn",
    zone: "great-lawn",
    isPark: true,
    squareFeet: 40000,
    maxPeople: 4000,
    rate: { amount: 200, per: "day" },
    amenities: ["Open grass", "Power pedestal", "Restrooms"],
    accessVia: ["Elm Street"],
  },
  {
    id: "city-hall-plaza",
    kind: "plaza",
    name: "City Hall Plaza",
    label: "City Hall Plaza",
    zone: "downtown",
    isPark: false,
    squareFeet: 20000,
    maxPeople: 2000,
    rate: { amount: 300, per: "day" },
    amenities: ["Paved", "Power pedestals", "Stage pad"],
    accessVia: ["Main Street"],
  },
];

export const SPACE_BY_ID: Record<string, Space> = Object.fromEntries(SPACES.map((s) => [s.id, s]));

export function getSpace(id: string): Space | undefined {
  return SPACE_BY_ID[id];
}

export function bookableSpaces(): Space[] {
  return SPACES.filter((s) => s.kind === "shelter" || s.kind === "field");
}

export function drawableAreas(): Space[] {
  return SPACES.filter((s) => s.kind === "plaza" || s.kind === "open_area");
}

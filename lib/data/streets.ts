/**
 * Permitopolis streets, one entry per block or stretch. Fictional.
 * Reference data, FROZEN after Phase 0: ids are used by the seed, the map and the rules.
 *
 * Two segments connect when they share a node. The Riverfront Summer 5K loop is
 * Main Street (5 blocks) plus River Road (4 stretches): exactly 3.1 miles.
 */

export interface StreetSegment {
  id: string;
  /** Street name, e.g. "Main Street". */
  street: string;
  /** e.g. "Main Street, 1st to 2nd Avenue" or "400 block of Maple Street". */
  label: string;
  kind: "arterial" | "residential";
  miles: number;
  nodes: [string, string];
  /** Residential blocks: households that must sign off for a block party. */
  households?: number;
}

const main = (a: number, b: number): StreetSegment => ({
  id: `main-${a}-${b}`,
  street: "Main Street",
  label: `Main Street, ${ordinal(a)} to ${ordinal(b)} Avenue`,
  kind: "arterial",
  miles: 0.1,
  nodes: [`m${a}`, `m${b}`],
});

function ordinal(n: number): string {
  return ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][n] ?? `${n}th`;
}

export const SEGMENTS: StreetSegment[] = [
  main(1, 2),
  main(2, 3),
  main(3, 4),
  main(4, 5),
  main(5, 6),
  {
    id: "river-a",
    street: "River Road",
    label: "River Road, 6th Avenue to the river bend",
    kind: "arterial",
    miles: 0.6,
    nodes: ["m6", "r1"],
  },
  {
    id: "river-b",
    street: "River Road",
    label: "River Road, the river bend to the Riverside Park gate",
    kind: "arterial",
    miles: 0.8,
    nodes: ["r1", "r2"],
  },
  {
    id: "river-c",
    street: "River Road",
    label: "River Road, the Riverside Park gate to the boathouse",
    kind: "arterial",
    miles: 0.7,
    nodes: ["r2", "r3"],
  },
  {
    id: "river-d",
    street: "River Road",
    label: "River Road, the boathouse to City Hall Plaza",
    kind: "arterial",
    miles: 0.5,
    nodes: ["r3", "m1"],
  },
  {
    id: "maple-300",
    street: "Maple Street",
    label: "300 block of Maple Street",
    kind: "residential",
    miles: 0.08,
    nodes: ["p3", "p4"],
    households: 10,
  },
  {
    id: "maple-400",
    street: "Maple Street",
    label: "400 block of Maple Street",
    kind: "residential",
    miles: 0.08,
    nodes: ["p4", "p5"],
    households: 12,
  },
  {
    id: "maple-500",
    street: "Maple Street",
    label: "500 block of Maple Street",
    kind: "residential",
    miles: 0.08,
    nodes: ["p5", "p6"],
    households: 14,
  },
  {
    id: "elm-100",
    street: "Elm Street",
    label: "100 block of Elm Street",
    kind: "residential",
    miles: 0.08,
    nodes: ["e1", "e2"],
    households: 9,
  },
  {
    id: "elm-200",
    street: "Elm Street",
    label: "200 block of Elm Street",
    kind: "residential",
    miles: 0.08,
    nodes: ["e2", "e3"],
    households: 11,
  },
  {
    id: "oak-100",
    street: "Oak Avenue",
    label: "100 block of Oak Avenue",
    kind: "residential",
    miles: 0.08,
    nodes: ["o1", "o2"],
    households: 8,
  },
  {
    id: "oak-200",
    street: "Oak Avenue",
    label: "200 block of Oak Avenue",
    kind: "residential",
    miles: 0.08,
    nodes: ["o2", "o3"],
    households: 10,
  },
];

export const SEGMENT_BY_ID: Record<string, StreetSegment> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

export function getSegment(id: string): StreetSegment | undefined {
  return SEGMENT_BY_ID[id];
}

/** Total length, rounded to hundredths so 0.1-mile blocks add up cleanly. */
export function milesOf(segmentIds: string[]): number {
  const sum = segmentIds.reduce((total, id) => total + (SEGMENT_BY_ID[id]?.miles ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

export function areConnected(a: string, b: string): boolean {
  const first = SEGMENT_BY_ID[a];
  const second = SEGMENT_BY_ID[b];
  if (!first || !second) return false;
  return first.nodes.some((node) => second.nodes.includes(node));
}

/** The 5K loop: from City Hall Plaza up Main Street and back along River Road. */
export const RIVERFRONT_5K_ROUTE: string[] = [
  "main-1-2",
  "main-2-3",
  "main-3-4",
  "main-4-5",
  "main-5-6",
  "river-a",
  "river-b",
  "river-c",
  "river-d",
];

/** Main Street, 1st to 4th Avenue: the Food Truck Festival's three blocks. */
export const MAIN_1ST_TO_4TH: string[] = ["main-1-2", "main-2-3", "main-3-4"];

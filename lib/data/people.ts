/**
 * Applicants (people and organizations) and city staff. Every one of the 38 seeded cases
 * has an applicantId here, even the 32 that never appear in the persona picker: they still
 * need a name to show in city lists.
 *
 * Contract note: `Persona` (lib/state/types.ts, frozen) has no "pickable" flag, so the
 * picker can't be told apart from the roster by the type alone. `PICKABLE_PERSONA_IDS`
 * below is the workaround; see contractChangeRequests in this workstream's result for the
 * field this should become.
 */
import type { Dept } from "@/lib/types";
import type { CityStaff, Persona } from "../state/types";

export const PERSONAS: Persona[] = [
  /* ---------- the six scenario personas + "new" (pickable) ---------- */
  {
    id: "maya-chen",
    name: "Maya Chen",
    contactName: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "(555) 040-1189",
    scenario: "S1",
  },
  {
    id: "sunrise-yoga-club",
    name: "Sunrise Yoga Club",
    contactName: "Dana Osei",
    email: "dana@sunriseyogaclub.example",
    phone: "(555) 040-2244",
    scenario: "S2",
  },
  {
    id: "downtown-arts-collective",
    name: "Downtown Arts Collective",
    contactName: "Jordan Alvarez",
    email: "jordan@downtownartscollective.example",
    phone: "(555) 040-3317",
    scenario: "S3",
  },
  {
    id: "maple-street-block-captain",
    name: "Maple Street Block Captain",
    contactName: "Felix Nakamura",
    email: "felix.nakamura@example.com",
    phone: "(555) 040-4482",
    scenario: "S4",
  },
  {
    id: "riverfront-running-club",
    name: "Riverfront Running Club",
    contactName: "Simone Dubois",
    email: "simone@riverfrontrunningclub.example",
    phone: "(555) 040-5521",
    scenario: "S5",
  },
  {
    id: "main-street-business-alliance",
    name: "Main Street Business Alliance",
    contactName: "Harold Petrov",
    email: "harold@mainstreetalliance.example",
    phone: "(555) 040-6630",
    scenario: "S6",
  },
  {
    id: "new",
    name: "New applicant",
    contactName: "",
    email: "",
    phone: null,
  },

  /* ---------- filler cases, F1-F7 ---------- */
  {
    id: "downtown-art-walk-committee",
    name: "Downtown Art Walk Committee",
    contactName: "Noor Siddiqui",
    email: "noor@artwalkcommittee.example",
    phone: "(555) 041-1002",
  },
  {
    id: "riverside-farmers-market-assoc",
    name: "Riverside Farmers Market Association",
    contactName: "Carl Jennings",
    email: "carl@riversidefarmersmarket.example",
    phone: "(555) 041-1103",
  },
  {
    id: "lakeside-film-society",
    name: "Lakeside Film Society",
    contactName: "Beatrix Holm",
    email: "beatrix@lakesidefilmsociety.example",
    phone: "(555) 041-1204",
  },
  {
    id: "oak-avenue-block-captain",
    name: "Oak Avenue Block Captain",
    contactName: "Reggie Soto",
    email: "reggie.soto@example.com",
    phone: "(555) 041-1305",
  },
  {
    id: "priya-jordan-wedding",
    name: "Priya Shah & Jordan Webb",
    contactName: "Priya Shah",
    email: "priya.shah@example.com",
    phone: "(555) 041-1406",
  },
  {
    id: "permitopolis-little-league",
    name: "Permitopolis Little League",
    contactName: "Walt Gormley",
    email: "walt@permitopolislittleleague.example",
    phone: "(555) 041-1507",
  },
  {
    id: "brightline-logistics",
    name: "Brightline Logistics Co.",
    contactName: "Tasha Oyelaran",
    email: "tasha.oyelaran@brightlinelogistics.example",
    phone: "(555) 041-1608",
  },

  /* ---------- background cases, B01-B25 ---------- */
  {
    id: "central-high-robotics-club",
    name: "Central High Robotics Club",
    contactName: "Mr. Dale Firth",
    email: "dfirth@centralhigh.example",
    phone: "(555) 042-0101",
  },
  {
    id: "riverside-garden-society",
    name: "Riverside Garden Society",
    contactName: "Opal Winters",
    email: "opal@riversidegardensociety.example",
    phone: "(555) 042-0202",
  },
  {
    id: "maple-grove-preschool",
    name: "Maple Grove Preschool",
    contactName: "Yvonne Castellano",
    email: "yvonne@maplegrovepreschool.example",
    phone: "(555) 042-0303",
  },
  {
    id: "north-side-chess-club",
    name: "North Side Chess Club",
    contactName: "Abebe Girma",
    email: "abebe@northsidechess.example",
    phone: "(555) 042-0404",
  },
  {
    id: "st-agnes-parish",
    name: "St. Agnes Parish",
    contactName: "Deacon Ray Oliveira",
    email: "deacon.oliveira@stagnesparish.example",
    phone: "(555) 042-0505",
  },
  {
    id: "permitopolis-rotary-club",
    name: "Permitopolis Rotary Club",
    contactName: "Marjorie Lund",
    email: "marjorie@permitopolisrotary.example",
    phone: "(555) 042-0606",
  },
  {
    id: "east-end-baptist-church",
    name: "East End Baptist Church",
    contactName: "Pastor Luther Combs",
    email: "pastor.combs@eastendbaptist.example",
    phone: "(555) 042-0707",
  },
  {
    id: "westside-youth-soccer-league",
    name: "Westside Youth Soccer League",
    contactName: "Grace Lemmon",
    email: "grace@westsideyouthsoccer.example",
    phone: "(555) 042-0808",
  },
  {
    id: "permitopolis-metro-interfaith-council",
    name: "Permitopolis Metropolitan Area Interfaith Council for Community Events",
    contactName: "Imam Tariq Rahman",
    email: "tariq@metrointerfaithcouncil.example",
    phone: "(555) 042-0909",
  },
  {
    id: "oakhill-homeowners-association",
    name: "Oakhill Homeowners Association",
    contactName: "Perpetua Nnamdi",
    email: "perpetua@oakhillhoa.example",
    phone: "(555) 042-1010",
  },
  {
    id: "greenfield-charter-school",
    name: "Greenfield Charter School",
    contactName: "Principal Edith Vance",
    email: "evance@greenfieldcharter.example",
    phone: "(555) 042-1111",
  },
  {
    id: "renee-oconnell",
    name: "Renée O'Connell",
    contactName: "Renée O'Connell",
    email: "renee.oconnell@example.com",
    phone: "(555) 042-1212",
  },
  {
    id: "northgate-swim-club",
    name: "Northgate Swim Club",
    contactName: "Pablo Serrano",
    email: "pablo@northgateswimclub.example",
    phone: "(555) 042-1313",
  },
  {
    id: "cascade-trail-runners",
    name: "Cascade Trail Runners",
    contactName: "Kit Fennimore",
    email: "kit@cascadetrailrunners.example",
    phone: "(555) 042-1414",
  },
  {
    id: "pine-street-neighborhood-assn",
    name: "Pine Street Neighborhood Association",
    contactName: "Doreen Matsuda",
    email: "doreen@pinestreetassn.example",
    phone: "(555) 042-1515",
  },
  {
    id: "riverside-tai-chi-circle",
    name: "Riverside Tai Chi Circle",
    contactName: "Mei-Lin Zhou",
    email: "meilin@riversidetaichi.example",
    phone: "(555) 042-1616",
  },
  {
    id: "campus-greek-council",
    name: "Permitopolis University Greek Council",
    contactName: "Spencer Quigley",
    email: "spencer@campusgreekcouncil.example",
    phone: "(555) 042-1717",
  },
  {
    id: "thunderbird-motorcycle-club",
    name: "Thunderbird Motorcycle Club",
    contactName: "Rosa Beaumont",
    email: "rosa@thunderbirdmc.example",
    phone: "(555) 042-1818",
  },
  {
    id: "summit-ridge-running-club",
    name: "Summit Ridge Running Club",
    contactName: "Niko Alexopoulos",
    email: "niko@summitridgerunning.example",
    phone: "(555) 042-1919",
  },
  {
    id: "golden-years-senior-center",
    name: "Golden Years Senior Center",
    contactName: "Bernadette Flores",
    email: "bernadette@goldenyearscenter.example",
    phone: "(555) 042-2020",
  },
  {
    id: "maple-ridge-scouts-troop-214",
    name: "Maple Ridge Scouts Troop 214",
    contactName: "Troop Leader Sam Okafor",
    email: "sam@mapleridgescouts.example",
    phone: "(555) 042-2121",
  },
  {
    id: "redline-motorsports-expo",
    name: "Redline Motorsports Expo",
    contactName: "Vic Thornbury",
    email: "vic@redlinemotorsports.example",
    phone: "(555) 042-2222",
  },
  {
    id: "sunnyvale-block-association",
    name: "Sunnyvale Block Association",
    contactName: "Ingrid Palacek",
    email: "ingrid@sunnyvaleblock.example",
    phone: "(555) 042-2323",
  },
  {
    id: "evergreen-wedding-planners",
    name: "Evergreen Wedding Planners",
    contactName: "Celeste Marchetti",
    email: "celeste@evergreenweddingplanners.example",
    phone: "(555) 042-2424",
  },
  {
    id: "north-permitopolis-chamber",
    name: "North Permitopolis Chamber of Commerce",
    contactName: "Oswald Bramwell",
    email: "oswald@northpermitopolischamber.example",
    phone: "(555) 042-2525",
  },
];

export const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));

/**
 * The applicant persona picker offers exactly these: the six scenario organizers plus
 * "new". Every other persona above still shows up in city lists, just not in the picker.
 * Workaround for the frozen `Persona` type having no `pickable` flag (see module doc).
 */
export const PICKABLE_PERSONA_IDS: readonly string[] = [
  "maya-chen",
  "sunrise-yoga-club",
  "downtown-arts-collective",
  "maple-street-block-captain",
  "riverfront-running-club",
  "main-street-business-alliance",
  "new",
];

export function isPickablePersona(id: string): boolean {
  return PICKABLE_PERSONA_IDS.includes(id);
}

/** One named contact per department. The Clerk's is the day-of contact printed on permits. */
export const CITY_STAFF: CityStaff[] = [
  { dept: "clerk", name: "Priya Natarajan", title: "City Clerk", phone: "(555) 014-2200" },
  { dept: "pws", name: "Marcus Webb", title: "Director, Public Works & Safety", phone: "(555) 014-3100" },
  { dept: "hl", name: "Dr. Elena Castillo", title: "Director, Health & Legal", phone: "(555) 014-4100" },
];

export const CITY_STAFF_BY_DEPT: Record<Dept, CityStaff> = Object.fromEntries(
  CITY_STAFF.map((s) => [s.dept, s]),
) as Record<Dept, CityStaff>;

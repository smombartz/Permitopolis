/**
 * The fields of the small structured forms on the add-on cards: what the board's card sheet
 * draws as inputs (components/board/CardForms) and what the city's case detail reads back with
 * the same labels (formRows() below). Data and a formatter: no React.
 */
import { fmtNumber, fmtTime } from "@/lib/format"
import type { CatalogId } from "@/lib/rules/catalog"
import type { Task } from "@/lib/types"

export type FieldType = "text" | "textarea" | "number" | "checkbox" | "time"

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

/**
 * The small structured forms the card detail sheet uses for the add-on cards, field shapes
 * matching what the seed itself writes (lib/state/seed/helpers and the scenario scripts), so
 * a filled-in card looks like the rest of the demo data.
 */
export const FORM_FIELDS: Partial<Record<CatalogId, FieldSpec[]>> = {
  sound_details: [
    { key: "equipment", label: "Sound equipment", type: "text", placeholder: "Two powered speakers, one wireless mic" },
    { key: "soundCheckTime", label: "Sound check time", type: "time" },
  ],
  alcohol_details: [
    { key: "beerGarden", label: "Fenced beer garden", type: "checkbox" },
    { key: "servers", label: "Trained servers on site", type: "number" },
    { key: "liquorLiabilityCarrier", label: "Liquor liability carrier", type: "text" },
  ],
  cooking_generator_safety: [
    { key: "generators", label: "Generators", type: "number" },
    { key: "fireExtinguishersPerTruck", label: "Fire extinguishers per food truck", type: "number" },
  ],
  accessibility_plan: [
    { key: "accessibleRoute", label: "Accessible route to every viewing area", type: "checkbox" },
    { key: "restrooms", label: "Accessible restrooms", type: "number" },
    { key: "viewingArea", label: "Accessible viewing area (optional)", type: "text" },
  ],
  cleanup_plan: [
    { key: "crew", label: "Cleanup crew size", type: "number" },
    { key: "sweepStartsAt", label: "Sweep starts at", type: "time" },
  ],
  site_plan: [{ key: "notes", label: "Site plan notes", type: "textarea", placeholder: "Booths, stage and routes, as drawn on the step 2 map" }],
}

/**
 * Labels for answers that have no field above: the vendor list and the city services request
 * are forms of their own on the board, and the seed's site plans say where they were drawn.
 */
export const FORM_KEY_LABEL: Record<string, string> = {
  vendors: "Vendors",
  barricades: "Barricades",
  trash: "Trash collection",
  power: "Power hookup",
  policeOfficers: "Police officers",
  policeHours: "Police hours",
  drawnOn: "Drawn on",
}

/* ---------- reading a form back ---------- */

export interface FormRow {
  label: string;
  /** The answer in words. A list is its items joined, so the value always stands on its own. */
  value: string;
  /** One line per entry when the answer is a list (the vendors of a vendor list). */
  items?: string[];
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "soundCheckTime" -> "Sound check time": what a key reads as when no form labels it. */
function wordsOf(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function answerText(value: unknown, field?: FieldSpec): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return fmtNumber(value);
  if (typeof value === "string") return field?.type === "time" || HH_MM.test(value) ? fmtTime(value) : value;
  if (Array.isArray(value)) return value.map((entry) => answerText(entry)).join("; ");
  // A row of a list ("Rolling Dumpling Co. · Dumplings"): its answers in order, blanks left out.
  return Object.values(value as Record<string, unknown>)
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map((part) => answerText(part))
    .join(" · ");
}

/**
 * A card's form as rows a person can read: the label the applicant saw on the board (a key
 * nobody labelled reads as its own words), Yes or No, 12-hour times, and a list entry per line.
 * In the order the answers were given. The Documents tab and the Verify and Send back panels
 * both print these.
 */
export function formRows(task: Pick<Task, "catalogId" | "payload">): FormRow[] {
  const form = task.payload.form;
  if (!form) return [];
  const fields = (FORM_FIELDS as Record<string, FieldSpec[] | undefined>)[task.catalogId] ?? [];
  return Object.entries(form).map(([key, value]) => {
    const field = fields.find((f) => f.key === key);
    const label = field?.label ?? FORM_KEY_LABEL[key] ?? wordsOf(key);
    if (Array.isArray(value) && value.length > 0) {
      const items = value.map((entry) => answerText(entry));
      return { label, value: items.join("; "), items };
    }
    return { label, value: answerText(value, field) };
  });
}

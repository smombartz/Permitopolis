/**
 * The fields of the small structured forms on the add-on cards: what the board's card sheet
 * draws as inputs (components/board/CardForms) and what the city's case detail reads back with
 * the same labels (formRows() in ./caseDetail). Data only: no React.
 */
import type { CatalogId } from "@/lib/rules/catalog"

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

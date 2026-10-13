"use client";

/**
 * Settings, section 3: the bookable spaces and areas from lib/data/inventory.ts, read-only.
 * The prototype's inventory is fixed; only its rates are editable, in the Fees section above.
 */
import { Section } from "@/components/ui/section";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/domain";
import { SPACES, type SpaceKind } from "@/lib/data/inventory";
import { plural } from "@/lib/format";

const KIND_LABEL: Record<SpaceKind, string> = {
  shelter: "Shelter",
  field: "Field",
  plaza: "Plaza",
  open_area: "Open area",
};

function capacityOf(space: (typeof SPACES)[number]): string {
  if (space.capacity !== undefined) return plural(space.capacity, "person", "people");
  if (space.maxPeople !== undefined) return `${plural(space.maxPeople, "person", "people")} max`;
  return "Not provided";
}

function InventorySection() {
  return (
    <Section title="Inventory and rates" description="Every bookable space and area, with its capacity, amenities and rate.">
      <InlineAlert variant="info">Inventory is fixed in the prototype. Edit a rate in Fees and deposits above.</InlineAlert>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Space</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Amenities</TableHead>
            <TableHead>Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SPACES.map((space) => (
            <TableRow key={space.id}>
              <TableCell>
                <p className="font-medium text-fg">{space.label}</p>
              </TableCell>
              <TableCell>{KIND_LABEL[space.kind]}</TableCell>
              <TableCell numeric>{capacityOf(space)}</TableCell>
              <TableCell>{space.amenities.join(", ")}</TableCell>
              <TableCell numeric>
                <Money amount={space.rate.amount} /> <span className="text-xs text-fg-secondary">per {space.rate.per}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export { InventorySection };

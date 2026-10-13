import Link from "next/link";
import { ChevronDownIcon, PlusIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PICKABLE_PERSONA_IDS, PERSONA_BY_ID } from "@/lib/data/people";
import { routes } from "@/lib/routes";

interface PersonaPickerProps {
  personaId: string;
  onChange: (personaId: string) => void;
  className?: string;
}

/**
 * The applicant-role persona picker: the six scenario personas plus "New applicant", with
 * "My events" and "Plan an event" below. If the store's current persona isn't one of the
 * pickable ones (a filler-case applicant reached some other way), it still shows as the
 * current choice instead of silently picking "New applicant".
 */
function PersonaPicker({ personaId, onChange, className }: PersonaPickerProps) {
  const current = PERSONA_BY_ID[personaId];
  const pickable = PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id]);
  const options = pickable.some((p) => p.id === personaId) || !current ? pickable : [current, ...pickable];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={className} aria-label="Switch applicant">
          <UserIcon data-icon="inline-start" aria-hidden="true" />
          <span className="max-w-32 truncate">{current?.name ?? "New applicant"}</span>
          <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Applicant</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={personaId} onValueChange={onChange}>
          {options.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.id === "new" ? <PlusIcon aria-hidden="true" /> : null}
              {p.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={routes.events()}>My events</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.apply()}>Plan an event</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { PersonaPicker };

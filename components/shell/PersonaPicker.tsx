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
import { PersonaAvatar } from "@/components/domain/PersonaAvatar";
import { NEW_PERSONA_ID, PICKABLE_PERSONA_IDS, PERSONA_BY_ID } from "@/lib/data/people";
import { routes } from "@/lib/routes";

interface PersonaPickerProps {
  personaId: string;
  onChange: (personaId: string) => void;
  className?: string;
}

/**
 * The applicant-role persona picker: the six scenario personas plus "New applicant", with
 * "My events" and "Plan an event" below. If the store's current persona isn't one of the
 * pickable ones (a filler or background case's applicant, reached by following its case from
 * a city role), it still shows as the current choice instead of silently picking "New
 * applicant". `onChange` is the top bar's usePersonaSwitch(): picking also navigates.
 */
function PersonaPicker({ personaId, onChange, className }: PersonaPickerProps) {
  const current = PERSONA_BY_ID[personaId];
  const pickable = PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id]);
  const options = pickable.some((p) => p.id === personaId) || !current ? pickable : [current, ...pickable];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={className} aria-label={`Switch applicant: ${current?.name ?? PERSONA_BY_ID[NEW_PERSONA_ID].name}`}>
          {current && current.id !== NEW_PERSONA_ID ? (
            <PersonaAvatar name={current.name} size="sm" data-icon="inline-start" aria-hidden="true" />
          ) : (
            <UserIcon data-icon="inline-start" aria-hidden="true" />
          )}
          <span className="max-w-32 truncate">{current?.name ?? PERSONA_BY_ID[NEW_PERSONA_ID].name}</span>
          <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Applicant</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={personaId} onValueChange={onChange}>
          {options.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.id === NEW_PERSONA_ID ? (
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <PlusIcon aria-hidden="true" />
                </span>
              ) : (
                <PersonaAvatar name={p.name} size="sm" aria-hidden="true" />
              )}
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

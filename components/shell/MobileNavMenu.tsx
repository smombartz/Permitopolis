import Link from "next/link";
import { MenuIcon, PlusIcon } from "lucide-react";
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
import { PARTY_ICON } from "@/components/domain/icons";
import { PersonaAvatar } from "@/components/domain/PersonaAvatar";
import { PARTIES, PARTY_LABEL, type Party } from "@/lib/types";
import { NEW_PERSONA_ID, PICKABLE_PERSONA_IDS, PERSONA_BY_ID } from "@/lib/data/people";
import { routes } from "@/lib/routes";

interface MobileNavMenuProps {
  role: Party;
  onRoleChange: (role: Party) => void;
  personaId: string;
  onPersonaChange: (personaId: string) => void;
}

/**
 * Below 768px the role switcher and the persona picker collapse into this one menu button,
 * so applicant screens keep working at 375px.
 */
function MobileNavMenu({ role, onRoleChange, personaId, onPersonaChange }: MobileNavMenuProps) {
  const currentPersona = PERSONA_BY_ID[personaId];
  const personaOptions = PICKABLE_PERSONA_IDS.map((id) => PERSONA_BY_ID[id]);
  const options =
    personaOptions.some((p) => p.id === personaId) || !currentPersona
      ? personaOptions
      : [currentPersona, ...personaOptions];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Role and applicant menu">
          <MenuIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Role</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => onRoleChange(v as Party)}>
          {PARTIES.map((party) => {
            const Icon = PARTY_ICON[party];
            return (
              <DropdownMenuRadioItem key={party} value={party}>
                <Icon aria-hidden="true" />
                {PARTY_LABEL[party]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        {role === "applicant" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Applicant</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={personaId} onValueChange={onPersonaChange}>
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
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { MobileNavMenu };

"use client";

import Link from "next/link";
import { ChevronDownIcon, PlusIcon, UserIcon } from "lucide-react";
import { cn } from "cn";
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
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { NEW_PERSONA_ID, PERSONA_BY_ID } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import { DEPTS, PARTY_LABEL, type Dept, type Party } from "@/lib/types";
import { actingAsName } from "@/lib/view/shell";

interface UserMenuProps {
  role: Party;
  personaId: string;
  /** The applicants on offer, in order (`userMenuPersonaIds()`). */
  personaIds: string[];
  onRoleChange: (role: Dept) => void;
  onPersonaChange: (personaId: string) => void;
  className?: string;
}

/**
 * The header's user button: who the presenter is acting as, and the one place to change it. The
 * button shows the city role's icon or the applicant's initials, with the name beside it from
 * 768px up. Its menu lists the three city officials, then the applicants; the Applicant also
 * gets "My events" and "Plan an event" below, the applicant area's only navigation.
 *
 * There is no "Applicant" entry: picking an applicant is the switch to the Applicant.
 * `onRoleChange` is useRoleSwitch() and `onPersonaChange` is usePersonaSwitch(), so a pick also
 * takes the presenter to the right page. It reads nothing from the store itself, so the design
 * kit can show it on local state.
 */
function UserMenu({ role, personaId, personaIds, onRoleChange, onPersonaChange, className }: UserMenuProps) {
  const compact = useIsNarrow();
  const name = actingAsName(role, personaId);
  const RoleIcon = PARTY_ICON[role];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size={compact ? "icon-sm" : "sm"} className={cn("text-sm shadow-none", className)} aria-label={`Switch user: ${name}`}>
          {role !== "applicant" ? (
            <RoleIcon data-icon="inline-start" aria-hidden="true" />
          ) : PERSONA_BY_ID[personaId] && personaId !== NEW_PERSONA_ID ? (
            <PersonaAvatar name={name} size="sm" data-icon="inline-start" aria-hidden="true" />
          ) : (
            <UserIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {!compact ? (
            <>
              <span className="max-w-40 truncate">{name}</span>
              <ChevronDownIcon data-icon="inline-end" aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] ease-frost group-data-[state=open]/button:rotate-180" />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>City officials</DropdownMenuLabel>
        <DropdownMenuRadioGroup aria-label="City officials" value={role === "applicant" ? "" : role} onValueChange={(v) => onRoleChange(v as Dept)}>
          {DEPTS.map((dept) => {
            const Icon = PARTY_ICON[dept];
            return (
              <DropdownMenuRadioItem key={dept} value={dept}>
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <Icon aria-hidden="true" />
                </span>
                {PARTY_LABEL[dept]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Applicants</DropdownMenuLabel>
        <DropdownMenuRadioGroup aria-label="Applicants" value={role === "applicant" ? personaId : ""} onValueChange={onPersonaChange}>
          {personaIds.map((id) => {
            const persona = PERSONA_BY_ID[id];
            return (
              <DropdownMenuRadioItem key={id} value={id}>
                {id === NEW_PERSONA_ID ? (
                  <span className="flex size-6 shrink-0 items-center justify-center">
                    <PlusIcon aria-hidden="true" />
                  </span>
                ) : (
                  <PersonaAvatar name={persona.name} size="sm" aria-hidden="true" />
                )}
                {persona.name}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        {role === "applicant" ? (
          <>
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

export { UserMenu };

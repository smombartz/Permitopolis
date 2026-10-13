"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Kbd } from "@/components/ui/kbd";
import { useRoleSwitch, usePersonaSwitch } from "@/components/shell/useRoleSwitch";
import { useDemo } from "@/lib/state";
import { homeFor } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { demoPathIdForScenario } from "@/lib/view/coach";
import { buildPaletteItems, groupPaletteItems, matchPaletteItems, type PaletteItem } from "@/lib/view/palette";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cmd+K (Ctrl+K): search cases, go to a page, switch role or persona, or jump the demo along.
 * Item building and matching live in `lib/view/palette.ts`; this interprets the action an
 * Enter or a click picks, closing itself first except for Reset, which needs its own
 * confirmation (CLAUDE.md: no `window.confirm`).
 */
function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const switchRole = useRoleSwitch();
  const switchPersona = usePersonaSwitch();
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const cases = useDemo((s) => s.cases);
  const hints = useDemo((s) => s.hints);
  const setRole = useDemo((s) => s.setRole);
  const setPersona = useDemo((s) => s.setPersona);
  const setDemoToday = useDemo((s) => s.setDemoToday);
  const toggleHints = useDemo((s) => s.toggleHints);
  const setActiveDemoPath = useDemo((s) => s.setActiveDemoPath);
  const reset = useDemo((s) => s.reset);

  const [query, setQuery] = React.useState("");
  const [resetOpen, setResetOpen] = React.useState(false);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setQuery("");
  }

  const items = React.useMemo(() => buildPaletteItems({ role, personaId, cases, hints }), [role, personaId, cases, hints]);
  const groups = React.useMemo(() => groupPaletteItems(matchPaletteItems(items, query)), [items, query]);

  function run(item: PaletteItem) {
    handleOpenChange(false);
    const action = item.action;
    switch (action.kind) {
      case "navigate":
        router.push(action.href);
        return;
      case "switchRole":
        switchRole(action.role);
        return;
      case "switchPersona":
        switchPersona(action.personaId);
        return;
      case "scenarioJump":
        setRole(action.jump.role);
        setPersona(action.jump.personaId);
        setActiveDemoPath(demoPathIdForScenario(action.jump.id));
        router.push(action.jump.path);
        return;
      case "demoPath": {
        const first = action.path.steps[0];
        setRole(first.role);
        if (first.persona) setPersona(first.persona);
        setActiveDemoPath(action.path.id);
        router.push(first.page);
        return;
      }
      case "dateJump":
        setDemoToday(action.date);
        return;
      case "toggleHints":
        toggleHints();
        return;
      case "reset":
        setResetOpen(true);
        return;
    }
  }

  function handleReset() {
    reset();
    router.push(homeFor(useDemo.getState().role));
    toast.success("Demo data restored.");
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={handleOpenChange} title="Command palette" description="Search cases and jump around the prototype.">
        {/* cmdk names its field with a label of its own (`label`), which is empty unless given: a placeholder is not a name. */}
        <Command shouldFilter={false} label="Search cases, pages and roles">
          <CommandInput aria-label="Search cases, pages and roles" placeholder="Search cases, pages, roles…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nothing matches &ldquo;{query}&rdquo;.</CommandEmpty>
            {groups.map((group, index) => (
              <React.Fragment key={group.group}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem key={item.id} value={item.id} onSelect={() => run(item)}>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.sublabel ? <span className="shrink-0 truncate text-xs text-fg-secondary">{item.sublabel}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
          <div className="flex items-center gap-3 border-t border-line-subtle px-3 py-2 text-xs text-fg-secondary">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> to open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>esc</Kbd> to close
            </span>
          </div>
        </Command>
      </CommandDialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo?"
        body={`This restores every case, the demo date and the role switcher to the seed exactly as it was on ${fmtDate(DEFAULT_DEMO_TODAY)}. There is no undo.`}
        confirmLabel="Reset demo data"
        destructive
        onConfirm={handleReset}
      />
    </>
  );
}

export { CommandPalette };

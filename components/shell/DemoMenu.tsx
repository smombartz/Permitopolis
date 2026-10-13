"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarIcon, LightbulbIcon, RotateCcwIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DemoDatePicker } from "@/components/shell/DemoDatePicker";
import { useDemo } from "@/lib/state";
import { SCENARIO_JUMPS, type ScenarioJump } from "@/lib/data/demoScript";
import { demoPathIdForScenario } from "@/lib/view/coach";
import { fmtDate } from "@/lib/format";
import { homeFor, routes } from "@/lib/routes";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import type { ISODate } from "@/lib/types";

/** The top bar's Demo menu: reset, set demo date, scenario jumps, hints, and the demo guide. */
function DemoMenu() {
  const router = useRouter();
  const demoToday = useDemo((s) => s.demoToday);
  const hints = useDemo((s) => s.hints);
  const reset = useDemo((s) => s.reset);
  const setDemoToday = useDemo((s) => s.setDemoToday);
  const toggleHints = useDemo((s) => s.toggleHints);
  const setRole = useDemo((s) => s.setRole);
  const setPersona = useDemo((s) => s.setPersona);
  const setActiveDemoPath = useDemo((s) => s.setActiveDemoPath);

  const [resetOpen, setResetOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);
  // Set by "Set demo date" and read once as the menu closes: see onCloseAutoFocus below.
  const openingDatePicker = React.useRef(false);
  // The date picker closes back to this button: it is what opened the menu the picker came from.
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  /**
   * Reset puts the role switcher back on the Applicant, so the page has to follow: a city
   * page would otherwise show its "built for a city role" panel, and an event made during
   * the demo no longer exists.
   */
  function handleReset() {
    reset();
    router.push(homeFor(useDemo.getState().role));
    toast.success("Demo data restored.");
  }

  function handleSetDemoToday(date: ISODate) {
    setDemoToday(date);
    setDateOpen(false);
  }

  function handleOpenDatePicker() {
    openingDatePicker.current = true;
    setDateOpen(true);
  }

  /**
   * A menu hands focus back to its trigger when it closes. The date picker is a popover that
   * closes when focus lands outside it, so that hand-back shut it the moment it opened. When
   * the menu is closing to open the picker, focus goes to the picker and stays there.
   */
  function handleMenuCloseAutoFocus(event: Event) {
    if (!openingDatePicker.current) return;
    openingDatePicker.current = false;
    event.preventDefault();
  }

  /**
   * A jump names its own page, so it sets the role and persona itself and skips useRoleSwitch().
   * It also puts the demo coach on the path built on that scenario (S3 is path 3).
   */
  function handleScenarioJump(jump: ScenarioJump) {
    setRole(jump.role);
    setPersona(jump.personaId);
    setActiveDemoPath(demoPathIdForScenario(jump.id));
    router.push(jump.path);
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" size="icon-sm" aria-label="Demo menu">
            <SettingsIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" onCloseAutoFocus={handleMenuCloseAutoFocus}>
          <DropdownMenuLabel>Demo</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <RotateCcwIcon aria-hidden="true" />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenDatePicker}>
            <CalendarIcon aria-hidden="true" />
            Set demo date&hellip;
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Jump to a scenario</DropdownMenuLabel>
          {SCENARIO_JUMPS.map((jump) => (
            <DropdownMenuItem key={jump.id} onSelect={() => handleScenarioJump(jump)}>
              {jump.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={hints} onCheckedChange={toggleHints}>
            <LightbulbIcon aria-hidden="true" />
            Demo hints
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem asChild>
            <Link href={routes.demo()}>Demo guide</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DemoDatePicker open={dateOpen} onOpenChange={setDateOpen} demoToday={demoToday} onSelect={handleSetDemoToday} returnFocusRef={triggerRef} />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo?"
        body={`This restores every case, the demo date and the role switcher to the seed exactly as it was on ${fmtDate(DEFAULT_DEMO_TODAY)}. There is no undo.`}
        confirmLabel="Reset demo data"
        destructive
        onConfirm={handleReset}
      />
    </div>
  );
}

export { DemoMenu };

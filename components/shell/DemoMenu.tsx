"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarIcon, LightbulbIcon, RotateCcwIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { SCENARIO_JUMPS } from "@/lib/data/demoScript";
import { routes } from "@/lib/routes";
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

  const [resetOpen, setResetOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);

  function handleReset() {
    reset();
    setResetOpen(false);
    toast.success("Demo data restored");
  }

  function handleSetDemoToday(date: ISODate) {
    setDemoToday(date);
    setDateOpen(false);
  }

  function handleScenarioJump(jump: (typeof SCENARIO_JUMPS)[number]) {
    setRole(jump.role);
    if (jump.personaId) setPersona(jump.personaId);
    router.push(jump.path);
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Demo menu">
            <SettingsIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Demo</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <RotateCcwIcon aria-hidden="true" />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDateOpen(true)}>
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

      <DemoDatePicker open={dateOpen} onOpenChange={setDateOpen} demoToday={demoToday} onSelect={handleSetDemoToday} />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>
              This restores every case, the demo date and the role switcher to the seed exactly as it was on Mon, May 3,
              2027. There is no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={handleReset}>
              Reset demo data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { DemoMenu };

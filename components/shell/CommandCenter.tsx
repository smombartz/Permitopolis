"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { KeyboardHelp } from "@/components/shell/KeyboardHelp";
import { useIsNarrow } from "@/components/shell/useIsNarrow";

/**
 * The top bar's search button, plus the two global shortcuts it stands for: Cmd+K (Ctrl+K)
 * opens the command palette, and "?" opens the keyboard-shortcuts dialog (never while a field
 * has focus, so a literal "?" can still be typed). Self-contained, so TopBar only has to render
 * this one component to get the button and both dialogs.
 */
function CommandCenter() {
  const [open, setOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const compact = useIsNarrow("(max-width: 639px)");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (event.key === "?") {
        const target = event.target as HTMLElement | null;
        const typing = Boolean(target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable));
        if (typing) return;
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button type="button" variant="secondary" size={compact ? "icon-sm" : "sm"} aria-label="Search" onClick={() => setOpen(true)}>
        <SearchIcon data-icon="inline-start" aria-hidden="true" />
        {!compact ? (
          <>
            <span>Search</span>
            <Kbd className="ml-1">⌘K</Kbd>
          </>
        ) : null}
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export { CommandCenter };

"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { KeyboardHelp } from "@/components/shell/KeyboardHelp";
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { isPlainShortcut } from "@/lib/keyboard";

/**
 * The top bar's search button, plus the two global shortcuts it stands for: Cmd+K (Ctrl+K)
 * opens the command palette from anywhere, a field included, and "?" opens the
 * keyboard-shortcuts dialog (never while a field has focus, so a literal "?" can still be
 * typed, and never with Ctrl, Cmd or Alt held or inside a menu: `isPlainShortcut()`).
 * Self-contained, so TopBar only has to render this one component to get the button and both
 * dialogs.
 */
function CommandCenter() {
  const [open, setOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const compact = useIsNarrow("(max-width: 639px)");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Cmd+K or Ctrl+K and nothing else: Cmd+Shift+K and Ctrl+Alt+K are the browser's.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (event.key === "?" && isPlainShortcut(event)) {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button type="button" variant="secondary" size={compact ? "icon-sm" : "sm"} aria-label="Search" aria-keyshortcuts="Meta+K Control+K" onClick={() => setOpen(true)}>
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

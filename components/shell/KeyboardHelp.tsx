"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface KeyboardHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  text: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], text: "Open the command palette" },
  { keys: ["/"], text: "Search a list" },
  { keys: ["j"], text: "Next row in a list" },
  { keys: ["k"], text: "Previous row in a list" },
  { keys: ["Esc"], text: "Close a sheet, dialog or menu" },
  { keys: ["?"], text: "Show this list" },
];

/**
 * "?" opens this: every keyboard shortcut the app shells offer. Never opens while a field has
 * focus (CommandCenter guards the keypress), so typing a literal "?" into a message or a note
 * is unaffected.
 */
function KeyboardHelp({ open, onOpenChange }: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work the prototype without a mouse.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.text} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg-secondary">{shortcut.text}</span>
              <span className="flex shrink-0 gap-1">
                {shortcut.keys.map((key, i) => (
                  <Kbd key={`${shortcut.text}-${i}`}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export { KeyboardHelp };

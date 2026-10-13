import { Kbd } from "@/components/ui/kbd";

/** The footer line every list screen shows: the keys that move through its rows. */
function KeyboardFooter() {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-secondary">
      <Kbd>j</Kbd>
      <Kbd>k</Kbd>
      <span>move</span>
      <span aria-hidden="true">&middot;</span>
      <Kbd>Enter</Kbd>
      <span>opens</span>
    </p>
  );
}

export { KeyboardFooter };

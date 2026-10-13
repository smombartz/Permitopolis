/**
 * When a one-key shortcut ("/", "?", j, k) is the page's to take. Every handler on `document`
 * asks here first, so the rule is one rule: a key somebody is typing, a key with Ctrl, Cmd or Alt
 * held (the browser's, or the palette's Cmd+K), a key another handler already took, and a key
 * pressed inside a widget that reads keys itself all stay where they were pressed.
 *
 * No React and no store. Covered by tests/render/keyboard.test.tsx, which presses the keys.
 */

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
/** Roles that take text or a value from the keyboard, whatever element carries them. */
const TYPING_ROLES = '[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], [role="slider"]';
/** Widgets with keys of their own: a menu's and a listbox's typeahead, a radio group's and a tab list's arrows. */
const KEYED_WIDGETS = '[role="menu"], [role="listbox"], [role="radiogroup"], [role="tablist"], [role="grid"], [role="tree"]';
const OVERLAYS = '[role="dialog"], [role="alertdialog"]';

function asElement(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  return el && typeof el.tagName === "string" ? el : null;
}

/** True when the key is being typed: its target is a field, an editable region, or a widget that takes text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = asElement(target);
  if (!el) return false;
  if (FIELD_TAGS.has(el.tagName) || el.isContentEditable) return true;
  return el.closest(TYPING_ROLES) !== null;
}

/** True when the key was pressed inside a widget that moves or searches by keys itself. */
export function isInsideKeyedWidget(target: EventTarget | null): boolean {
  return asElement(target)?.closest(KEYED_WIDGETS) != null;
}

/** True when the key was pressed inside an open dialog or sheet: the page behind it is out of reach. */
export function isInsideOverlay(target: EventTarget | null): boolean {
  return asElement(target)?.closest(OVERLAYS) != null;
}

/**
 * A one-key shortcut may fire: nobody took the key, no Ctrl, Cmd or Alt is held, nobody is
 * typing, and the key was not pressed inside a menu, listbox, radio group or tab list. Shift is
 * allowed, since "?" needs it.
 */
export function isPlainShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false;
  return !isTypingTarget(event.target) && !isInsideKeyedWidget(event.target);
}

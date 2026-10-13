/**
 * What a rendered page has to get right for assistive technology, checked on the DOM that
 * jsdom holds: tests/render/a11y.test.tsx runs it over every route for every role.
 *
 * `auditPage()` returns one line per problem and an empty list for a clean page, so a failing
 * test prints everything wrong with a page at once. It reads the whole document, portals
 * included, and leaves out whatever a screen reader would not reach (`hidden`, `aria-hidden`,
 * `display: none`): with a dialog open that is the page behind it.
 *
 * It cannot see layout, color or focus order; docs/readme.md, "Accessibility", lists what is
 * left to a person.
 */

/** Everything a person can operate: native controls, and the ARIA roles that stand in for one. */
const CONTROLS = [
  "button",
  "a[href]",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="searchbox"]',
].join(", ");

const INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]';

function idRefs(el: Element, attribute: string): string[] {
  return (el.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean);
}

/**
 * Whether a screen reader would skip the element. jsdom applies no stylesheet (the render tests
 * run with `css: false`), so what hides an element here is an attribute or an inline style, on
 * it or on an ancestor; `getComputedStyle()` on every ancestor of every element is what made
 * testing-library's `isInaccessible()` too slow for six hundred pages.
 */
const HIDDEN = '[aria-hidden="true"], [hidden], [inert], template, script, style, noscript, head';

function hiddenFromAT(el: Element): boolean {
  if (el.closest(HIDDEN)) return true;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = (node as HTMLElement).style;
    if (style && (style.display === "none" || style.visibility === "hidden")) return true;
  }
  return false;
}

function accessible(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => !hiddenFromAT(el));
}

/** The text a subtree contributes to a name: its visible text, image alt text and labelled icons. */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.matches(HIDDEN) || (node as HTMLElement).style?.display === "none") return "";
  const label = node.getAttribute("aria-label");
  if (label) return label;
  if (node instanceof HTMLImageElement) return node.alt;
  if (node.tagName.toLowerCase() === "title") return node.textContent ?? "";
  return Array.from(node.childNodes).map(textOf).join(" ");
}

function referencedText(el: Element, attribute: string): string {
  return idRefs(el, attribute)
    .map((id) => {
      const target = el.ownerDocument.getElementById(id);
      return target ? textOf(target) : "";
    })
    .join(" ");
}

const NAMED_BY_CONTENT = 'button, a, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"]';
/** Roles whose content is their value, not their name: a Radix select's trigger is a button with role="combobox". */
const VALUE_ROLES = '[role="combobox"], [role="textbox"], [role="searchbox"], [role="slider"], [role="spinbutton"], [role="listbox"]';

/**
 * The accessible name, near enough to the accname algorithm for a pass or fail: `aria-labelledby`,
 * `aria-label`, a `<label>`, then the content for the roles that take their name from it. Stricter
 * than the algorithm in one place, on purpose: a placeholder or a `title` alone does not name a
 * form field (WCAG 3.3.2 asks for a label that stays put).
 */
export function accessibleName(el: Element): string {
  const labelledBy = referencedText(el, "aria-labelledby").trim();
  if (labelledBy) return labelledBy;
  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const text = Array.from(labels).map(textOf).join(" ").trim();
    if (text) return text;
  }
  if (el instanceof HTMLInputElement && ["submit", "button", "reset"].includes(el.type)) return el.value.trim();
  if (el instanceof HTMLInputElement && el.type === "image") return el.alt.trim();

  if (el.matches(VALUE_ROLES)) return "";
  if (el.matches(NAMED_BY_CONTENT)) return textOf(el).replace(/\s+/g, " ").trim() || (el.getAttribute("title") ?? "").trim();
  return "";
}

function hasName(el: Element): boolean {
  return accessibleName(el) !== "";
}

/** A short, stable description of an element for a failure message. */
export function describeElement(el: Element): string {
  const html = el.outerHTML.replace(/\s+/g, " ");
  const slot = el.closest("[data-slot]")?.getAttribute("data-slot");
  return `${html.length > 220 ? `${html.slice(0, 220)}…` : html}${slot ? ` (in ${slot})` : ""}`;
}

export interface AuditOptions {
  /**
   * A page section rendered on its own (a dialog, a panel): skips what only a whole page has,
   * the one `h1` and the `main` landmark.
   */
  fragment?: boolean;
}

export function auditPage(options: AuditOptions = {}): string[] {
  const doc = document;
  const problems: string[] = [];

  if (!options.fragment) {
    const h1 = accessible(doc, "h1");
    if (h1.length !== 1) problems.push(`Expected one h1, found ${h1.length}${h1.length ? `: ${h1.map((h) => `"${h.textContent}"`).join(", ")}` : ""}.`);

    const mains = accessible(doc, 'main, [role="main"]');
    if (mains.length !== 1) problems.push(`Expected one main landmark, found ${mains.length}.`);
  }

  // Headings go down one level at a time (h2 to h4 skips a level; h4 back up to h2 does not).
  let previous = 0;
  for (const heading of accessible(doc, "h1, h2, h3, h4, h5, h6")) {
    const level = Number(heading.tagName[1]);
    if (previous !== 0 && level > previous + 1) problems.push(`Heading skips from h${previous} to h${level}: "${heading.textContent?.trim()}".`);
    previous = level;
  }

  for (const control of accessible(doc, CONTROLS)) {
    if (!hasName(control)) problems.push(`No accessible name: ${describeElement(control)}`);
  }

  // Focusable without being a control: it needs a role and a name to say what was landed on.
  for (const el of accessible(doc, '[tabindex="0"]')) {
    // A table row has a role of its own (the list tables make a row focusable for j and k).
    if (el.matches(CONTROLS) || el.matches('tr, [role="tabpanel"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="grid"], [role="group"], [role="region"], [role="img"], [role="tooltip"]')) continue;
    if (!el.getAttribute("role") && !hasName(el)) problems.push(`Focusable with no role and no name: ${describeElement(el)}`);
  }
  for (const el of accessible(doc, "[tabindex]")) {
    if (Number(el.getAttribute("tabindex")) > 0) problems.push(`Positive tabindex: ${describeElement(el)}`);
  }

  const seen = new Map<string, number>();
  for (const el of Array.from(doc.querySelectorAll("[id]"))) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  for (const [id, count] of seen) if (count > 1) problems.push(`Duplicate id "${id}" (${count} elements).`);

  for (const attribute of ["aria-labelledby", "aria-describedby", "aria-errormessage"]) {
    for (const el of accessible(doc, `[${attribute}]`)) {
      for (const id of idRefs(el, attribute)) {
        if (!doc.getElementById(id)) problems.push(`${attribute}="${id}" points at nothing: ${describeElement(el)}`);
      }
    }
  }
  for (const label of accessible(doc, "label[for]")) {
    const id = label.getAttribute("for");
    if (id && !doc.getElementById(id)) problems.push(`<label for="${id}"> points at nothing: "${label.textContent?.trim()}".`);
  }

  // A field marked invalid says why: its error is tied to it.
  for (const field of accessible(doc, '[aria-invalid="true"]')) {
    if (!field.hasAttribute("aria-describedby") && !field.hasAttribute("aria-errormessage")) problems.push(`Invalid field with no error tied to it: ${describeElement(field)}`);
  }

  const navs = accessible(doc, 'nav, [role="navigation"]');
  const navNames = new Set<string>();
  for (const nav of navs) {
    const name = nav.getAttribute("aria-label") ?? idRefs(nav, "aria-labelledby").map((id) => doc.getElementById(id)?.textContent ?? "").join(" ");
    if (!name.trim()) problems.push(`Navigation landmark with no label: ${describeElement(nav)}`);
    else if (navNames.has(name)) problems.push(`Two navigation landmarks are both labelled "${name}".`);
    navNames.add(name);
  }
  const banners = accessible(doc, 'body > header, [role="banner"]');
  if (banners.length > 1) problems.push(`Expected at most one banner landmark, found ${banners.length}.`);
  const asides = accessible(doc, 'aside, [role="complementary"]');
  for (const aside of asides) {
    if (!hasName(aside) && asides.length > 1) problems.push(`One of ${asides.length} complementary landmarks has no label: ${describeElement(aside)}`);
  }

  for (const table of accessible(doc, "table")) {
    if (table.getAttribute("role") === "presentation" || table.getAttribute("role") === "none") continue;
    if (!table.querySelector("caption") && !table.hasAttribute("aria-label") && !table.hasAttribute("aria-labelledby")) problems.push(`Table with no caption or label: ${describeElement(table)}`);
    if (!table.querySelector("th")) problems.push(`Table with no header cells: ${describeElement(table)}`);
    for (const th of Array.from(table.querySelectorAll("thead th"))) {
      if (!th.textContent?.trim() && !th.getAttribute("aria-label")) problems.push(`Empty column header in a table: ${describeElement(table)}`);
    }
  }

  for (const img of accessible(doc, "img")) {
    if (!img.hasAttribute("alt")) problems.push(`Image with no alt: ${describeElement(img)}`);
  }
  for (const svg of accessible(doc, "svg")) {
    if (svg.closest('[role="img"]') && svg.getAttribute("role") !== "img") continue;
    const named = svg.hasAttribute("aria-label") || svg.hasAttribute("aria-labelledby") || svg.querySelector(":scope > title");
    if (!named) problems.push(`SVG neither hidden nor named: ${describeElement(svg)}`);
  }

  for (const el of accessible(doc, INTERACTIVE)) {
    const outer = el.parentElement?.closest(INTERACTIVE);
    if (outer) problems.push(`Control inside a control: ${describeElement(el)} inside ${describeElement(outer)}`);
  }

  for (const list of accessible(doc, "ul, ol")) {
    for (const child of Array.from(list.children)) {
      if (!["LI", "SCRIPT", "TEMPLATE"].includes(child.tagName) && child.getAttribute("role") !== "listitem") {
        problems.push(`<${list.tagName.toLowerCase()}> has a <${child.tagName.toLowerCase()}> child: ${describeElement(list)}`);
        break;
      }
    }
  }

  return problems;
}

/** Every live region on the page with what it holds, for a test that counts announcements. */
export function liveRegions(): { element: HTMLElement; text: string }[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-live], [role="status"], [role="alert"], [role="log"]')).map((element) => ({
    element,
    text: element.textContent?.trim() ?? "",
  }));
}

/**
 * Controls that share a name and do different things: two links called "Open" that go to two
 * cases, or a "Remove" button per row. The name has to say which thing it acts on.
 */
export function repeatedNames(): string[] {
  const problems: string[] = [];
  const links = new Map<string, Set<string>>();
  for (const link of accessible(document, "a[href]")) {
    const name = accessibleName(link);
    if (!name) continue;
    const hrefs = links.get(name) ?? new Set<string>();
    hrefs.add(link.getAttribute("href") ?? "");
    links.set(name, hrefs);
  }
  for (const [name, hrefs] of links) if (hrefs.size > 1) problems.push(`${hrefs.size} links named "${name}" go to different places: ${Array.from(hrefs).slice(0, 3).join(", ")}`);

  const buttons = new Map<string, number>();
  for (const button of accessible(document, 'button:not([role]), [role="button"]')) {
    const name = accessibleName(button);
    if (!name) continue;
    buttons.set(name, (buttons.get(name) ?? 0) + 1);
  }
  for (const [name, count] of buttons) if (count > 1) problems.push(`${count} buttons are all named "${name}".`);
  return problems;
}

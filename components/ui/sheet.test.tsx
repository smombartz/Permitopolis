import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

function classesOf(side: "right" | "left" | "top" | "bottom"): string[] {
  render(
    <Sheet open>
      <SheetContent side={side}>
        <SheetTitle>Card</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  const node = document.querySelector(`[data-slot="sheet-content"][data-side="${side}"]`);
  if (!node) throw new Error("the sheet is not open");
  return node.className.split(/\s+/);
}

describe("SheetContent (Phase 3 review fix: a bottom sheet below 640px, whatever its side)", () => {
  // `data-[side=right]:w-3/4` has specificity 0,2,0 and no breakpoint; `max-sm:w-full` has
  // 0,1,0. Unscoped, the side rule wins on a phone and the "bottom sheet" is a 75% panel pinned
  // to the top-left. So a left, right or top rule must only exist from `sm` up.
  it.each(["right", "left", "top"] as const)("no %s placement rule applies below sm", (side) => {
    const classes = classesOf(side);
    expect(classes.filter((c) => c.startsWith(`data-[side=${side}]:`))).toEqual([]);
    expect(classes.some((c) => c.startsWith(`sm:data-[side=${side}]:`))).toBe(true);
  });

  it("a right sheet is a bottom sheet on a phone and a 3/4-width side panel from sm up", () => {
    const classes = classesOf("right");
    for (const rule of ["max-sm:inset-x-0", "max-sm:bottom-0", "max-sm:top-auto", "max-sm:w-full", "max-sm:h-auto", "max-sm:data-open:slide-in-from-bottom-10"]) {
      expect(classes).toContain(rule);
    }
    for (const rule of ["sm:data-[side=right]:inset-y-0", "sm:data-[side=right]:right-0", "sm:data-[side=right]:h-full", "sm:data-[side=right]:w-3/4"]) {
      expect(classes).toContain(rule);
    }
  });
});

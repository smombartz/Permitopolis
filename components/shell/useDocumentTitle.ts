"use client";

import * as React from "react";

/**
 * A page about one record names it in its title: "Riverfront Summer 5K · Case · Permitopolis".
 * The route's own title (`metadata` in its page.tsx) is all the server can know, "Case": the
 * record lives in the browser's store. Next's route announcer reads the title out after a
 * client-side navigation, so this is also what a screen reader hears on arriving at the page.
 * Pass null while there is nothing to name; the route's own title then stands.
 */
export function useDocumentTitle(title: string | null): void {
  React.useEffect(() => {
    if (title) document.title = `${title} · Permitopolis`;
  }, [title]);
}

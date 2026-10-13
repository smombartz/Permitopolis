"use client";

import { useHydrated } from "@/lib/state";

/**
 * Reads the stored demo on every route, once per page load. Mounted in the root layout, ahead
 * of the page, because a page with no shell (the landing page, the demo guide, the verify
 * page) would otherwise never read it, and its first change to the store would be made on the
 * in-memory seed. Renders nothing; a page still waits for `useHydrated()` before it shows or
 * changes anything from the store.
 */
function StoreHydrator() {
  useHydrated();
  return null;
}

export { StoreHydrator };

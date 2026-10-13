"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/state";
import type { Party } from "@/lib/types";

interface RememberPathProps {
  /** The role whose area this page belongs to: the current role, once the shell has checked it. */
  role: Party;
}

/**
 * Records the page `role` is on, query string included, as its last page (`lastPathByRole`),
 * so switching away and back returns to the same wizard step, tab or filtered list. Renders
 * nothing. It reads the query with `useSearchParams()`, so the shells mount it under its own
 * `<Suspense>` and only once the store is hydrated.
 */
function RememberPath({ role }: RememberPathProps) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const rememberPath = useDemo((s) => s.rememberPath);

  React.useEffect(() => {
    rememberPath(role, query ? `${pathname}?${query}` : pathname);
  }, [role, pathname, query, rememberPath]);

  return null;
}

export { RememberPath };

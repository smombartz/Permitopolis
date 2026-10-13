"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDemo } from "@/lib/state";
import { homeFor } from "@/lib/routes";

interface PlaceholderScreenProps {
  /** The route pattern as the file tree spells it, e.g. "/city/cases/[id]". */
  route: string;
  /**
   * For a page with no shell around it (`/demo`, `/verify/[id]`): adds the page container and
   * the `<main>` landmark that AppShell and CityShell otherwise provide.
   */
  standalone?: boolean;
}

/**
 * Stands in for every route a later workstream hasn't built yet. Replace it in the route's
 * `page.tsx` with the real screen; nothing else refers to it.
 */
function PlaceholderScreen({ route, standalone = false }: PlaceholderScreenProps) {
  const role = useDemo((s) => s.role);
  const header = (
    <PageHeader
      eyebrow="Not built yet"
      title="This screen is being built"
      description={`${route} isn't wired up yet in this prototype.`}
      actions={
        <Button asChild variant="secondary">
          <Link href={homeFor(role)}>Back home</Link>
        </Button>
      }
    />
  );
  if (!standalone) return header;
  return (
    <div className="app-ground min-h-dvh">
      <main className="page-container py-6">{header}</main>
    </div>
  );
}

export { PlaceholderScreen };

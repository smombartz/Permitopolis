"use client";

import Link from "next/link";
import { HardHatIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/state";
import { homeFor } from "@/lib/routes";

interface PlaceholderScreenProps {
  /** The route pattern as the file tree spells it, e.g. "/city/cases/[id]". */
  route: string;
}

/** Stands in for every route a later workstream hasn't built yet. */
function PlaceholderScreen({ route }: PlaceholderScreenProps) {
  const role = useDemo((s) => s.role);
  return (
    <div className="page-container flex min-h-[55vh] items-center justify-center py-16">
      <EmptyState
        icon={HardHatIcon}
        title="This screen is being built"
        text={`${route} isn't wired up yet in this prototype.`}
        action={
          <Button asChild variant="secondary">
            <Link href={homeFor(role)}>Back home</Link>
          </Button>
        }
      />
    </div>
  );
}

export { PlaceholderScreen };

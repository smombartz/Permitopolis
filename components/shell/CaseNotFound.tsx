import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface CaseNotFoundProps {
  id: string;
  backHref: string;
  backLabel?: string;
}

/**
 * An unknown case id: later screens (the board, the case detail) reuse this. It fills the
 * column the shell gives a screen, so it works under AppShell and CityShell alike.
 */
function CaseNotFound({ id, backHref, backLabel = "Back" }: CaseNotFoundProps) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center py-10">
      <EmptyState
        icon={FileQuestionIcon}
        title="Case not found"
        headingLevel={1}
        text={`There's no case ${id} in this demo.`}
        action={
          <Button asChild variant="secondary">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}

export { CaseNotFound };

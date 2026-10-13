import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface CaseNotFoundProps {
  id: string;
  backHref: string;
  backLabel?: string;
}

/** An unknown case id: later screens (the board, the case detail) reuse this. */
function CaseNotFound({ id, backHref, backLabel = "Back" }: CaseNotFoundProps) {
  return (
    <div className="page-container flex min-h-[55vh] items-center justify-center py-16">
      <EmptyState
        icon={FileQuestionIcon}
        title="Case not found"
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

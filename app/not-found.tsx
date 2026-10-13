import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/lib/routes";

/** The global 404. No shell: a not-found link can come from anywhere, in any role. */
export default function NotFound() {
  return (
    <main className="page-container flex min-h-dvh flex-col justify-center py-10">
      <PageHeader
        eyebrow="404"
        title="Page not found"
        description="This page doesn't exist in the Permitopolis prototype."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={routes.home()}>Go to the landing page</Link>
            </Button>
            <Button asChild>
              <Link href={routes.apply()}>Plan an event</Link>
            </Button>
          </>
        }
      />
    </main>
  );
}

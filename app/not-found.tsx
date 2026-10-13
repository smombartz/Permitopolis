import Link from "next/link";
import { routes } from "@/lib/routes";

/** The global 404. No shell: a not-found link can come from anywhere, in any role. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--container-page) flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-mono text-eyebrow font-semibold tracking-[.12em] text-fg-label uppercase">404</p>
      <h1 className="text-card font-bold text-fg">Page not found</h1>
      <p className="max-w-sm text-fg-secondary">This page doesn&apos;t exist in the Permitopolis prototype.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={routes.home()} className="font-semibold text-fg-accent underline-offset-4 hover:underline">
          Go to the landing page
        </Link>
        <Link href={routes.apply()} className="font-semibold text-fg-accent underline-offset-4 hover:underline">
          Plan an event
        </Link>
      </div>
    </main>
  );
}

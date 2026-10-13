import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { StoreHydrator } from "@/components/shell/StoreHydrator";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Rime & Ink loads only the mono face; text uses the system stack.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Permitopolis · City Clerk · Events Permitting",
  description:
    "Plan an event in Permitopolis. Describe it once and see the permits, deadlines and fees that apply.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/*
          Every screen reads client state (the store, the URL). This boundary lets the
          static shell prerender; do not remove it. Pages add their own boundary too.
        */}
        <Suspense fallback={null}>
          {/* First, so the stored demo is read before any page's own effects run. */}
          <StoreHydrator />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </Suspense>
      </body>
    </html>
  );
}

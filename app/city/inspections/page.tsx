import type { Metadata } from "next";
import { Suspense } from "react";
import { InspectionsScreen } from "@/components/city/inspections/InspectionsScreen";

export const metadata: Metadata = { title: "Inspections" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InspectionsScreen />
    </Suspense>
  );
}

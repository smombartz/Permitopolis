import { Suspense } from "react";
import { InspectionsScreen } from "@/components/city/inspections/InspectionsScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InspectionsScreen />
    </Suspense>
  );
}

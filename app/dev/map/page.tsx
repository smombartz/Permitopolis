import { Suspense } from "react";
import { MapDevScreen } from "@/components/map/MapDevScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapDevScreen />
    </Suspense>
  );
}

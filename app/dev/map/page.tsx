import type { Metadata } from "next";
import { Suspense } from "react";
import { MapDevScreen } from "@/components/map/MapDevScreen";

export const metadata: Metadata = { title: "Map and calendar checkpoint" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapDevScreen />
    </Suspense>
  );
}

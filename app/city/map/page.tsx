import type { Metadata } from "next";
import { Suspense } from "react";
import { ClosuresMapScreen } from "@/components/city/closures/ClosuresMapScreen";

export const metadata: Metadata = { title: "Closures and routes" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClosuresMapScreen />
    </Suspense>
  );
}

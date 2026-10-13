import type { Metadata } from "next";
import { Suspense } from "react";
import { KitScreen } from "@/components/kit/KitScreen";

export const metadata: Metadata = { title: "Design kit" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KitScreen />
    </Suspense>
  );
}

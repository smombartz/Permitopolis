import type { Metadata } from "next";
import { Suspense } from "react";
import { CasesScreen } from "@/components/city/lists/CasesScreen";

export const metadata: Metadata = { title: "Cases" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CasesScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";

export const metadata: Metadata = { title: "Case" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CaseDetailScreen />
    </Suspense>
  );
}

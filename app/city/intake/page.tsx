import type { Metadata } from "next";
import { Suspense } from "react";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";

export const metadata: Metadata = { title: "Intake" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <IntakeScreen />
    </Suspense>
  );
}

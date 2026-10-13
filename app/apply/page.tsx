import type { Metadata } from "next";
import { Suspense } from "react";
import { WizardScreen } from "@/components/wizard/WizardScreen";

export const metadata: Metadata = { title: "Plan an event" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WizardScreen />
    </Suspense>
  );
}

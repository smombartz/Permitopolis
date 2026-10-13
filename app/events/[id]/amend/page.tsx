import type { Metadata } from "next";
import { Suspense } from "react";
import { AmendWizardScreen } from "@/components/wizard/amend/AmendWizardScreen";

export const metadata: Metadata = { title: "Change your event" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AmendWizardScreen />
    </Suspense>
  );
}

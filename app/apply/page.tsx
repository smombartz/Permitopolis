import { Suspense } from "react";
import { WizardScreen } from "@/components/wizard/WizardScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WizardScreen />
    </Suspense>
  );
}

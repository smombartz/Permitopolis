import { Suspense } from "react";
import { AmendWizardScreen } from "@/components/wizard/amend/AmendWizardScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AmendWizardScreen />
    </Suspense>
  );
}

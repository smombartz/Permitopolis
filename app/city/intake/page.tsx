import { Suspense } from "react";
import { IntakeScreen } from "@/components/city/lists/IntakeScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <IntakeScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { VerificationsScreen } from "@/components/city/verifications/VerificationsScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerificationsScreen />
    </Suspense>
  );
}

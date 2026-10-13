import { Suspense } from "react";
import { VerifyScreen } from "@/components/permit/VerifyScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyScreen />
    </Suspense>
  );
}

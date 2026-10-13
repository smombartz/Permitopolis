import { Suspense } from "react";
import { ClosuresMapScreen } from "@/components/city/closures/ClosuresMapScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClosuresMapScreen />
    </Suspense>
  );
}

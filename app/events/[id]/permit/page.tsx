import { Suspense } from "react";
import { PermitScreen } from "@/components/permit/PermitScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PermitScreen />
    </Suspense>
  );
}

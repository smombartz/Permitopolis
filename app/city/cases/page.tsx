import { Suspense } from "react";
import { CasesScreen } from "@/components/city/lists/CasesScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CasesScreen />
    </Suspense>
  );
}

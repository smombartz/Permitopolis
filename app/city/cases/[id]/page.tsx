import { Suspense } from "react";
import { CaseDetailScreen } from "@/components/case/CaseDetailScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CaseDetailScreen />
    </Suspense>
  );
}

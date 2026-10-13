import { Suspense } from "react";
import { ActiveScreen } from "@/components/active/ActiveScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActiveScreen />
    </Suspense>
  );
}

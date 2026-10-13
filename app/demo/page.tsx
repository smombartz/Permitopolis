import { Suspense } from "react";
import { DemoGuideScreen } from "@/components/landing/DemoGuideScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DemoGuideScreen />
    </Suspense>
  );
}

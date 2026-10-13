import { Suspense } from "react";
import { LandingScreen } from "@/components/landing/LandingScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LandingScreen />
    </Suspense>
  );
}

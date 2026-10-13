import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoGuideScreen } from "@/components/landing/DemoGuideScreen";

export const metadata: Metadata = { title: "Demo guide" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DemoGuideScreen />
    </Suspense>
  );
}

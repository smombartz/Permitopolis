import type { Metadata } from "next";
import { Suspense } from "react";
import { ActiveScreen } from "@/components/active/ActiveScreen";

export const metadata: Metadata = { title: "Active permits" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActiveScreen />
    </Suspense>
  );
}

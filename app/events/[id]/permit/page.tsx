import type { Metadata } from "next";
import { Suspense } from "react";
import { PermitScreen } from "@/components/permit/PermitScreen";

export const metadata: Metadata = { title: "Permit" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PermitScreen />
    </Suspense>
  );
}

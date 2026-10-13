import type { Metadata } from "next";
import { Suspense } from "react";
import { VerificationsScreen } from "@/components/city/verifications/VerificationsScreen";

export const metadata: Metadata = { title: "Verifications" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerificationsScreen />
    </Suspense>
  );
}

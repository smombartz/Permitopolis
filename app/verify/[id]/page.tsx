import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyScreen } from "@/components/permit/VerifyScreen";

export const metadata: Metadata = { title: "Permit check" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyScreen />
    </Suspense>
  );
}

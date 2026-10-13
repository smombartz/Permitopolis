import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsScreen } from "@/components/city/payments/PaymentsScreen";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentsScreen />
    </Suspense>
  );
}

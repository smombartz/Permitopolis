import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";

export const metadata: Metadata = { title: "Pay" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutScreen />
    </Suspense>
  );
}

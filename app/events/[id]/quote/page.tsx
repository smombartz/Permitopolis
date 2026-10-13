import { Suspense } from "react";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutScreen />
    </Suspense>
  );
}

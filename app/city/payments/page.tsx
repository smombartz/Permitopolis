import { Suspense } from "react";
import { PaymentsScreen } from "@/components/city/payments/PaymentsScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentsScreen />
    </Suspense>
  );
}

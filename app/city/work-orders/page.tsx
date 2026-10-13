import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkOrdersScreen } from "@/components/city/workorders/WorkOrdersScreen";

export const metadata: Metadata = { title: "Work orders" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkOrdersScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { WorkOrdersScreen } from "@/components/city/workorders/WorkOrdersScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkOrdersScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { QueueScreen } from "@/components/city/lists/QueueScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QueueScreen />
    </Suspense>
  );
}

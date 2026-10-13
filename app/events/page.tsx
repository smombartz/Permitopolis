import { Suspense } from "react";
import { MyEventsScreen } from "@/components/board/MyEventsScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyEventsScreen />
    </Suspense>
  );
}

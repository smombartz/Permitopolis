import type { Metadata } from "next";
import { Suspense } from "react";
import { MyEventsScreen } from "@/components/board/MyEventsScreen";

export const metadata: Metadata = { title: "My events" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyEventsScreen />
    </Suspense>
  );
}

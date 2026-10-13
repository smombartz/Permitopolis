import type { Metadata } from "next";
import { Suspense } from "react";
import { QueueScreen } from "@/components/city/lists/QueueScreen";

export const metadata: Metadata = { title: "My queue" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QueueScreen />
    </Suspense>
  );
}

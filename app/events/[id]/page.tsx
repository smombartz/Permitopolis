import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardScreen } from "@/components/board/BoardScreen";

export const metadata: Metadata = { title: "Event board" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BoardScreen />
    </Suspense>
  );
}

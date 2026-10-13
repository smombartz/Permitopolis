import { Suspense } from "react";
import { BoardScreen } from "@/components/board/BoardScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BoardScreen />
    </Suspense>
  );
}

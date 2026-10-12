import { Suspense } from "react";
import { KitScreen } from "@/components/kit/KitScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KitScreen />
    </Suspense>
  );
}

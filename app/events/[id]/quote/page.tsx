import { Suspense } from "react";
import { PlaceholderScreen } from "@/components/shell/PlaceholderScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlaceholderScreen route="/events/[id]/quote" />
    </Suspense>
  );
}

import { Suspense } from "react";
import { PlaceholderScreen } from "@/components/shell/PlaceholderScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlaceholderScreen route="/verify/[id]" />
    </Suspense>
  );
}

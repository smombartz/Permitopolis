import { Suspense } from "react";
import { SettingsScreen } from "@/components/city/settings/SettingsScreen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SettingsScreen />
    </Suspense>
  );
}

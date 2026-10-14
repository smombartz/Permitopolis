"use client";

/**
 * /city/settings, the City Clerk's tool (workstream 6A). A page of six sections behind an
 * in-page nav, the current one kept in `?section=`. Tier rules and Fees write through
 * `useDemo().setConfig()`; Inventory, Blackout and Templates are read-only reference data.
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo } from "@/lib/state";
import { TierRulesSection } from "./TierRulesSection";
import { FeesSection } from "./FeesSection";
import { InventorySection } from "./InventorySection";
import { BlackoutSection } from "./BlackoutSection";
import { TemplatesSection } from "./TemplatesSection";
import { ServiceLevelsSection } from "./ServiceLevelsSection";

export type SettingsSection = "tier-rules" | "fees" | "inventory" | "blackout" | "templates" | "service-levels";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "tier-rules", label: "Tier rules" },
  { id: "fees", label: "Fees and deposits" },
  { id: "inventory", label: "Inventory and rates" },
  { id: "blackout", label: "Blackout calendar" },
  { id: "templates", label: "Templates" },
  { id: "service-levels", label: "Service levels" },
];

function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}

function SettingsScreen() {
  const cfg = useDemo((s) => s.cfg);
  const cases = useDemo((s) => s.cases);
  const demoToday = useDemo((s) => s.demoToday);
  const setConfig = useDemo((s) => s.setConfig);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const sectionParam = search.get("section");
  const section: SettingsSection = isSettingsSection(sectionParam) ? sectionParam : "tier-rules";

  function setSection(next: string) {
    const qs = new URLSearchParams();
    if (next !== "tier-rules") qs.set("section", next);
    router.replace(qs.toString() ? `${pathname}?${qs.toString()}` : pathname);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="City Clerk"
        title="Settings"
        description="Tier rules, fees and deposits, inventory, the blackout calendar and templates: the configured rules the rest of the prototype reads, not code."
      />

      <Tabs orientation="vertical" value={section} onValueChange={setSection} className="items-start">
        <TabsList variant="line" aria-label="Settings sections" className="sticky top-[calc(var(--app-header-h)+1.5rem)] w-56 shrink-0 self-start">
          {SETTINGS_SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tier-rules">
          <TierRulesSection cfg={cfg} cases={cases} setConfig={setConfig} />
        </TabsContent>
        <TabsContent value="fees">
          <FeesSection cfg={cfg} setConfig={setConfig} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventorySection />
        </TabsContent>
        <TabsContent value="blackout">
          <BlackoutSection today={demoToday} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesSection />
        </TabsContent>
        <TabsContent value="service-levels">
          <ServiceLevelsSection cfg={cfg} setConfig={setConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { SettingsScreen };

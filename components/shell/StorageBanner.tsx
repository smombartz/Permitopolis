"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

/** Shown once per visit when storageOk is false. Dismissible; reappears on the next reload. */
function StorageBanner() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;
  return (
    <div className="page-container pt-4">
      <Banner variant="warning" className="items-center">
        <p className="flex-1">Your browser is blocking storage, so changes last until you close this tab.</p>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss the storage warning" onClick={() => setDismissed(true)}>
          <XIcon aria-hidden="true" />
        </Button>
      </Banner>
    </div>
  );
}

export { StorageBanner };

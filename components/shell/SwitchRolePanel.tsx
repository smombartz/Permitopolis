import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { PARTY_ICON } from "@/components/domain/icons";
import { PARTY_LABEL, type Party } from "@/lib/types";

interface SwitchRolePanelProps {
  message: string;
  targets: Party[];
  onSwitch: (role: Party) => void;
}

/**
 * Shown in place of the page when the current role doesn't match the area: the Applicant
 * on a /city route, or a city role on /apply or /events. Offers every role that does.
 */
function SwitchRolePanel({ message, targets, onSwitch }: SwitchRolePanelProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-5 py-16">
      <Panel variant="plain" className="flex max-w-sm flex-col items-center gap-4 p-6 text-center">
        {/* The page has no other title: the message is its h1. */}
        <h1 className="text-sm text-fg-secondary">{message}</h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {targets.map((role) => {
            const Icon = PARTY_ICON[role];
            return (
              <Button key={role} variant="secondary" onClick={() => onSwitch(role)}>
                <Icon data-icon="inline-start" aria-hidden="true" />
                Switch to {PARTY_LABEL[role]}
              </Button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

export { SwitchRolePanel };

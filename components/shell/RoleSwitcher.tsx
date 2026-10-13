import { SegmentedControl } from "@/components/ui/segmented-control";
import { PARTY_ICON } from "@/components/domain/icons";
import { PARTIES, PARTY_LABEL, type Party } from "@/lib/types";

interface RoleSwitcherProps {
  value: Party;
  onChange: (role: Party) => void;
  className?: string;
}

/** The top bar's four-segment role switcher: Applicant, City Clerk, Public Works & Safety, Health & Legal. */
function RoleSwitcher({ value, onChange, className }: RoleSwitcherProps) {
  return (
    <SegmentedControl
      aria-label="Switch role"
      value={value}
      onChange={onChange}
      className={className}
      options={PARTIES.map((party) => {
        const Icon = PARTY_ICON[party];
        return {
          value: party,
          label: PARTY_LABEL[party],
          icon: <Icon className="size-3.5" aria-hidden="true" />,
        };
      })}
    />
  );
}

export { RoleSwitcher };

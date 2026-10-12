import { cn } from "cn"
import { DEPT_ICON } from "@/components/domain/icons"
import { PARTY_LABEL, type Dept, type ReviewStatus } from "@/lib/types"

const STATUS_DOT: Record<ReviewStatus, string> = {
  not_routed: "bg-line-magnetic",
  pending: "bg-indigo-650",
  approved: "bg-success",
  approved_with_conditions: "bg-success",
  needs_info: "bg-warning",
  denied: "bg-danger",
};

const STATUS_TEXT: Record<ReviewStatus, string> = {
  not_routed: "Not routed yet",
  pending: "Reviewing",
  approved: "Approved",
  approved_with_conditions: "Approved with conditions",
  needs_info: "Asked for more information",
  denied: "Denied",
};

interface ReviewStatusDotProps extends React.ComponentProps<"div"> {
  dept: Dept;
  status: ReviewStatus;
  /** Overrides the default plain-language text, e.g. "Asked you for something". */
  label?: React.ReactNode;
  /** Shows the department name and icon above the status text (list views). */
  showDept?: boolean;
}

/** A department's review status, always in plain words next to a colored dot. */
function ReviewStatusDot({
  dept,
  status,
  label,
  showDept = true,
  className,
  ...props
}: ReviewStatusDotProps) {
  const Icon = DEPT_ICON[dept];
  return (
    <div data-slot="review-status-dot" data-status={status} className={cn("flex flex-col gap-0.5", className)} {...props}>
      {showDept ? (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Icon className="size-3.5 text-fg-label" aria-hidden="true" />
          {PARTY_LABEL[dept]}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 text-sm text-fg-secondary">
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])}
        />
        {label ?? STATUS_TEXT[status]}
      </div>
    </div>
  );
}

export { ReviewStatusDot, STATUS_TEXT as REVIEW_STATUS_TEXT };

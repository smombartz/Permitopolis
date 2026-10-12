import { cn } from "cn"

interface CaseIdProps extends React.ComponentProps<"span"> {
  id: string;
}

/** "PMT-27-0118" in mono, the table/row treatment for ids. */
function CaseId({ id, className, ...props }: CaseIdProps) {
  return (
    <span data-slot="case-id" className={cn("font-mono text-[13px] text-fg-label", className)} {...props}>
      {id}
    </span>
  );
}

export { CaseId };

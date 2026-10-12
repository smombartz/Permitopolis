import { cn } from "cn"
import { fmtMoney } from "@/lib/format"

interface MoneyProps extends React.ComponentProps<"span"> {
  amount: number;
  /** Negative amounts (refunds) render in success color instead of plain ink. */
  signColor?: boolean;
}

/** "$1,240" in mono with tabular figures, the table/row treatment for money. */
function Money({ amount, signColor = false, className, ...props }: MoneyProps) {
  return (
    <span
      data-slot="money"
      className={cn(
        "font-mono text-[13px] tabular-nums",
        signColor && amount < 0 && "text-success-fg",
        signColor && amount > 0 && "text-fg",
        className
      )}
      {...props}
    >
      {fmtMoney(amount)}
    </span>
  );
}

export { Money };

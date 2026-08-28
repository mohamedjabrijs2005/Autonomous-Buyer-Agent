import { Wallet } from "lucide-react";

type Props = {
  budget: number | null;
  committed: number;
  status: "idle" | "running" | "passed" | "failed";
};

export default function BudgetMeter({ budget, committed, status }: Props) {
  if (!budget) return null;

  const pct = Math.min(100, Math.round((committed / budget) * 100));
  const overBudget = committed > budget;

  const barColor =
    status === "failed" || overBudget ? "bg-fail" : status === "passed" ? "bg-pass" : "bg-accent";

  return (
    <div className="bg-panel border border-line rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Wallet className="w-4 h-4 text-accent2" />
          Committed spend
        </div>
        <span className={`font-mono text-sm font-semibold ${overBudget ? "text-fail" : "text-ink"}`}>
          ₹{committed} <span className="text-muted font-normal">/ ₹{budget}</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface border border-line/70 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

import { Wallet, CheckCircle, AlertTriangle } from "lucide-react";

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
    status === "failed" || overBudget
      ? "bg-fail"
      : status === "passed"
      ? "bg-pass"
      : "bg-brand";

  return (
    <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-muted">
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Committed Spend
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {overBudget ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fail bg-fail-bg px-1.5 py-0.5 rounded border border-fail-border">
              <AlertTriangle className="w-3 h-3" /> Over Budget
            </span>
          ) : status === "passed" ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pass bg-pass-bg px-1.5 py-0.5 rounded border border-pass-border">
              <CheckCircle className="w-3 h-3" /> Within Budget
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-2.5">
        <div className="font-mono text-xl font-bold text-ink">
          ₹{committed}
          <span className="text-sm font-normal text-muted ml-1.5">/ ₹{budget}</span>
        </div>
        <span className="font-mono text-xs text-muted font-medium">{pct}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

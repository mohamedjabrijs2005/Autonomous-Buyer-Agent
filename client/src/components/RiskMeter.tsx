import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { RiskInfo } from "../types";

const LEVEL_CONFIG: Record<
  RiskInfo["level"],
  { bar: string; text: string; bg: string; border: string; label: string }
> = {
  low: {
    bar: "bg-pass",
    text: "text-pass",
    bg: "bg-pass-bg",
    border: "border-pass-border",
    label: "LOW RISK"
  },
  medium: {
    bar: "bg-warn",
    text: "text-warn",
    bg: "bg-warn-bg",
    border: "border-warn-border",
    label: "MEDIUM RISK"
  },
  high: {
    bar: "bg-fail",
    text: "text-fail",
    bg: "bg-fail-bg",
    border: "border-fail-border",
    label: "HIGH RISK"
  }
};

export default function RiskMeter({ risk }: { risk: RiskInfo }) {
  const meta = LEVEL_CONFIG[risk.level];

  return (
    <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-muted">
            {risk.level === "low" ? (
              <ShieldCheck className="w-3.5 h-3.5 text-pass" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-warn" />
            )}
          </div>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Transaction Risk
          </span>
        </div>
        <span
          className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-2.5">
        <div className="font-mono text-xl font-bold text-ink">
          {risk.score}
          <span className="text-sm font-normal text-muted ml-1">/ 100</span>
        </div>
        <span className="text-xs text-muted font-mono">{risk.reasons.length} factor{risk.reasons.length === 1 ? "" : "s"}</span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${meta.bar}`}
          style={{ width: `${Math.min(100, Math.max(5, risk.score))}%` }}
        />
      </div>

      {risk.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {risk.reasons.map((r, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-muted truncate max-w-full"
            >
              • {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

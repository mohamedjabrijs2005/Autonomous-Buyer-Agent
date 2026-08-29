import { AlertOctagon } from "lucide-react";
import type { RiskInfo } from "../types";

const LEVEL_META: Record<RiskInfo["level"], { bar: string; text: string; label: string }> = {
  low: { bar: "bg-pass", text: "text-pass", label: "LOW" },
  medium: { bar: "bg-accent", text: "text-accent", label: "MEDIUM" },
  high: { bar: "bg-fail", text: "text-fail", label: "HIGH" }
};

export default function RiskMeter({ risk }: { risk: RiskInfo }) {
  const meta = LEVEL_META[risk.level];

  return (
    <div className="bg-panel border border-line rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <AlertOctagon className="w-4 h-4 text-accent2" />
          Transaction risk
        </div>
        <span className={`font-mono text-sm font-semibold ${meta.text}`}>
          {risk.score}/100 <span className="font-normal">— {meta.label}</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface border border-line/70 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${meta.bar}`}
          style={{ width: `${risk.score}%` }}
        />
      </div>
      <ul className="text-xs text-muted space-y-0.5">
        {risk.reasons.map((r, i) => (
          <li key={i}>• {r}</li>
        ))}
      </ul>
    </div>
  );
}

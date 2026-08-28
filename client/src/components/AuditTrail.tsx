import { CheckCircle2, XCircle, AlertTriangle, Info, Clock } from "lucide-react";
import type { TimelineStep } from "../types";

const STATUS_META: Record<
  TimelineStep["status"],
  { icon: typeof CheckCircle2; color: string; bg: string; border: string }
> = {
  pass: { icon: CheckCircle2, color: "text-pass", bg: "bg-pass/10", border: "border-pass/30" },
  fail: { icon: XCircle, color: "text-fail", bg: "bg-fail/10", border: "border-fail/30" },
  warn: { icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  info: { icon: Info, color: "text-ink", bg: "bg-ink/5", border: "border-ink/15" }
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour12: false });
  } catch {
    return "";
  }
}

export default function AuditTrail({ steps, running }: { steps: TimelineStep[]; running: boolean }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-5 h-5 text-ink" />
        <h2 className="font-display font-semibold text-lg text-ink">Audit trail</h2>
        {running && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-accent uppercase tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            live
          </span>
        )}
      </div>
      <p className="text-sm text-muted mb-5">
        Every reasoning step, gate check, and money action, in the order it actually happened.
      </p>

      {steps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-muted/60" />
          </div>
          <p className="text-sm font-medium text-muted">Run the agent to see the audit trail</p>
          <p className="text-xs text-muted/70 mt-1">Each step appears here live, as it happens</p>
        </div>
      ) : (
        <ol className="flex-1 overflow-y-auto pr-1 space-y-0">
          {steps.map((step, i) => {
            const meta = STATUS_META[step.status];
            const Icon = meta.icon;
            const isLast = i === steps.length - 1;
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${meta.bg} ${meta.border} border flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-line mt-1.5" />}
                </div>
                <div className="flex-1 min-w-0 pb-5 border-l-2 border-line/60 pl-4 -ml-px">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{step.label}</span>
                    <span className="font-mono text-[10px] text-muted shrink-0">{formatTime(step.timestamp)}</span>
                  </div>
                  {step.detail && <div className="mt-1.5 text-xs text-muted space-y-1 break-words">{step.detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

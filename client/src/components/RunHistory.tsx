import { CheckCircle2, XCircle, Activity, History } from "lucide-react";
import type { RunSummary } from "../types";

type Props = {
  history: RunSummary[];
  viewingId: string | null;
  onSelect: (id: string | null) => void;
  isLiveActive: boolean;
};

export default function RunHistory({ history, viewingId, onSelect, isLiveActive }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="bg-panel border border-line rounded-xl p-3 shadow-card flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider shrink-0 pl-1 hidden sm:flex">
        <History className="w-3.5 h-3.5" />
        <span>Runs:</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-0.5 flex-1 pr-1">
        {/* Live Execution Tab */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
            viewingId === null
              ? "bg-brand text-white border-brand shadow-xs"
              : "bg-surface text-muted border-line hover:border-slate-400 hover:text-ink"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
            }`}
          />
          <span>Live Session</span>
          {isLiveActive && (
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        {/* Previous Runs */}
        {[...history].reverse().map((run, idx) => {
          const isSelected = viewingId === run.id;
          const isPassed = run.status === "passed";
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => onSelect(run.id)}
              className={`flex items-center gap-2 shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all max-w-[240px] ${
                isSelected
                  ? "bg-brand text-white border-brand shadow-xs"
                  : "bg-surface text-muted border-line hover:border-slate-400 hover:text-ink"
              }`}
              title={`Run ${history.length - idx}: ${run.goal}`}
            >
              {isPassed ? (
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSelected ? "text-emerald-300" : "text-pass"
                  }`}
                />
              ) : (
                <XCircle
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSelected ? "text-rose-300" : "text-fail"
                  }`}
                />
              )}
              <span className="truncate">{run.goal || "Untitled run"}</span>
              <span
                className={`font-mono text-[11px] shrink-0 ${
                  isSelected ? "text-white/80" : "text-ink font-semibold"
                }`}
              >
                ₹{run.total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

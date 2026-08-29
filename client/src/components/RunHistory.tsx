import { CheckCircle2, XCircle, Radio } from "lucide-react";
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
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          viewingId === null
            ? "bg-ink text-white border-ink"
            : "bg-panel text-muted border-line hover:border-ink hover:text-ink"
        }`}
      >
        <Radio className={`w-3 h-3 ${isLiveActive ? "text-accent animate-pulse" : ""}`} />
        Live
      </button>

      {[...history].reverse().map((run) => {
        const isSelected = viewingId === run.id;
        const Icon = run.status === "passed" ? CheckCircle2 : XCircle;
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(run.id)}
            className={`flex items-center gap-1.5 shrink-0 text-xs font-medium pl-2.5 pr-3 py-1.5 rounded-full border transition-colors max-w-[220px] ${
              isSelected
                ? "bg-ink text-white border-ink"
                : "bg-panel text-muted border-line hover:border-ink hover:text-ink"
            }`}
            title={run.goal}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : run.status === "passed" ? "text-pass" : "text-fail"}`} />
            <span className="truncate">{run.goal || "Untitled run"}</span>
            <span className="font-mono shrink-0 opacity-70">₹{run.total}</span>
          </button>
        );
      })}
    </div>
  );
}

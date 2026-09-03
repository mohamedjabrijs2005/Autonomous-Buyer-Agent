import { ShieldAlert, Check, X, Loader2, PauseCircle } from "lucide-react";
import type { ApprovalRequest } from "../types";

type Props = {
  request: ApprovalRequest;
  onDecide: (approved: boolean) => void;
  deciding: boolean;
};

export default function ApprovalGate({ request, onDecide, deciding }: Props) {
  return (
    <div className="bg-amber-50/70 border-2 border-amber-400/80 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500 text-white uppercase">
                Action Required
              </span>
              <span className="text-xs font-semibold text-amber-900">
                Human Approval Needed
              </span>
            </div>
            <p className="text-xs text-amber-800 font-medium mt-0.5">
              The buyer agent has paused and requires your authorization before order placement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-md bg-amber-100/80 border border-amber-300 text-[11px] font-mono font-medium text-amber-900 shrink-0">
          <PauseCircle className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
          <span>AGENT PAUSED</span>
        </div>
      </div>

      <div className="bg-white/80 rounded-lg p-3 border border-amber-200/60 mb-4 text-xs text-slate-800">
        <span className="font-semibold text-slate-900">Reason: </span>
        {request.reason || (
          <>
            This purchase is <span className="font-mono font-semibold text-ink">₹{request.total}</span>,
            which exceeds the <span className="font-mono font-semibold text-ink">₹{request.threshold}</span> auto-approve threshold.
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(true)}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pass text-white text-xs font-semibold py-2.5 px-4 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-sm"
        >
          {deciding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4 stroke-[2.5]" />
          )}
          <span>Approve Transaction</span>
        </button>
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(false)}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white border border-rose-300 text-fail text-xs font-semibold py-2.5 px-4 hover:bg-rose-50 active:scale-[0.99] disabled:opacity-50 transition-all"
        >
          {deciding ? (
            <Loader2 className="w-4 h-4 animate-spin text-fail" />
          ) : (
            <X className="w-4 h-4 stroke-[2.5]" />
          )}
          <span>Reject Order</span>
        </button>
      </div>
    </div>
  );
}

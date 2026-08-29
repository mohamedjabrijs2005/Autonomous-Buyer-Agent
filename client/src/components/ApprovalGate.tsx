import { ShieldAlert, Check, X } from "lucide-react";
import type { ApprovalRequest } from "../types";

type Props = {
  request: ApprovalRequest;
  onDecide: (approved: boolean) => void;
  deciding: boolean;
};

export default function ApprovalGate({ request, onDecide, deciding }: Props) {
  return (
    <div className="bg-panel border-2 border-accent rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldAlert className="w-4.5 h-4.5 text-accent shrink-0" />
        <h3 className="font-display font-semibold text-sm text-ink">Human approval required</h3>
      </div>
      <p className="text-xs text-muted mb-3">
        This purchase is <span className="font-mono text-ink">₹{request.total}</span>, above the{" "}
        <span className="font-mono text-ink">₹{request.threshold}</span> auto-approve threshold. The agent will not
        create the order until you decide.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-pass text-white text-sm font-medium py-2 hover:bg-pass/90 disabled:opacity-50 transition-colors"
        >
          <Check className="w-4 h-4" /> Approve
        </button>
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(false)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-fail text-white text-sm font-medium py-2 hover:bg-fail/90 disabled:opacity-50 transition-colors"
        >
          <X className="w-4 h-4" /> Reject
        </button>
      </div>
    </div>
  );
}

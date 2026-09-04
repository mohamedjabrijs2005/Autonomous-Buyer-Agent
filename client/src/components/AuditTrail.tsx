import {
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Download,
  Zap,
  CreditCard,
  Package,
  Layers,
  Search,
  Lock,
  PauseCircle,
  FileCheck,
  Ban,
  FileText
} from "lucide-react";
import type { TimelineStep } from "../types";
import { exportAuditPdf } from "../utils/pdfExport";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour12: false });
  } catch {
    return "";
  }
}

function getStepIcon(step: TimelineStep) {
  switch (step.event) {
    case "order_created":
    case "done":
      return <CreditCard className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "policy_check":
    case "merchant_policy_check":
      return step.status === "pass" ? (
        <FileCheck className="w-3.5 h-3.5 text-pass stroke-[2.5]" />
      ) : (
        <X className="w-3.5 h-3.5 text-fail stroke-[2.5]" />
      );
    case "revision_started":
    case "substitution":
      return <RefreshCw className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "risk_assessed":
      return <Zap className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "catalog_fetched":
      return <Package className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "goal_interpreted":
      return <Search className="w-3.5 h-3.5 text-slate-700 stroke-[2.5]" />;
    case "cart_proposed":
      return <Layers className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "approval_required":
      return <Lock className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
    case "approval_granted":
      return <Check className="w-3.5 h-3.5 text-pass stroke-[2.5]" />;
    case "agent_stopped":
    case "flow_stopped":
    case "order_rejected":
      return <Ban className="w-3.5 h-3.5 text-fail stroke-[2.5]" />;
    default:
      if (step.status === "pass") {
        return <Check className="w-3.5 h-3.5 text-pass stroke-[2.5]" />;
      }
      if (step.status === "fail") {
        return <X className="w-3.5 h-3.5 text-fail stroke-[2.5]" />;
      }
      if (step.status === "warn") {
        return <AlertTriangle className="w-3.5 h-3.5 text-gold stroke-[2.5]" />;
      }
      return <div className="w-2 h-2 rounded-full bg-slate-400" />;
  }
}

function getNodeClasses(status: TimelineStep["status"]) {
  switch (status) {
    case "pass":
      return "bg-pass-bg border-pass-border text-pass";
    case "fail":
      return "bg-fail-bg border-fail-border text-fail";
    case "warn":
      return "bg-gold-light border-gold-border text-gold";
    default:
      return "bg-surface border-line text-slate-700";
  }
}

export default function AuditTrail({
  steps,
  running,
  waitingApproval
}: {
  steps: TimelineStep[];
  running: boolean;
  waitingApproval?: boolean;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 sm:p-6 shadow-card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Live Execution
            </h2>
            {running && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gold-light text-gold border border-gold-border">
                <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                LIVE
              </span>
            )}
            {waitingApproval && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gold-light text-gold border border-gold-border">
                <PauseCircle className="h-3 w-3 text-gold animate-pulse" />
                AGENT PAUSED
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            Follow every decision and transaction action as it happens.
          </p>
        </div>

        {steps.length > 0 && !running && (
          <button
            type="button"
            onClick={() => exportAuditPdf({ steps })}
            className="flex items-center gap-1.5 text-xs font-medium text-ink hover:text-gold-hover bg-surface hover:bg-gold-light/60 border border-line hover:border-gold-border px-3 py-1.5 rounded-lg transition-colors shadow-xs"
            title="Export audit report as PDF"
          >
            <FileText className="w-3.5 h-3.5 text-gold" />
            <span>Export PDF</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      {steps.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col justify-center py-10 px-4 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-gold-light border border-gold-border flex items-center justify-center mx-auto mb-3.5 text-gold">
              <Layers className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">
              Ready to Run
            </h3>
            <p className="text-xs text-muted mt-1 mb-5">
              Enter a goal and budget to start the buyer agent.
            </p>

            <div className="text-left bg-surface border border-line rounded-lg p-3.5 space-y-2">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Autonomous Workflow
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[10px] text-gold font-semibold">1.</span>
                  <span>Analyze merchant catalog and interpret goal</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[10px] text-gold font-semibold">2.</span>
                  <span>Build purchase proposal and check stock availability</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[10px] text-gold font-semibold">3.</span>
                  <span>Enforce user and merchant policy gates</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[10px] text-gold font-semibold">4.</span>
                  <span>Handle failures safely via 1 bounded revision</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[10px] text-gold font-semibold">5.</span>
                  <span>Assess risk and create Razorpay Test Mode order</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        /* Timeline View */
        <div className="flex-1 overflow-y-auto pr-1">
          <ol className="relative border-l border-line ml-3.5 space-y-5 pb-4">
            {steps.map((step) => {
              const nodeClass = getNodeClasses(step.status);
              const isOrderCreated = step.event === "order_created";
              const rawData: any = step.raw;

              return (
                <li key={step.id} className="relative pl-6 group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-3.5 top-0.5 w-7 h-7 rounded-full border flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${nodeClass}`}
                  >
                    {getStepIcon(step)}
                  </div>

                  {/* Step Body */}
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold text-ink leading-tight">
                        {step.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted shrink-0">
                        {formatTime(step.timestamp)}
                      </span>
                    </div>

                    {/* Dedicated Order Created Card in White & Gold */}
                    {isOrderCreated && rawData?.order ? (
                      <div className="mt-2.5 bg-panel text-ink rounded-lg p-3.5 shadow-sm border-2 border-gold-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono tracking-wider uppercase text-gold font-semibold flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-gold" />
                            Payment Order Created
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gold-light text-gold-dark border border-gold-border font-mono">
                            {rawData.order.source === "razorpay_test_mode"
                              ? "Razorpay Test Mode"
                              : "Mock Mode"}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <div className="font-mono text-xs text-ink font-medium select-all">
                            {rawData.order.id}
                          </div>
                          <div className="font-mono text-base font-bold text-gold">
                            ₹{(rawData.order.amount / 100).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted mt-1">
                          Test transaction authorized · No real payment collected
                        </div>
                      </div>
                    ) : (
                      /* General Step Detail */
                      step.detail && (
                        <div className="mt-1.5 text-xs text-slate-600 bg-surface rounded-lg p-2.5 border border-line/70 leading-relaxed break-words space-y-1">
                          {step.detail}
                        </div>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Running Indicator at bottom of timeline */}
          {running && (
            <div className="ml-3.5 pl-6 py-2 flex items-center gap-2 text-xs text-gold font-medium">
              <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
              <span>Analyzing merchant catalog and evaluating policy rules…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

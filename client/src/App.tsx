import { useEffect, useRef, useState } from "react";
import {
  Square,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  ShieldAlert,
  CreditCard
} from "lucide-react";
import GoalPanel from "./components/GoalPanel";
import AuditTrail from "./components/AuditTrail";
import BudgetMeter from "./components/BudgetMeter";
import RiskMeter from "./components/RiskMeter";
import ApprovalGate from "./components/ApprovalGate";
import RunHistory from "./components/RunHistory";
import type { TimelineStep, RunSummary, RiskInfo, ApprovalRequest } from "./types";
import { API_BASE } from "./config";

let stepCounter = 0;
const nextId = () => `step_${Date.now()}_${stepCounter++}`;
let runCounter = 0;
const nextRunId = () => `run_${Date.now()}_${runCounter++}`;

export default function App() {
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [running, setRunning] = useState(false);
  const [committed, setCommitted] = useState(0);
  const [gateStatus, setGateStatus] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskInfo | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    id: string;
    source: string;
    amount: number;
  } | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const stepsRef = useRef<TimelineStep[]>([]);
  const committedRef = useRef(0);
  const riskRef = useRef<RiskInfo | null>(null);
  const runIdRef = useRef<string>("");
  const runMetaRef = useRef({ goal: "", budget: "" });
  const catalogMapRef = useRef<Record<string, { name: string; category: string; price: number }>>({});

  useEffect(() => {
    fetch(`${API_BASE}/catalog`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; category: string; price: number }[]) => {
        const map: Record<string, { name: string; category: string; price: number }> = {};
        data.forEach((p) => {
          map[p.id] = { name: p.name, category: p.category, price: p.price };
        });
        catalogMapRef.current = map;
      })
      .catch(() => {
        // Non-fatal — labels fall back to SKU ids if fetch fails
      });
  }, []);

  const productLabel = (id: string) => catalogMapRef.current[id]?.name || id;

  const genRunId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const addStep = (step: Omit<TimelineStep, "id">) => {
    const newStep = { id: nextId(), ...step };
    stepsRef.current = [...stepsRef.current, newStep];
    setSteps(stepsRef.current);
  };

  const finishRun = (status: "passed" | "failed" | "stopped") => {
    const summary: RunSummary = {
      id: nextRunId(),
      goal: runMetaRef.current.goal,
      budget: runMetaRef.current.budget,
      timestamp: new Date().toISOString(),
      status,
      total: committedRef.current,
      steps: stepsRef.current,
      risk: riskRef.current || undefined
    };
    setHistory((prev) => [...prev, summary]);
    setRunning(false);
    setStopping(false);
    setApproval(null);
  };

  const runAgent = () => {
    if (esRef.current) esRef.current.close();
    stepsRef.current = [];
    committedRef.current = 0;
    riskRef.current = null;
    runMetaRef.current = { goal, budget };
    runIdRef.current = genRunId();
    setSteps([]);
    setRunning(true);
    setCommitted(0);
    setGateStatus("running");
    setViewingId(null);
    setRisk(null);
    setApproval(null);
    setStopping(false);
    setLastOrder(null);

    const params = new URLSearchParams({ goal, runId: runIdRef.current });
    if (budget) params.set("budget", budget);
    const es = new EventSource(`${API_BASE}/agent/run?${params.toString()}`);
    esRef.current = es;

    es.addEventListener("goal_received", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "goal_received",
        label: "Goal received",
        status: "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div className="text-slate-800 font-medium italic">"{data.goal}"</div>
            {data.budget && (
              <div className="font-mono text-[11px] text-muted">
                Stated Budget: ₹{data.budget}
              </div>
            )}
          </div>
        )
      });
    });

    es.addEventListener("catalog_fetched", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "catalog_fetched",
        label: `Catalog queried — ${data.count} SKUs available`,
        status: "info",
        timestamp: data.timestamp,
        raw: data
      });
    });

    es.addEventListener("goal_interpreted", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "goal_interpreted",
        label: data.categories
          ? `Goal interpreted — restricted to: ${data.categories.join(", ")}`
          : "Goal interpreted — no category restriction",
        status: "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div>{data.reason}</div>
            <div className="font-mono text-[11px] text-muted">
              Eligible SKUs: {data.eligibleCount} / {data.totalCount}
            </div>
          </div>
        )
      });
    });

    es.addEventListener("cart_proposed", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      committedRef.current = data.total_estimated || 0;
      setCommitted(committedRef.current);
      addStep({
        event: "cart_proposed",
        label: data.revised ? "Cart revised" : "Cart proposed",
        status: "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              {data.revised ? "Revised Selection" : "Proposed Selection"}
            </div>
            <div className="divide-y divide-line/60">
              {data.cart.map((c: any) => (
                <div key={c.id} className="py-1 flex items-baseline justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-emerald-700">✓ {productLabel(c.id)}</span>
                    <span className="font-mono text-muted text-[11px] ml-1.5">× {c.qty}</span>
                    <div className="text-[11px] text-muted truncate">{c.reason}</div>
                  </div>
                </div>
              ))}
              {data.rejected.map((r: any) => (
                <div key={r.id} className="py-1 flex items-baseline justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-500">✕ {productLabel(r.id)}</span>
                    <div className="text-[11px] text-muted truncate">{r.reason}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-1.5 flex items-center justify-between text-xs font-mono font-medium border-t border-line text-ink">
              <span>Estimated Total:</span>
              <span>₹{data.total_estimated}</span>
            </div>
          </div>
        )
      });
    });

    es.addEventListener("stock_check", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "stock_check",
        label: data.revised ? "Stock check (revised cart) — failed" : "Stock check — failed",
        status: "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            {data.checks.map((c: any, i: number) => (
              <div key={i} className="text-rose-700 font-medium">
                {c.reason}
              </div>
            ))}
          </div>
        )
      });
    });

    es.addEventListener("substitution", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "substitution",
        label: data.revised ? "Substitution re-applied on revision" : "Out-of-stock substitution",
        status: "warn",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1.5">
            {data.substitutions.map((s: any, i: number) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-800">
                  <span className="line-through text-slate-400">{s.original}</span>
                  <span>→</span>
                  <span className="text-emerald-700 font-semibold">{s.replacement}</span>
                </div>
                <div className="text-[11px] text-muted mt-0.5">{s.reason}</div>
              </div>
            ))}
            {typeof data.newTotal === "number" && (
              <div className="text-[11px] font-mono text-muted pt-1 border-t border-line/60">
                Updated Total: ₹{data.newTotal}
              </div>
            )}
          </div>
        )
      });
    });

    es.addEventListener("policy_check", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (typeof data.total === "number") {
        committedRef.current = data.total;
        setCommitted(data.total);
      }
      setGateStatus(data.passed ? "passed" : "failed");
      addStep({
        event: "policy_check",
        label: `User policy gate — attempt ${data.attempt}: ${data.passed ? "passed" : "failed"}`,
        status: data.passed ? "pass" : "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="text-xs">
            <div className={`font-medium ${data.passed ? "text-emerald-700" : "text-rose-700"}`}>
              {data.reason}
            </div>
            {typeof data.total === "number" && (
              <div className="text-[11px] font-mono text-muted mt-1">
                Validated Total: ₹{data.total}
              </div>
            )}
          </div>
        )
      });
    });

    es.addEventListener("merchant_policy_check", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setGateStatus(data.passed ? "passed" : "failed");
      addStep({
        event: "merchant_policy_check",
        label: `Merchant policy gate — attempt ${data.attempt}: ${data.passed ? "passed" : "failed"}`,
        status: data.passed ? (data.requiresManualApproval ? "warn" : "pass") : "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="text-xs">
            <div className={`font-medium ${data.passed ? "text-emerald-700" : "text-rose-700"}`}>
              {data.reason}
            </div>
          </div>
        )
      });
    });

    es.addEventListener("revision_started", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setGateStatus("running");
      addStep({
        event: "revision_started",
        label: "Gate failed — requesting one bounded revision",
        status: "warn",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-amber-800 font-medium">{data.reason}</div>
      });
    });

    es.addEventListener("risk_assessed", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      const riskInfo = { score: data.score, level: data.level, reasons: data.reasons };
      riskRef.current = riskInfo;
      setRisk(riskInfo);
      addStep({
        event: "risk_assessed",
        label: `Risk assessed — ${data.score}/100 (${String(data.level).toUpperCase()})`,
        status: data.level === "high" ? "warn" : "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            {data.reasons.map((r: string, i: number) => (
              <div key={i} className="text-xs text-slate-700">
                • {r}
              </div>
            ))}
          </div>
        )
      });
    });

    es.addEventListener("approval_required", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setApproval({ total: data.total, threshold: data.threshold, reason: data.reason });
      addStep({
        event: "approval_required",
        label: "Human approval required",
        status: "warn",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-amber-800 font-medium">{data.reason}</div>
      });
    });

    es.addEventListener("approval_granted", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setApproval(null);
      setDeciding(false);
      addStep({
        event: "approval_granted",
        label: "Purchase approved by human",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="font-mono text-emerald-700 font-medium">₹{data.total} Authorized</div>
      });
    });

    es.addEventListener("order_rejected", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setApproval(null);
      setDeciding(false);
      setGateStatus("failed");
      addStep({
        event: "order_rejected",
        label: "Order rejected — no money action taken",
        status: "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-rose-700 font-medium">{data.reason}</div>
      });
      es.close();
      finishRun("failed");
    });

    es.addEventListener("agent_stopped", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setApproval(null);
      setDeciding(false);
      setGateStatus("failed");
      addStep({
        event: "agent_stopped",
        label: "🛑 Agent stopped via kill switch",
        status: "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-rose-700 font-medium">{data.reason}</div>
      });
      es.close();
      finishRun("stopped");
    });

    es.addEventListener("flow_stopped", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setGateStatus("failed");
      addStep({
        event: "flow_stopped",
        label: "Flow stopped — no money action taken",
        status: "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-rose-700 font-medium">{data.reason}</div>
      });
      es.close();
      finishRun("failed");
    });

    es.addEventListener("order_created", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLastOrder(data.order);
      addStep({
        event: "order_created",
        label: "Payment order created",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div className="font-mono font-medium">{data.order.id}</div>
            <div className="text-xs text-muted">
              ₹{(data.order.amount / 100).toFixed(2)} ·{" "}
              {data.order.source === "razorpay_test_mode"
                ? "Razorpay test-mode"
                : "mock"}
            </div>
          </div>
        )
      });
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (typeof data.total === "number") committedRef.current = data.total;
      setCommitted(committedRef.current);
      setGateStatus("passed");
      addStep({
        event: "done",
        label: "Flow complete — order placed",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1.5">
            <div className="font-mono text-xs font-semibold text-emerald-700">
              Order {data.orderId} · ₹{data.total}
            </div>
            <div className="text-xs text-muted space-y-0.5">
              {data.finalCart.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span>• {productLabel(c.id)}</span>
                  <span className="font-mono">× {c.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )
      });
      es.close();
      finishRun("passed");
    });

    es.addEventListener("error", (e) => {
      let message = "Connection error";
      try {
        message = JSON.parse((e as MessageEvent).data).message;
      } catch {
        /* SSE-level error */
      }
      setGateStatus("failed");
      addStep({
        event: "error",
        label: "Error",
        status: "fail",
        timestamp: new Date().toISOString(),
        detail: <div className="text-rose-700 font-medium">{message}</div>
      });
      es.close();
      finishRun("failed");
    });
  };

  const handleApprove = async (approved: boolean) => {
    setDeciding(true);
    try {
      await fetch(`${API_BASE}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runIdRef.current, approved })
      });
    } catch {
      setDeciding(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await fetch(`${API_BASE}/agent/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runIdRef.current })
      });
    } catch {
      setStopping(false);
    }
  };

  const exportCurrentTrail = (stepsToExport: TimelineStep[]) => {
    const payload = stepsToExport.map((s) => ({
      step: s.event,
      label: s.label,
      status: s.status,
      timestamp: s.timestamp,
      data: s.raw ?? null
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const budgetNum = budget ? Number(budget) : null;
  const viewedRun = viewingId ? history.find((h) => h.id === viewingId) : null;
  const displaySteps = viewedRun ? viewedRun.steps : steps;
  const displayRunning = viewedRun ? false : running;
  const displayRisk = viewedRun ? viewedRun.risk || null : risk;
  const displayCommitted = viewedRun ? viewedRun.total : committed;
  const displayBudgetNum = viewedRun ? Number(viewedRun.budget) || null : budgetNum;

  // Find order info if available in steps
  const orderStep = displaySteps.find((s) => s.event === "order_created");
  const orderData = (orderStep?.raw as any)?.order || (viewedRun ? null : lastOrder);
  const isRunFinished =
    !displayRunning &&
    displaySteps.length > 0 &&
    displaySteps.some((s) =>
      ["done", "flow_stopped", "agent_stopped", "order_rejected", "error"].includes(s.event)
    );
  const isRunSuccess = displaySteps.some((s) => s.event === "done");

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="border-b border-line bg-panel sticky top-0 z-40 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo / Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center font-bold tracking-tight shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base tracking-tight text-ink">
                  CUSTOS
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-muted border border-line">
                  FinTech Agent
                </span>
              </div>
              <p className="text-[11px] text-muted hidden sm:block">
                The Gated Buyer Agent
              </p>
            </div>
          </div>

          {/* Right Action & System Status */}
          <div className="flex items-center gap-3">
            {/* Status Pill */}
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-surface border border-line text-muted">
              <span
                className={`w-2 h-2 rounded-full ${
                  running
                    ? "bg-emerald-500 animate-pulse"
                    : approval
                    ? "bg-amber-500 animate-pulse"
                    : "bg-slate-400"
                }`}
              />
              <span className="text-[11px] font-mono">
                {running ? "AGENT LIVE" : approval ? "AWAITING APPROVAL" : "SYSTEM READY"}
              </span>
            </div>

            {/* Emergency Kill Switch */}
            {running && (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-fail text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs shrink-0"
                title="Emergency Kill Switch — immediately halts the autonomous agent"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{stopping ? "Halting…" : "Stop agent"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {/* Human Approval Required Banner */}
        {approval && !viewedRun && (
          <div className="mb-6">
            <ApprovalGate request={approval} onDecide={handleApprove} deciding={deciding} />
          </div>
        )}

        {/* Top Summary Section — Only shown during/after runs */}
        {(displayRunning || displaySteps.length > 0) && (
          <div className="mb-6 space-y-4">
            {/* 3 Compact Metric Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {/* Block 1: Committed Spend */}
              <BudgetMeter
                budget={displayBudgetNum}
                committed={displayCommitted}
                status={viewedRun ? (viewedRun.status === "passed" ? "passed" : "failed") : gateStatus}
              />

              {/* Block 2: Transaction Risk */}
              {displayRisk ? (
                <RiskMeter risk={displayRisk} />
              ) : (
                <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-muted">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Transaction Risk
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                      PENDING
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 py-1">
                    Risk evaluated post-policy approval
                  </div>
                  <div className="text-[11px] text-muted">
                    Calculates cart anomalies & substitution risk
                  </div>
                </div>
              )}

              {/* Block 3: Transaction Status */}
              <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-muted">
                      {approval ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-warn" />
                      ) : isRunFinished ? (
                        isRunSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-pass" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-fail" />
                        )
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Policy Gate
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border ${
                      approval
                        ? "bg-warn-bg text-warn border-warn-border"
                        : isRunFinished
                        ? isRunSuccess
                          ? "bg-pass-bg text-pass border-pass-border"
                          : "bg-fail-bg text-fail border-fail-border"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {approval
                      ? "ACTION NEEDED"
                      : isRunFinished
                      ? isRunSuccess
                        ? "APPROVED"
                        : "FAILED"
                      : displayRunning
                      ? "EVALUATING"
                      : "STANDBY"}
                  </span>
                </div>

                <div className="font-mono text-base font-semibold text-ink">
                  {approval
                    ? "Paused for Approval"
                    : isRunFinished
                    ? isRunSuccess
                      ? "Transaction Cleared"
                      : "Gate Rejected"
                    : displayRunning
                    ? "Validating Constraints"
                    : "Ready"}
                </div>

                <div className="text-[11px] text-muted mt-1 truncate">
                  User budget & merchant policy verification
                </div>
              </div>
            </div>

            {/* Run Complete Summary Card */}
            {isRunFinished && (
              <div className="bg-panel border border-line rounded-xl p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                        isRunSuccess
                          ? "bg-pass text-white"
                          : "bg-fail text-white"
                      }`}
                    >
                      {isRunSuccess ? "Run Complete" : "Run Terminated"}
                    </span>
                    <span className="text-xs font-semibold text-ink">
                      {isRunSuccess ? "Order successfully authorized" : "Execution halted safely"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                    <div>
                      Spend:{" "}
                      <span className="font-mono font-semibold text-ink">
                        ₹{displayCommitted}
                      </span>
                      {displayBudgetNum && (
                        <span className="text-muted"> / ₹{displayBudgetNum}</span>
                      )}
                    </div>
                    {displayRisk && (
                      <div>
                        Risk:{" "}
                        <span className="font-mono font-semibold text-ink">
                          {displayRisk.score}/100 ({displayRisk.level.toUpperCase()})
                        </span>
                      </div>
                    )}
                    {orderData?.id && (
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800 bg-surface px-2 py-0.5 rounded border border-line">
                        <CreditCard className="w-3 h-3 text-muted" />
                        <span>{orderData.id}</span>
                      </div>
                    )}
                    {orderData?.source && (
                      <span className="text-[11px] font-medium text-slate-600">
                        {orderData.source === "razorpay_test_mode"
                          ? "Razorpay Test Mode"
                          : "Mock Mode"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportCurrentTrail(displaySteps)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-surface hover:bg-slate-100 border border-line px-3 py-2 rounded-lg transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-muted" />
                    <span>Export Audit JSON</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Run History Selector */}
        {history.length > 0 && (
          <div className="mb-6">
            <RunHistory
              history={history}
              viewingId={viewingId}
              onSelect={setViewingId}
              isLiveActive={running}
            />
          </div>
        )}

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Buyer Goal & Policy & Catalog (40-42%) */}
          <div className="lg:col-span-5">
            <GoalPanel
              goal={goal}
              setGoal={setGoal}
              budget={budget}
              setBudget={setBudget}
              onRun={runAgent}
              running={running}
              waitingApproval={!!approval}
            />
          </div>

          {/* Right Column: Live Execution Timeline (58-60%) */}
          <div className="lg:col-span-7 lg:sticky lg:top-20">
            <AuditTrail
              steps={displaySteps}
              running={displayRunning}
              waitingApproval={!!approval && !viewedRun}
            />
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-line bg-panel py-3 mt-8 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Custos — The Gated Buyer Agent</span>
          <span className="text-[11px] font-mono opacity-80">
            Governed AI Commerce · Razorpay Test Mode
          </span>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ScrollText,
  Square,
  ShieldCheck,
  CheckCircle2,
  XCircle,
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
import PaymentPanel from "./components/PaymentPanel";
import RunHistory from "./components/RunHistory";
import type { TimelineStep, RunSummary, RiskInfo, ApprovalRequest, PaymentInfo } from "./types";
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
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    id: string;
    source: string;
    amount: number;
  } | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const paymentRef = useRef<PaymentInfo | null>(null);
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
      risk: riskRef.current || undefined,
      payment: paymentRef.current || undefined
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
    paymentRef.current = null;
    runMetaRef.current = { goal, budget };
    runIdRef.current = genRunId();
    setSteps([]);
    setRunning(true);
    setCommitted(0);
    setGateStatus("running");
    setViewingId(null);
    setRisk(null);
    setApproval(null);
    setPayment(null);
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
            <div className="text-ink font-medium italic">"{data.goal}"</div>
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
                    <span className="font-medium text-pass">✓ {productLabel(c.id)}</span>
                    <span className="font-mono text-muted text-[11px] ml-1.5">× {c.qty}</span>
                    <div className="text-[11px] text-muted truncate">{c.reason}</div>
                  </div>
                </div>
              ))}
              {data.rejected.map((r: any) => (
                <div key={r.id} className="py-1 flex items-baseline justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-muted">✕ {productLabel(r.id)}</span>
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
              <div key={i} className="text-fail font-medium">
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
                <div className="flex items-center gap-1.5 font-medium text-gold-dark">
                  <span className="line-through text-muted">{s.original}</span>
                  <span>→</span>
                  <span className="text-pass font-semibold">{s.replacement}</span>
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
        label: `Your policy gate — attempt ${data.attempt}: ${data.passed ? "passed" : "failed"}`,
        status: data.passed ? "pass" : "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="text-xs">
            <div className={`font-medium ${data.passed ? "text-pass" : "text-fail"}`}>
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
            <div className={`font-medium ${data.passed ? "text-pass" : "text-fail"}`}>
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
        detail: <div className="text-gold-dark font-medium">{data.reason}</div>
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
              <div key={i} className="text-xs text-ink">
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
        detail: <div className="text-gold-dark font-medium">{data.reason}</div>
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
        detail: <div className="font-mono text-pass font-medium">₹{data.total} Human Approval Granted</div>
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
        detail: <div className="text-fail font-medium">{data.reason}</div>
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
        detail: <div className="text-fail font-medium">{data.reason}</div>
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
        detail: <div className="text-fail font-medium">{data.reason}</div>
      });
      es.close();
      finishRun("failed");
    });

    es.addEventListener("order_created", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLastOrder(data.order);
      addStep({
        event: "order_created",
        label: "Payment Order Created",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div className="text-xs font-medium text-ink">
              Razorpay Test Mode order created.
            </div>
            <div className="font-mono text-xs text-muted">
              Order ID: <span className="text-ink font-semibold">{data.order.id}</span>
            </div>
            <div className="font-mono text-xs text-muted">
              Amount: <span className="text-gold font-bold">₹{(data.order.amount / 100).toFixed(2)}</span>
            </div>
          </div>
        )
      });
    });

    es.addEventListener("awaiting_payment", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      const paymentInfo: PaymentInfo = {
        status: "awaiting_payment",
        orderId: data.order.id,
        amount: data.order.amount,
        currency: data.order.currency,
        reason: data.reason
      };
      paymentRef.current = paymentInfo;
      setPayment(paymentInfo);
      addStep({
        event: "awaiting_payment",
        label: "Awaiting Razorpay Test Payment",
        status: "warn",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div className="text-gold-dark font-medium text-xs">
              The purchase has passed all governance checks. Waiting for explicit user action to begin Razorpay Test Mode Checkout.
            </div>
            <div className="font-mono text-[11px] text-muted">
              Order ID: {data.order.id} · ₹{(data.order.amount / 100).toFixed(2)}
            </div>
          </div>
        )
      });
    });

    es.addEventListener("payment_initiated", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setPayment((prev) => (prev ? { ...prev, status: "processing" } : null));
      addStep({
        event: "payment_initiated",
        label: "Payment Initiated — Opening Razorpay Checkout",
        status: "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="text-xs text-ink">
            User explicitly initiated Razorpay Test Mode Checkout.
          </div>
        )
      });
    });

    es.addEventListener("payment_verification_started", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setPayment((prev) => (prev ? { ...prev, status: "verifying" } : null));
      addStep({
        event: "payment_verification_started",
        label: "Verifying Payment Signature With Backend",
        status: "info",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="text-xs text-muted">
            Securely verifying Razorpay payment signature.
          </div>
        )
      });
    });

    es.addEventListener("payment_verified", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      const updated: PaymentInfo | null = paymentRef.current
        ? { ...paymentRef.current, status: "verified", paymentId: data.payment_id }
        : null;
      paymentRef.current = updated;
      setPayment(updated);
      addStep({
        event: "payment_verified",
        label: "Razorpay Payment Verified",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1">
            <div className="text-pass font-medium text-xs">HMAC SHA-256 signature verified server-side.</div>
            <div className="font-mono text-[11px] text-muted">
              Payment ID: <span className="text-ink font-semibold">{data.payment_id}</span>
            </div>
          </div>
        )
      });
    });

    es.addEventListener("payment_cancelled", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      const updated: PaymentInfo | null = paymentRef.current
        ? { ...paymentRef.current, status: "cancelled", reason: data.reason }
        : null;
      paymentRef.current = updated;
      setPayment(updated);
      setGateStatus("failed");
      addStep({
        event: "payment_cancelled",
        label: "Payment cancelled by user",
        status: "warn",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-muted font-medium">{data.reason || "Payment cancelled by user."}</div>
      });
      es.close();
      finishRun("stopped");
    });

    es.addEventListener("payment_failed", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      const updated: PaymentInfo | null = paymentRef.current
        ? { ...paymentRef.current, status: "failed", reason: data.reason }
        : null;
      paymentRef.current = updated;
      setPayment(updated);
      setGateStatus("failed");
      addStep({
        event: "payment_failed",
        label: "Razorpay Test Mode payment failed",
        status: "fail",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="text-fail font-medium">{data.reason || "Payment could not be completed."}</div>
      });
      es.close();
      finishRun("failed");
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (typeof data.total === "number") committedRef.current = data.total;
      setCommitted(committedRef.current);
      setGateStatus("passed");
      if (data.paymentId) {
        const updated: PaymentInfo | null = paymentRef.current
          ? { ...paymentRef.current, status: "verified", paymentId: data.paymentId }
          : { status: "verified", orderId: data.orderId, amount: data.total * 100, currency: "INR", paymentId: data.paymentId };
        paymentRef.current = updated;
        setPayment(updated);
      }
      addStep({
        event: "done",
        label: data.paymentId ? "Transaction Completed" : "Flow Complete — Order Placed",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <div className="space-y-1.5">
            <div className="font-mono text-xs font-semibold text-pass">
              Order {data.orderId} · ₹{data.total}
              {data.paymentId && <span className="ml-2 text-muted font-normal font-mono">({data.paymentId})</span>}
            </div>
            <div className="text-xs text-muted space-y-0.5">
              {data.finalCart.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span>• {productLabel(c.id)}</span>
                  <span className="font-mono">× {c.qty}</span>
                </div>
              ))}
            </div>
            {data.paymentId && (
              <div className="text-[11px] text-pass font-medium pt-1 border-t border-line/60">
                Payment completed successfully after policy validation and secure backend payment verification.
              </div>
            )}
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
        detail: <div className="text-fail font-medium">{message}</div>
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

  const budgetNum = budget ? Number(budget) : null;
  const viewedRun = viewingId ? history.find((h) => h.id === viewingId) : null;
  const displaySteps = viewedRun ? viewedRun.steps : steps;
  const displayRunning = viewedRun ? false : running;
  const displayRisk = viewedRun ? viewedRun.risk || null : risk;
  const displayCommitted = viewedRun ? viewedRun.total : committed;
  const displayBudgetNum = viewedRun ? Number(viewedRun.budget) || null : budgetNum;

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
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      {/* Header — Restored Previous Logo & Bigger Title, No 'FINTECH AGENT' */}
      <header className="border-b border-line bg-panel sticky top-0 z-40 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold to-[#E5A95A] flex items-center justify-center shadow-sm shrink-0">
              <ScrollText className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-ink tracking-tight">
                Custos — The Gated Buyer Agent
              </h1>
              <p className="text-xs text-muted hidden sm:block">
                Shops a merchant's catalog, gated and audited at every money action.
              </p>
            </div>
          </div>

          {/* Right Status & Kill Switch */}
          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gold-light border border-gold-border text-gold-dark">
              <span
                className={`w-2 h-2 rounded-full ${
                  payment?.status === "awaiting_payment"
                    ? "bg-gold animate-pulse"
                    : payment?.status === "processing" || payment?.status === "verifying"
                    ? "bg-amber-500 animate-pulse"
                    : isRunSuccess
                    ? "bg-pass"
                    : running
                    ? "bg-pass animate-pulse"
                    : approval
                    ? "bg-gold animate-pulse"
                    : "bg-gold"
                }`}
              />
              <span className="text-[11px] font-mono font-semibold">
                {isRunSuccess
                  ? "✓ TRANSACTION COMPLETED"
                  : payment?.status === "verified"
                  ? "✓ PAYMENT VERIFIED"
                  : payment?.status === "verifying"
                  ? "VERIFYING PAYMENT"
                  : payment?.status === "processing"
                  ? "PAYMENT IN PROGRESS"
                  : payment?.status === "awaiting_payment"
                  ? "READY FOR PAYMENT"
                  : payment?.status === "failed"
                  ? "PAYMENT FAILED"
                  : payment?.status === "cancelled"
                  ? "PAYMENT CANCELLED"
                  : running
                  ? "AGENT LIVE"
                  : approval
                  ? "AWAITING APPROVAL"
                  : isRunFinished
                  ? "EXECUTION HALTED"
                  : "READY"}
              </span>
            </div>

            {/* Emergency Kill Switch */}
            {running && (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-fail text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs shrink-0"
                title="Emergency Kill Switch — stop the agent immediately"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{stopping ? "Halting…" : "Stop agent"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {/* Human Approval Required Banner */}
        {approval && !viewedRun && (
          <div className="mb-6">
            <ApprovalGate request={approval} onDecide={handleApprove} deciding={deciding} />
          </div>
        )}

        {/* Razorpay Test Mode Payment Panel */}
        {payment && !viewedRun && (
          <div className="mb-6">
            <PaymentPanel
              payment={payment}
              runId={runIdRef.current}
              onInitiated={() => {
                setPayment((prev) => (prev ? { ...prev, status: "processing" } : null));
              }}
              onVerifying={() => {
                setPayment((prev) => (prev ? { ...prev, status: "verifying" } : null));
              }}
            />
          </div>
        )}

        {/* Top Summary Section — 3 Compact Blocks & Completion Card */}
        {(displayRunning || displaySteps.length > 0) && (
          <div className="mb-6 space-y-4">
            {/* 3 Metric Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <BudgetMeter
                budget={displayBudgetNum}
                committed={displayCommitted}
                status={viewedRun ? (viewedRun.status === "passed" ? "passed" : "failed") : gateStatus}
              />

              {displayRisk ? (
                <RiskMeter risk={displayRisk} />
              ) : (
                <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gold-light flex items-center justify-center text-gold">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Transaction Risk
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border bg-surface text-muted border-line">
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

              <div className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gold-light flex items-center justify-center text-gold">
                      {approval ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-gold" />
                      ) : isRunFinished ? (
                        isRunSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-pass" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-fail" />
                        )
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-gold" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Policy Gate
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border ${
                      approval
                        ? "bg-gold-light text-gold-dark border-gold-border"
                        : isRunFinished
                        ? isRunSuccess
                          ? "bg-pass-bg text-pass border-pass-border"
                          : "bg-fail-bg text-fail border-fail-border"
                        : "bg-gold-light text-gold border-gold-border"
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
                      ? "Policy Cleared"
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

            {/* Top Status & Summary Card */}
            {(orderData || payment || isRunFinished) && (() => {
              let badgeText = "READY FOR PAYMENT";
              let badgeColor = "bg-gold text-white";
              let mainHeading = "Order Ready for Payment";
              let descText = "Awaiting Razorpay Test Mode payment.";

              if (isRunSuccess) {
                badgeText = "✓ TRANSACTION COMPLETED";
                badgeColor = "bg-pass text-white";
                mainHeading = "Transaction Completed";
                descText = "Payment completed successfully after policy validation and backend verification.";
              } else if (payment?.status === "verified") {
                badgeText = "✓ PAYMENT VERIFIED";
                badgeColor = "bg-pass text-white";
                mainHeading = "Payment Verified Successfully";
                descText = "Razorpay payment signature verified successfully.";
              } else if (payment?.status === "verifying") {
                badgeText = "VERIFYING PAYMENT";
                badgeColor = "bg-amber-600 text-white animate-pulse";
                mainHeading = "Verifying Payment";
                descText = "Securely verifying payment with the backend.";
              } else if (payment?.status === "processing") {
                badgeText = "PAYMENT IN PROGRESS";
                badgeColor = "bg-amber-600 text-white animate-pulse";
                mainHeading = "Payment Initiated";
                descText = "Razorpay Test Mode Checkout is in progress.";
              } else if (payment?.status === "awaiting_payment" || (orderData && !isRunFinished)) {
                badgeText = "READY FOR PAYMENT";
                badgeColor = "bg-gold text-white";
                mainHeading = "Order Ready for Payment";
                descText = "Awaiting Razorpay Test Mode payment.";
              } else if (payment?.status === "failed") {
                badgeText = "PAYMENT FAILED";
                badgeColor = "bg-fail text-white";
                mainHeading = "Payment Failed";
                descText = payment.reason || "Razorpay Test Mode payment could not be completed.";
              } else if (payment?.status === "cancelled") {
                badgeText = "PAYMENT CANCELLED";
                badgeColor = "bg-muted text-white";
                mainHeading = "Payment Cancelled";
                descText = "Payment cancelled by user. No payment was completed.";
              } else if (isRunFinished && !isRunSuccess) {
                badgeText = "RUN TERMINATED";
                badgeColor = "bg-fail text-white";
                mainHeading = "Execution Halted Safely";
                descText = "Governance policy gate halted the flow — no money action taken.";
              }

              return (
                <div className="bg-panel border-2 border-gold-border rounded-xl p-4 sm:p-5 shadow-card flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded ${badgeColor}`}
                        >
                          {badgeText}
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          {mainHeading}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {descText}
                      </p>
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
                          <div className="flex items-center gap-1 font-mono text-[11px] text-ink bg-gold-light px-2 py-0.5 rounded border border-gold-border">
                            <CreditCard className="w-3 h-3 text-gold" />
                            <span>{orderData.id}</span>
                          </div>
                        )}
                        {(payment?.paymentId || viewedRun?.payment?.paymentId) && (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-pass bg-pass-bg px-2 py-0.5 rounded border border-pass-border">
                            <span>{payment?.paymentId || viewedRun?.payment?.paymentId}</span>
                          </div>
                        )}
                        {orderData?.source && (
                          <span className="text-[11px] font-medium text-gold-dark">
                            {orderData.source === "razorpay_test_mode"
                              ? "Razorpay Test Mode"
                              : "Mock Mode"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Final Completed State Checklist — Correction 5 */}
                  {isRunSuccess && (
                    <div className="mt-1 pt-3 border-t border-line/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-pass font-medium">
                      <div className="flex items-center gap-1.5"><span>✓</span><span>Policy validated</span></div>
                      <div className="flex items-center gap-1.5"><span>✓</span><span>Merchant policy approved</span></div>
                      <div className="flex items-center gap-1.5"><span>✓</span><span>Order created</span></div>
                      <div className="flex items-center gap-1.5"><span>✓</span><span>User initiated payment</span></div>
                      <div className="flex items-center gap-1.5"><span>✓</span><span>Razorpay payment completed</span></div>
                      <div className="flex items-center gap-1.5"><span>✓</span><span>Backend signature verified</span></div>
                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-2 font-bold"><span>✓</span><span>Transaction completed</span></div>
                    </div>
                  )}
                </div>
              );
            })()}
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

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Goal, Vertical Catalog, and Policy Controls (approx 45%) */}
          <div className="lg:col-span-5">
            <GoalPanel
              goal={goal}
              setGoal={setGoal}
              budget={budget}
              setBudget={setBudget}
              onRun={runAgent}
              running={running}
              waitingApproval={!!approval}
              waitingPayment={payment?.status === "awaiting_payment"}
            />
          </div>

          {/* Right Column: Live Execution Timeline (approx 55%) */}
          <div className="lg:col-span-7 lg:sticky lg:top-20">
            <AuditTrail
              steps={displaySteps}
              running={displayRunning}
              waitingApproval={!!approval && !viewedRun}
              waitingPayment={payment?.status === "awaiting_payment" && !viewedRun}
            />
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-line bg-panel py-3 mt-8 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Custos — The Gated Buyer Agent</span>
          <span className="text-[11px] font-mono opacity-80">
            Governed AI Commerce
          </span>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ScrollText, Square } from "lucide-react";
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
  const esRef = useRef<EventSource | null>(null);
  const stepsRef = useRef<TimelineStep[]>([]);
  const committedRef = useRef(0);
  const riskRef = useRef<RiskInfo | null>(null);
  const runIdRef = useRef<string>("");
  const runMetaRef = useRef({ goal: "", budget: "" });
  // Maps a catalog product id ("p4") to its human-readable name and price,
  // so the audit trail can read "Roasted Chana (300g)" instead of "p4" —
  // a raw SKU id means nothing to a judge or non-technical reader. Kept in
  // a ref (not state) so it's always current at event-handling time
  // regardless of when the fetch resolves relative to a run starting.
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
        // Non-fatal — labels just fall back to raw ids below if this fails.
      });
  }, []);

  // Human-readable label for a catalog id. Falls back to the raw id only if
  // the catalog hasn't loaded yet or the id is unrecognized, so the trail
  // never breaks — it just briefly shows the id until the fetch resolves.
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
          <>
            <div>"{data.goal}"</div>
            {data.budget && <div className="font-mono">Budget: ₹{data.budget}</div>}
          </>
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
          <>
            <div>{data.reason}</div>
            <div className="font-mono">Eligible SKUs: {data.eligibleCount} / {data.totalCount}</div>
          </>
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
          <>
            {data.cart.map((c: any) => (
              <div key={c.id} className="text-pass">✓ {productLabel(c.id)} × {c.qty} — {c.reason}</div>
            ))}
            {data.rejected.map((r: any) => (
              <div key={r.id} className="text-muted">✕ {productLabel(r.id)} — {r.reason}</div>
            ))}
            <div className="font-mono text-ink pt-0.5">Estimated total: ₹{data.total_estimated}</div>
          </>
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
        detail: data.substitutions.map((s: any, i: number) => (
          <div key={i}>
            {s.original} → {s.replacement} — {s.reason}
          </div>
        ))
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
        detail: <div>{data.reason}</div>
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
        detail: <div>{data.reason}</div>
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
        detail: <div>{data.reason}</div>
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
          <>
            {data.reasons.map((r: string, i: number) => (
              <div key={i}>• {r}</div>
            ))}
          </>
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
        detail: <div>{data.reason}</div>
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
        detail: <div className="font-mono">₹{data.total}</div>
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
        detail: <div>{data.reason}</div>
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
        detail: <div>{data.reason}</div>
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
        detail: <div>{data.reason}</div>
      });
      es.close();
      finishRun("failed");
    });

    es.addEventListener("order_created", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addStep({
        event: "order_created",
        label: "Order created",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: (
          <>
            <div className="font-mono">{data.order.id}</div>
            <div>
              ₹{(data.order.amount / 100).toFixed(2)} · {data.order.source === "razorpay_test_mode" ? "Razorpay test-mode" : "mock"}
            </div>
          </>
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
          <>
            <div className="font-mono">Order {data.orderId} · ₹{data.total}</div>
            <div className="mt-1 space-y-0.5">
              {data.finalCart.map((c: any) => (
                <div key={c.id}>• {productLabel(c.id)} × {c.qty}</div>
              ))}
            </div>
          </>
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
        /* SSE-level error, not a server-sent error event */
      }
      setGateStatus("failed");
      addStep({
        event: "error",
        label: "Error",
        status: "fail",
        timestamp: new Date().toISOString(),
        detail: <div>{message}</div>
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
      // If the request fails, the run will stall on the backend's pending
      // promise — resurface the option to try again rather than hiding it.
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

  return (
    <div className="min-h-full">
      <header className="border-b-2 border-ink bg-panel">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-sm shrink-0">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-ink">Custos — The Gated Buyer Agent</h1>
          </div>
          <p className="text-xs text-muted max-w-xs text-right hidden md:block">
            Shops a merchant's catalog, gated and audited at every money action.
          </p>
          {running && (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopping}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-fail text-white hover:bg-fail/90 disabled:opacity-50 transition-colors shrink-0"
              title="Emergency Kill Switch — stop the agent immediately"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {stopping ? "Stopping…" : "Stop agent"}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {(running || steps.length > 0) && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <BudgetMeter budget={budgetNum} committed={committed} status={gateStatus} />
            {displayRisk && <RiskMeter risk={displayRisk} />}
          </div>
        )}
        {approval && !viewedRun && (
          <div className="mb-4">
            <ApprovalGate request={approval} onDecide={handleApprove} deciding={deciding} />
          </div>
        )}
        {history.length > 0 && (
          <div className="mb-6">
            <RunHistory history={history} viewingId={viewingId} onSelect={setViewingId} isLiveActive={running} />
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <GoalPanel
            goal={goal}
            setGoal={setGoal}
            budget={budget}
            setBudget={setBudget}
            onRun={runAgent}
            running={running}
            waitingApproval={!!approval}
          />
          <div className="lg:sticky lg:top-8">
            <AuditTrail steps={displaySteps} running={displayRunning} />
          </div>
        </div>
      </main>
    </div>
  );
}

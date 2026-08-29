import { useRef, useState } from "react";
import { ScrollText } from "lucide-react";
import GoalPanel from "./components/GoalPanel";
import AuditTrail from "./components/AuditTrail";
import BudgetMeter from "./components/BudgetMeter";
import RunHistory from "./components/RunHistory";
import type { TimelineStep, RunSummary } from "./types";
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
  const esRef = useRef<EventSource | null>(null);
  const stepsRef = useRef<TimelineStep[]>([]);
  const committedRef = useRef(0);
  const runMetaRef = useRef({ goal: "", budget: "" });

  const addStep = (step: Omit<TimelineStep, "id">) => {
    const newStep = { id: nextId(), ...step };
    stepsRef.current = [...stepsRef.current, newStep];
    setSteps(stepsRef.current);
  };

  const finishRun = (status: "passed" | "failed") => {
    const summary: RunSummary = {
      id: nextRunId(),
      goal: runMetaRef.current.goal,
      budget: runMetaRef.current.budget,
      timestamp: new Date().toISOString(),
      status,
      total: committedRef.current,
      steps: stepsRef.current
    };
    setHistory((prev) => [...prev, summary]);
    setRunning(false);
  };

  const runAgent = () => {
    if (esRef.current) esRef.current.close();
    stepsRef.current = [];
    committedRef.current = 0;
    runMetaRef.current = { goal, budget };
    setSteps([]);
    setRunning(true);
    setCommitted(0);
    setGateStatus("running");
    setViewingId(null);

    const params = new URLSearchParams({ goal });
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
              <div key={c.id} className="text-pass">✓ {c.id} × {c.qty} — {c.reason}</div>
            ))}
            {data.rejected.map((r: any) => (
              <div key={r.id} className="text-muted">✕ {r.id} — {r.reason}</div>
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
        label: `Policy gate — attempt ${data.attempt}: ${data.passed ? "passed" : "failed"}`,
        status: data.passed ? "pass" : "fail",
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
        label: "Flow complete",
        status: "pass",
        timestamp: data.timestamp,
        raw: data,
        detail: <div className="font-mono">Order {data.orderId} · ₹{data.total}</div>
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

  const budgetNum = budget ? Number(budget) : null;
  const viewedRun = viewingId ? history.find((h) => h.id === viewingId) : null;
  const displaySteps = viewedRun ? viewedRun.steps : steps;
  const displayRunning = viewedRun ? false : running;

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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {(running || steps.length > 0) && (
          <div className="mb-4">
            <BudgetMeter budget={budgetNum} committed={committed} status={gateStatus} />
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
          />
          <div className="lg:sticky lg:top-8">
            <AuditTrail steps={displaySteps} running={displayRunning} />
          </div>
        </div>
      </main>
    </div>
  );
}

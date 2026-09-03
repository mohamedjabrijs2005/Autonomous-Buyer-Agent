import { useEffect, useState } from "react";
import { ShoppingCart, Play, Loader2, Package, ShieldCheck, Repeat, Lock } from "lucide-react";
import { API_BASE } from "../config";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  max_discount_pct: number;
};

type Props = {
  goal: string;
  setGoal: (v: string) => void;
  budget: string;
  setBudget: (v: string) => void;
  onRun: () => void;
  running: boolean;
  waitingApproval?: boolean;
};

const PRESETS = [
  { label: "Snacks under ₹500", goal: "restock snacks, prefer variety", budget: "500" },
  { label: "Beverages under ₹1000", goal: "restock beverages for the pantry", budget: "1000" },
  { label: "Mixed, ₹2000", goal: "restock office snacks and stationery, prefer variety", budget: "2000" }
];

export default function GoalPanel({
  goal,
  setGoal,
  budget,
  setBudget,
  onRun,
  running,
  waitingApproval
}: Props) {
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    const attempt = (retriesLeft: number) => {
      fetch(`${API_BASE}/catalog`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setCatalog(data);
        })
        .catch(() => {
          if (cancelled) return;
          if (retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1), 3000);
          } else {
            setCatalog([]);
          }
        });
    };
    attempt(3);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Buyer Agent Goal Card */}
      <div className="bg-panel border border-line rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingCart className="w-5 h-5 text-gold" />
          <h2 className="font-display font-semibold text-lg text-ink">Buyer agent goal</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Describe what the agent should shop for. It reasons over the live catalog, stays inside your
          budget, and every decision it makes is logged live on the right.
        </p>

        {/* Goal Textarea */}
        <label
          htmlFor="goal-input"
          className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5"
        >
          Goal
        </label>
        <textarea
          id="goal-input"
          name="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. restock snacks, prefer variety"
          disabled={running}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none resize-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {/* Budget Input */}
        <label
          htmlFor="budget-input"
          className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5 mt-4"
        >
          Budget (₹)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink">
            ₹
          </span>
          <input
            id="budget-input"
            name="budget"
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="500"
            disabled={running}
            className="w-full pl-8 pr-3 py-2 text-sm font-mono font-medium rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-gold focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2 mt-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={running}
              onClick={() => {
                setGoal(p.goal);
                setBudget(p.budget);
              }}
              className="text-xs px-3 py-1 rounded-full border border-line bg-surface text-muted hover:text-gold-hover hover:border-gold hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Safeguard Highlights */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-gold-light border border-gold-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-gold font-medium mb-1">
              <Package className="w-3.5 h-3.5" /> Catalog
            </div>
            <p className="text-sm font-semibold text-ink">{catalog.length || 12} SKUs</p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-pass" /> Gate
            </div>
            <p className="text-sm font-semibold text-ink">Budget + stock</p>
          </div>
          <div className="rounded-lg bg-pass-bg border border-pass-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-pass font-medium mb-1">
              <Repeat className="w-3.5 h-3.5" /> Retry
            </div>
            <p className="text-sm font-semibold text-ink">1 bounded</p>
          </div>
        </div>

        {/* Primary Run Agent Button (White & Gold Theme) */}
        <button
          type="button"
          onClick={onRun}
          disabled={running || !goal.trim()}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-gold text-white font-medium text-sm py-2.5 hover:bg-gold-hover active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-gold"
        >
          {waitingApproval ? (
            <>
              <Lock className="w-4 h-4 animate-pulse" />
              <span>Waiting for human approval…</span>
            </>
          ) : running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Agent running…</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run agent</span>
            </>
          )}
        </button>
      </div>

      {/* Agent-Readable Catalog — Vertical directly present on page */}
      <div className="bg-panel border border-line rounded-xl p-6 shadow-card">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gold" />
            <h3 className="font-display font-semibold text-sm text-ink">Agent-readable catalog</h3>
          </div>
          <span className="font-mono text-[11px] text-muted">{catalog.length} SKUs</span>
        </div>
        <p className="text-xs text-muted mb-3">
          Click any SKU to automatically set the shopping goal & budget.
        </p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {catalog.map((p) => {
            const isOutOfStock = p.stock === 0;
            const categoryBadge =
              p.category === "snacks"
                ? "bg-gold-light text-gold border-gold-border"
                : p.category === "beverages"
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";

            return (
              <div
                key={p.id}
                role="button"
                tabIndex={running ? -1 : 0}
                onClick={() => {
                  if (running) return;
                  setGoal(`Buy ${p.name}`);
                  setBudget(String(p.price));
                }}
                onKeyDown={(e) => {
                  if (running) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setGoal(`Buy ${p.name}`);
                    setBudget(String(p.price));
                  }
                }}
                title={running ? undefined : `Click to set goal & budget for ${p.name}`}
                className={`flex items-center justify-between text-xs py-2 px-2.5 rounded-lg border border-line/60 transition-colors ${
                  running
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:bg-gold-light/40 hover:border-gold-border"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isOutOfStock ? "bg-fail" : "bg-pass"
                    }`}
                    aria-hidden
                  />
                  <span className="truncate text-ink font-medium">{p.name}</span>
                  <span
                    className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${categoryBadge}`}
                  >
                    {p.category}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-semibold text-ink">₹{p.price}</span>
                  {isOutOfStock && (
                    <span className="block text-[9px] text-fail font-medium">Out of stock</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Policy Gate — Rules Enforced (Open directly without collapse) */}
      <div className="bg-panel border border-line rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-gold" />
          <h3 className="font-display font-semibold text-sm text-ink">
            Policy gate — rules enforced
          </h3>
        </div>
        <ul className="space-y-2.5 text-xs text-muted">
          <li className="flex gap-2.5">
            <span className="text-gold font-mono font-semibold shrink-0">01</span>
            <span>
              No cart is submitted for an order until its total is verified within your stated budget.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold font-mono font-semibold shrink-0">02</span>
            <span>
              Every item's stock is checked before order creation — out-of-stock items are substituted
              or dropped, never silently included.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold font-mono font-semibold shrink-0">03</span>
            <span>
              Any applied discount is capped per item at the catalog's stated maximum — the agent
              cannot exceed it.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold font-mono font-semibold shrink-0">04</span>
            <span>
              If the gate rejects a cart, the agent gets exactly one bounded revision. A second
              rejection stops the flow — no retry loop, no silent failure.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold font-mono font-semibold shrink-0">05</span>
            <span>
              A separate merchant-side policy (discount cap, minimum order value, manual-approval
              categories) is checked after your own rules — both have to pass, independently.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

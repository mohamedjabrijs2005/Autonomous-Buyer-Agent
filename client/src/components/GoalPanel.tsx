import { useEffect, useState } from "react";
import { ShoppingCart, Play, Loader2, Package, ShieldCheck, Repeat } from "lucide-react";
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
};

const PRESETS = [
  { label: "Snacks under ₹700", goal: "restock office snacks, prefer variety over quantity", budget: "700" },
  { label: "Beverages under ₹1000", goal: "restock beverages for the pantry", budget: "1000" },
  { label: "Mixed, ₹2000", goal: "restock office snacks and stationery, prefer variety", budget: "2000" }
];

export default function GoalPanel({ goal, setGoal, budget, setBudget, onRun, running }: Props) {
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/catalog`)
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-panel border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingCart className="w-5 h-5 text-ink" />
          <h2 className="font-display font-semibold text-lg text-ink">Buyer agent goal</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Describe what the agent should shop for. It reasons over the live catalog, stays inside your
          budget, and every decision it makes is logged live on the right.
        </p>

        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">Goal</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. restock office snacks, prefer variety over quantity"
          disabled={running}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none resize-none disabled:opacity-60"
        />

        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5 mt-4">
          Budget (₹)
        </label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="700"
          disabled={running}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none disabled:opacity-60"
        />

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
              className="text-xs px-2.5 py-1 rounded-full border border-line text-muted hover:text-ink hover:border-ink transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-surface border border-line/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1">
              <Package className="w-3.5 h-3.5" /> Catalog
            </div>
            <p className="text-sm font-semibold text-ink">{catalog.length || 12} SKUs</p>
          </div>
          <div className="rounded-lg bg-surface border border-line/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Gate
            </div>
            <p className="text-sm font-semibold text-ink">Budget + stock</p>
          </div>
          <div className="rounded-lg bg-surface border border-line/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1">
              <Repeat className="w-3.5 h-3.5" /> Retry
            </div>
            <p className="text-sm font-semibold text-ink">1 bounded</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running || !goal.trim()}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-ink text-white font-medium text-sm py-2.5 hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Agent running…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Run agent
            </>
          )}
        </button>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-ink">Agent-readable catalog</h3>
          <span className="font-mono text-[11px] text-muted">{catalog.length} SKUs</span>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {catalog.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-xs py-1.5 border-b border-line/70 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.stock === 0 ? "bg-fail" : "bg-pass"}`}
                  aria-hidden
                />
                <span className="truncate text-ink">{p.name}</span>
              </div>
              <span className="font-mono text-muted shrink-0 ml-2">₹{p.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

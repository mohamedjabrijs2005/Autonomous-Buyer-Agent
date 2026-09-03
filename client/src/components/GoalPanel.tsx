import { useEffect, useState } from "react";
import { Play, Loader2, Package, ShieldCheck, Lock, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { API_BASE } from "../config";
import CatalogModal, { type Product } from "./CatalogModal";

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
  { label: "Mixed order ₹2000", goal: "restock office snacks and stationery, prefer variety", budget: "2000" }
];

const POLICY_RULES = [
  { id: "01", title: "Budget validation", desc: "No cart submitted until verified within your stated budget." },
  { id: "02", title: "Stock validation", desc: "Out-of-stock items substituted or dropped, never silently purchased." },
  { id: "03", title: "Discount cap", desc: "Applied discounts are capped per item at the catalog's stated maximum." },
  { id: "04", title: "One bounded revision", desc: "Exactly 1 bounded retry if gate fails; stops cleanly on second failure." },
  { id: "05", title: "Merchant policy gate", desc: "Checks min order values & triggers human approval for restricted categories." }
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);

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

  const handleSelectProduct = (p: Product) => {
    setGoal(`Buy ${p.name}`);
    setBudget(String(p.price));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Buyer Goal Card */}
      <div className="bg-panel border border-line rounded-xl p-5 sm:p-6 shadow-card">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Buyer Goal
            </h2>
            <span className="text-[11px] font-medium text-muted bg-slate-100 px-2 py-0.5 rounded border border-line">
              Autonomous Agent
            </span>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Tell the agent what you need. Custos will select products within your budget and validate every transaction action.
          </p>
        </div>

        {/* Goal Textarea */}
        <div className="mb-4">
          <label
            htmlFor="goal-input"
            className="block text-[11px] font-semibold text-ink uppercase tracking-wider mb-1.5"
          >
            Shopping Goal
          </label>
          <textarea
            id="goal-input"
            name="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="e.g. restock snacks, prefer variety"
            disabled={running}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none resize-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <span className="block text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">
            Quick Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={running}
                onClick={() => {
                  setGoal(p.goal);
                  setBudget(p.budget);
                }}
                className="text-xs px-2.5 py-1 rounded-md border border-line bg-surface text-muted hover:text-ink hover:border-slate-400 hover:bg-white transition-all disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Input */}
        <div className="mb-5">
          <label
            htmlFor="budget-input"
            className="block text-[11px] font-semibold text-ink uppercase tracking-wider mb-1.5"
          >
            Budget
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
              className="w-full pl-8 pr-3 py-2 text-sm font-mono font-medium rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Primary Run Agent Button */}
        <button
          type="button"
          onClick={onRun}
          disabled={running || !goal.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand text-white font-medium text-sm py-2.5 hover:bg-brand-hover active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {waitingApproval ? (
            <>
              <Lock className="w-4 h-4 text-warn animate-pulse" />
              <span>Awaiting Human Approval</span>
            </>
          ) : running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Agent Running…</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Agent</span>
            </>
          )}
        </button>
      </div>

      {/* Merchant Catalog Preview Card */}
      <div className="bg-panel border border-line rounded-xl p-4 sm:p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted" />
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-ink uppercase">
                Catalog
              </h3>
              <p className="text-[11px] text-muted">
                {catalog.length || 12} Products Available
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-brand bg-slate-100 hover:bg-slate-200 border border-line px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>View Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick SKU pills */}
        {catalog.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-muted font-medium uppercase mr-1">Sample SKUs:</span>
            {catalog.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={running}
                onClick={() => handleSelectProduct(p)}
                title={`Click to set goal & budget for ${p.name}`}
                className="text-[11px] px-2 py-0.5 rounded border border-line/80 bg-surface text-muted hover:text-ink hover:bg-white transition-colors truncate max-w-[140px] disabled:opacity-50"
              >
                {p.name} · <span className="font-mono">₹{p.price}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Policy Controls Section */}
      <div className="bg-panel border border-line rounded-xl p-4 sm:p-5 shadow-card">
        <button
          type="button"
          onClick={() => setPolicyExpanded(!policyExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-pass" />
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-ink uppercase">
                Policy Controls
              </h3>
              <p className="text-[11px] text-muted">5 Autonomous Safety Safeguards</p>
            </div>
          </div>
          <span className="text-muted hover:text-ink p-1 rounded-md transition-colors">
            {policyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {/* Collapsible Content */}
        {policyExpanded ? (
          <div className="mt-3 pt-3 border-t border-line space-y-2.5">
            {POLICY_RULES.map((rule) => (
              <div key={rule.id} className="flex items-start gap-2.5 text-xs">
                <span className="font-mono text-[11px] text-muted shrink-0 w-4">
                  {rule.id}
                </span>
                <div>
                  <span className="font-medium text-ink">{rule.title}</span>
                  <p className="text-muted text-[11px] mt-0.5 leading-normal">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-1.5 text-[11px] text-muted">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-pass shrink-0" />
              <span>Budget validation</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-pass shrink-0" />
              <span>Stock verification</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-pass shrink-0" />
              <span>Discount limits</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-pass shrink-0" />
              <span>1 bounded revision</span>
            </div>
          </div>
        )}
      </div>

      {/* Full Catalog Modal */}
      <CatalogModal
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        catalog={catalog}
        onSelectProduct={handleSelectProduct}
        disabled={running}
      />
    </div>
  );
}

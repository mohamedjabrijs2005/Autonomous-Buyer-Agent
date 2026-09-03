import { useState, useMemo } from "react";
import { X, Search, PackageCheck, AlertCircle } from "lucide-react";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  max_discount_pct: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  catalog: Product[];
  onSelectProduct: (p: Product) => void;
  disabled?: boolean;
};

export default function CatalogModal({ isOpen, onClose, catalog, onSelectProduct, disabled }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => set.add(p.category));
    return ["all", ...Array.from(set)];
  }, [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter((p) => {
      const matchCat = activeCategory === "all" || p.category === activeCategory;
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [catalog, activeCategory, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-panel rounded-xl border border-line shadow-xl flex flex-col max-h-[85vh] overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-surface/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-ink">Merchant Catalog</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-muted font-medium border border-line">
                {catalog.length} SKUs
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Click any product to auto-populate the goal and budget
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-slate-100 transition-colors"
            title="Close catalog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-line bg-white flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKUs, or categories..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-brand text-white"
                    : "bg-surface text-muted hover:text-ink hover:bg-slate-100 border border-line"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="overflow-y-auto flex-1 p-4 divide-y divide-line/60">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted text-xs">
              No products found matching "{search}"
            </div>
          ) : (
            filtered.map((p) => {
              const isOutOfStock = p.stock === 0;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => {
                    if (disabled) return;
                    onSelectProduct(p);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectProduct(p);
                      onClose();
                    }
                  }}
                  className={`py-3 px-3 rounded-lg flex items-center justify-between transition-colors ${
                    disabled
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer hover:bg-surface group"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOutOfStock ? "bg-fail" : "bg-pass"
                      }`}
                      title={isOutOfStock ? "Out of stock" : "In stock"}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-ink truncate group-hover:text-brand">
                          {p.name}
                        </span>
                        <span className="font-mono text-[11px] text-muted uppercase">
                          {p.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-slate-100 text-muted border border-line">
                          {p.category}
                        </span>
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-fail font-medium">
                            <AlertCircle className="w-3 h-3" /> Out of stock (will substitute)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-pass">
                            <PackageCheck className="w-3 h-3" /> {p.stock} in stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-semibold text-ink">₹{p.price}</div>
                    <div className="text-[10px] text-muted">
                      Max discount {p.max_discount_pct}%
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line bg-surface/50 text-[11px] text-muted flex items-center justify-between">
          <span>Out-of-stock items trigger the automated substitution engine</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-ink bg-white border border-line rounded-md hover:bg-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

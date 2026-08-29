// Computes a 0-100 explainability score for a purchase that has ALREADY
// passed the policy gate. This never blocks anything by itself — checkPolicy
// is the only thing with veto power — it's purely the "how much should a
// human care about this one" signal that feeds Human Approval Mode and gets
// shown in the audit trail.
export function computeRiskScore({ cart, catalog, total, budget, substitutionsCount = 0 }) {
  let score = 0;
  const reasons = [];

  const budgetUsedPct = budget ? (total / budget) * 100 : 0;
  if (budgetUsedPct >= 95) {
    score += 30;
    reasons.push(`Cart uses ${Math.round(budgetUsedPct)}% of the stated budget — right at the edge.`);
  } else if (budgetUsedPct >= 80) {
    score += 15;
    reasons.push(`Cart uses ${Math.round(budgetUsedPct)}% of the stated budget.`);
  }

  if (substitutionsCount > 0) {
    score += 15 * substitutionsCount;
    reasons.push(
      `${substitutionsCount} item${substitutionsCount > 1 ? "s were" : " was"} substituted for an out-of-stock original.`
    );
  }

  for (const line of cart) {
    const product = catalog.find((p) => p.id === line.id);
    if (product && product.stock > 0 && product.stock <= 5) {
      score += 10;
      reasons.push(`${product.name} has only ${product.stock} left in stock.`);
    }
  }

  if (cart.length === 0) {
    score += 20;
    reasons.push("Empty cart — an unusual outcome for a goal-driven run.");
  }

  score = Math.min(100, score);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  if (reasons.length === 0) {
    reasons.push("No unusual signals — a standard in-budget, in-stock purchase.");
  }

  return { score, level, reasons };
}

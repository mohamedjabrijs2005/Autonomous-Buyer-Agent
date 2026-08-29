// Merchant-side policy — separate from the buyer's own rules in policy.js.
// A real agentic-commerce flow has TWO rule sets that both have to agree
// before money moves: what the buyer's user is willing to accept
// (policy.js) and what the merchant is willing to sell under (this file).
// Passing the user's gate is necessary but not sufficient — Custos merges
// both, and either one can block the order.
//
// In a multi-merchant system this would be looked up per-merchant; for this
// single-catalog demo it's one fixed policy object.
export const merchantPolicy = {
  maxDiscountPct: 15, // merchant-wide discount ceiling, ON TOP OF each product's own per-item cap in the catalog
  minOrderValue: 100, // merchant won't process an order below this — not worth the payment processing overhead
  manualApprovalCategories: ["office"] // merchant requires a human sign-off on these categories, regardless of amount (e.g. bulk/refund-prone items)
};

export function checkMerchantPolicy(cart, catalog) {
  let total = 0;
  let requiresManualApproval = false;
  const flaggedCategories = new Set();

  for (const line of cart) {
    const product = catalog.find((p) => p.id === line.id);
    if (!product) {
      return { passed: false, reason: `Unknown product id "${line.id}" — not in the merchant's catalog.` };
    }

    // Belt-and-suspenders: the substitution pass upstream should already
    // have removed any out-of-stock line, but the merchant's OWN policy
    // independently refuses to let one through too — this must never rely
    // solely on the buyer-side pipeline behaving correctly.
    if (product.stock <= 0) {
      return {
        passed: false,
        reason: `${product.name} is out of stock — merchant policy blocks any out-of-stock item from ever reaching an order, no exceptions.`
      };
    }

    const discount_pct = line.discount_pct || 0;
    if (discount_pct > merchantPolicy.maxDiscountPct) {
      return {
        passed: false,
        reason: `${product.name} requested ${discount_pct}% discount, exceeding the merchant-wide cap of ${merchantPolicy.maxDiscountPct}% (separate from that product's own per-item cap).`
      };
    }

    if (merchantPolicy.manualApprovalCategories.includes(product.category)) {
      requiresManualApproval = true;
      flaggedCategories.add(product.category);
    }

    total += product.price * line.qty * (1 - discount_pct / 100);
  }

  if (total < merchantPolicy.minOrderValue) {
    return {
      passed: false,
      reason: `Cart total ₹${Math.round(total)} is below the merchant's ₹${merchantPolicy.minOrderValue} minimum order value.`
    };
  }

  return {
    passed: true,
    reason: requiresManualApproval
      ? `Merchant policy passed — total ₹${Math.round(total)}, but ${[...flaggedCategories].join(", ")} item(s) require manual approval per merchant rules.`
      : `Merchant policy passed — total ₹${Math.round(total)}, no restricted categories.`,
    total: Math.round(total),
    requiresManualApproval,
    flaggedCategories: [...flaggedCategories]
  };
}

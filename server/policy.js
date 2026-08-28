import { findById } from "./data/catalog.js";

// This is the "gated" part of the bar. Nothing reaches Razorpay's order API
// without passing here first, and every rejection returns a concrete reason
// — never a silent failure.
export function checkPolicy(cart, budget) {
  let total = 0;

  for (const line of cart) {
    const product = findById(line.id);
    if (!product) {
      return { passed: false, reason: `Unknown product id "${line.id}" — not in catalog.` };
    }
    if (product.stock < line.qty) {
      return {
        passed: false,
        reason: `${product.name} has only ${product.stock} in stock, but ${line.qty} were requested.`
      };
    }
    const discount_pct = line.discount_pct || 0;
    if (discount_pct > product.max_discount_pct) {
      return {
        passed: false,
        reason: `${product.name} requested ${discount_pct}% discount, exceeding its cap of ${product.max_discount_pct}%.`
      };
    }
    total += product.price * line.qty * (1 - discount_pct / 100);
  }

  if (total > budget) {
    return {
      passed: false,
      reason: `Cart total ₹${Math.round(total)} exceeds budget of ₹${budget}.`
    };
  }

  return { passed: true, reason: `Cart total ₹${Math.round(total)} is within budget and all items are in stock.`, total: Math.round(total) };
}

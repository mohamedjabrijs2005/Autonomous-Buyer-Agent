import express from "express";
import { getCatalog, findById, findSubstitute } from "../data/catalog.js";
import { runBuyerAgent } from "../agent.js";
import { checkPolicy } from "../policy.js";
import { createOrder } from "../order.js";

const router = express.Router();

function send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`);
}

// Runs the out-of-stock substitution pass over a proposed cart. Used after
// EVERY proposal (initial and revised) so a revision can never silently
// reintroduce an out-of-stock item.
function applySubstitutions(cart, rejected) {
  const substitutions = [];
  let nextCart = [...cart];
  let nextRejected = [...rejected];

  for (const line of cart) {
    const product = findById(line.id);
    if (product && product.stock === 0) {
      const currentIds = nextCart.map((c) => c.id);
      const sub = findSubstitute(line.id, currentIds);
      nextCart = nextCart.filter((c) => c.id !== line.id);
      if (sub) {
        substitutions.push({
          original: product.name,
          replacement: sub.name,
          reason: `${product.name} is out of stock; ${sub.name} is the nearest in-stock item in the same category.`
        });
        nextCart.push({ id: sub.id, qty: line.qty, reason: `Substituted for out-of-stock ${product.name}.` });
      } else {
        nextRejected.push({ id: line.id, reason: `${product.name} out of stock, no in-category substitute available.` });
      }
    }
  }

  return { cart: nextCart, rejected: nextRejected, substitutions };
}

router.get("/agent/run", async (req, res) => {
  const goal = req.query.goal;
  const budget = Number(req.query.budget) || undefined;

  if (!goal || !goal.trim()) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  try {
    const catalog = getCatalog();
    send(res, "goal_received", { goal, budget: budget || null });

    send(res, "catalog_fetched", { count: catalog.length });

    const resolvedBudget = budget || 2000;

    // --- Step 1: initial proposal
    let proposal = await runBuyerAgent(goal, catalog, budget);
    send(res, "cart_proposed", { cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

    // --- Step 2: out-of-stock substitution pass (before policy check)
    let subResult = applySubstitutions(proposal.cart, proposal.rejected);
    proposal.cart = subResult.cart;
    proposal.rejected = subResult.rejected;
    if (subResult.substitutions.length) {
      send(res, "substitution", { substitutions: subResult.substitutions });
    }

    // --- Step 3: policy gate, attempt 1
    let policyResult = checkPolicy(proposal.cart, resolvedBudget);
    send(res, "policy_check", { attempt: 1, ...policyResult });

    // --- Step 4: one bounded revision if gate failed
    if (!policyResult.passed) {
      send(res, "revision_started", { reason: policyResult.reason });
      proposal = await runBuyerAgent(goal, catalog, resolvedBudget, policyResult.reason);
      send(res, "cart_proposed", { revised: true, cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

      // Re-run the substitution pass on the revised cart too — a revision
      // must never be allowed to silently reintroduce an out-of-stock item.
      subResult = applySubstitutions(proposal.cart, proposal.rejected);
      proposal.cart = subResult.cart;
      proposal.rejected = subResult.rejected;
      if (subResult.substitutions.length) {
        send(res, "substitution", { revised: true, substitutions: subResult.substitutions });
      }

      policyResult = checkPolicy(proposal.cart, resolvedBudget);
      send(res, "policy_check", { attempt: 2, ...policyResult });
    }

    // --- Step 5: stop gracefully if still failing — no silent failure, no infinite loop
    if (!policyResult.passed) {
      send(res, "flow_stopped", { reason: `Gate failed twice. Stopping — this is the bounded-retry rule, not an error. Last reason: ${policyResult.reason}` });
      res.end();
      return;
    }

    // --- Step 6: create the order (real Razorpay test-mode if keys present)
    const order = await createOrder(policyResult.total, `receipt_${Date.now()}`);
    send(res, "order_created", { order });

    send(res, "done", { finalCart: proposal.cart, total: policyResult.total, orderId: order.id, source: order.source });
    res.end();
  } catch (err) {
    console.error(err);
    send(res, "error", { message: err.message });
    res.end();
  }
});

export default router;

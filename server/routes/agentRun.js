import express from "express";
import crypto from "crypto";
import { getCatalog, findById, findSubstitute } from "../data/catalog.js";
import { runBuyerAgent, interpretGoal } from "../agent.js";
import { runPolicyGate } from "../policy.js";
import { createOrder } from "../order.js";
import { computeRiskScore } from "../risk.js";
import { createRun, isStopped, waitForApproval, cleanupRun } from "../runState.js";

const router = express.Router();

// Above this cart total, Human Approval Mode kicks in and the agent will
// not create an order until a human explicitly approves it over
// POST /agent/approve. Overridable per-run via ?approvalThreshold=.
const DEFAULT_APPROVAL_THRESHOLD = 1200;

function send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`);
}

function cartTotal(cart, catalog) {
  return cart.reduce((sum, c) => {
    const p = catalog.find((x) => x.id === c.id);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);
}

// Checks the Emergency Kill Switch. If it's been pressed, sends the
// agent_stopped event, cleans up run state, and ends the response. Returns
// true if the caller should stop processing immediately.
function stoppedOrContinue(runId, res) {
  if (isStopped(runId)) {
    send(res, "agent_stopped", {
      reason: "Stopped by user via the Emergency Kill Switch. No further money actions were taken."
    });
    cleanupRun(runId);
    res.end();
    return true;
  }
  return false;
}

// Runs the out-of-stock substitution pass over a proposed cart.
//
// blockedSkuIds is a Set shared across the WHOLE run (initial proposal +
// revision), not just this one call. Once a SKU is found out-of-stock, its
// id is added here — this is what a product has "been detected as out of
// stock" means for the rest of the run. Combined with runBuyerAgent()
// excluding blockedSkuIds from its candidate pool, a SKU that has already
// been substituted or dropped can never be proposed, substituted, or
// counted again in the same run.
//
// substitutedOriginalIds is a separate Set — only original SKUs that were
// SUCCESSFULLY substituted (not dropped) go in here, and its .size is the
// single source of truth for "how many items were substituted", used for
// both the audit trail text and the risk score. This is what stops the
// same Masala Makhana → Trail Mix swap from ever being counted twice.
function applySubstitutions(cart, rejected, blockedSkuIds, substitutedOriginalIds, catalog) {
  const substitutions = [];
  const stockChecks = [];
  let nextCart = [...cart];
  let nextRejected = [...rejected];

  for (const line of cart) {
    const product = findById(line.id);
    if (product && product.stock === 0) {
      stockChecks.push({ product: product.name, reason: `${product.name} is out of stock.` });
      nextCart = nextCart.filter((c) => c.id !== line.id);

      // Defensive: this SKU was already handled earlier in this run. It
      // shouldn't be possible to reach this branch again (runBuyerAgent's
      // pool exclusion prevents it from being proposed at all), but if it
      // ever is, never re-substitute or re-count it.
      if (blockedSkuIds.has(line.id)) {
        continue;
      }
      blockedSkuIds.add(line.id);

      const currentIds = nextCart.map((c) => c.id);
      const sub = findSubstitute(line.id, currentIds);
      if (sub) {
        substitutions.push({
          original: product.name,
          originalId: product.id,
          replacement: sub.name,
          replacementId: sub.id,
          reason: `${product.name} (₹${product.price}) is out of stock. ${sub.name} (₹${sub.price}) is an in-category, in-stock alternative.`
        });
        substitutedOriginalIds.add(product.id);
        nextCart.push({ id: sub.id, qty: line.qty, reason: `Substituted for out-of-stock ${product.name}.` });
      } else {
        nextRejected.push({
          id: line.id,
          reason: `${product.name} out of stock, no in-category substitute available. Item dropped.`
        });
      }
    }
  }

  return { cart: nextCart, rejected: nextRejected, substitutions, stockChecks };
}

// Used specifically when the gate fails BECAUSE a substitution already made
// in this attempt pushed the cart over budget. Rather than discarding that
// substitution and regenerating an unrelated cart from scratch, this trims
// the CURRENT cart — removing the most expensive item not already part of
// the substitution — until it fits. This preserves the valid substitution
// through the one bounded revision instead of losing it.
function trimCartToFitBudget(cart, budget, catalog, preserveIds) {
  let working = [...cart];
  const removed = [];

  const total = () => cartTotal(working, catalog);

  while (total() > budget) {
    const removable = working
      .filter((c) => !preserveIds.includes(c.id))
      .map((c) => ({ line: c, price: (catalog.find((x) => x.id === c.id)?.price || 0) * c.qty }))
      .sort((a, b) => b.price - a.price);

    if (removable.length === 0) break; // nothing left we're allowed to remove
    const { line, price } = removable[0];
    working = working.filter((c) => c.id !== line.id);
    const p = catalog.find((x) => x.id === line.id);
    removed.push({
      id: line.id,
      reason: `${p ? p.name : line.id} (₹${price}) removed to bring the substituted cart back within the ₹${budget} budget.`
    });
  }

  return { cart: working, removed, total: total() };
}

// Runs the combined policy gate (user rules + merchant rules) for one
// attempt and streams both check results. merchant_policy_check is only
// sent when the user policy passed — no point telling the merchant story
// about a cart the user's own rules already rejected.
function runGateAndEmit(cart, budget, catalog, attempt, res) {
  const gate = runPolicyGate(cart, budget, catalog);
  send(res, "policy_check", { attempt, ...gate.userResult });
  if (gate.userResult.passed && gate.merchantResult) {
    send(res, "merchant_policy_check", { attempt, ...gate.merchantResult });
  }
  return gate;
}

router.get("/agent/run", async (req, res) => {
  const goal = req.query.goal;
  const budget = Number(req.query.budget) || undefined;
  const runId = req.query.runId || crypto.randomUUID();
  const approvalThreshold = Number(req.query.approvalThreshold) || DEFAULT_APPROVAL_THRESHOLD;

  if (!goal || !goal.trim()) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  createRun(runId);

  // Run-scoped state — a SKU discovered out of stock, or an original SKU
  // successfully substituted, is remembered for the rest of THIS run only.
  const blockedSkuIds = new Set();
  const substitutedOriginalIds = new Set();

  try {
    const catalog = getCatalog();
    send(res, "goal_received", { goal, budget: budget || null, runId });

    if (stoppedOrContinue(runId, res)) return;

    send(res, "catalog_fetched", { count: catalog.length });

    // --- Goal interpretation — deterministic category constraint, computed
    // BEFORE cart selection and shown explicitly, so a judge can see the
    // agent was never allowed to consider out-of-category products at all.
    const { categories, pool } = interpretGoal(goal, catalog);
    send(res, "goal_interpreted", {
      categories,
      eligibleCount: pool.length,
      totalCount: catalog.length,
      reason: categories
        ? `Restricted the search to ${categories.join(", ")} products because the goal specifies ${categories.join(" and ")}.`
        : "No specific category detected in the goal — considering the full catalog."
    });

    if (stoppedOrContinue(runId, res)) return;

    const resolvedBudget = budget || 2000;

    // --- Step 1: initial proposal
    let proposal = await runBuyerAgent(goal, catalog, budget);
    if (stoppedOrContinue(runId, res)) return;
    send(res, "cart_proposed", { cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

    // --- Step 2: stock check + out-of-stock substitution pass (before policy check)
    let subResult = applySubstitutions(proposal.cart, proposal.rejected, blockedSkuIds, substitutedOriginalIds, catalog);
    proposal.cart = subResult.cart;
    proposal.rejected = subResult.rejected;
    if (subResult.stockChecks.length) {
      send(res, "stock_check", { checks: subResult.stockChecks });
    }
    if (subResult.substitutions.length) {
      send(res, "substitution", { substitutions: subResult.substitutions, newTotal: cartTotal(proposal.cart, catalog) });
    }

    if (stoppedOrContinue(runId, res)) return;

    // --- Step 3: policy gate, attempt 1 — user rules AND merchant rules
    let gate = runGateAndEmit(proposal.cart, resolvedBudget, catalog, 1, res);

    // --- Step 4: one bounded revision if EITHER side of the gate failed
    if (!gate.passed) {
      if (stoppedOrContinue(runId, res)) return;

      const failReason = gate.stage === "user" ? gate.userResult.reason : gate.merchantResult.reason;
      send(res, "revision_started", { reason: failReason, stage: gate.stage });

      if (subResult.substitutions.length > 0 && gate.stage === "user") {
        // The gate failed because a substitution made in this attempt
        // pushed the cart over budget. Trim the CURRENT cart instead of
        // regenerating a fresh one — this keeps the valid substitution
        // (and structurally cannot re-select the now-blocked original SKU,
        // since it's already been removed from the cart entirely).
        const preserveIds = subResult.substitutions.map((s) => s.replacementId);
        const trimResult = trimCartToFitBudget(proposal.cart, resolvedBudget, catalog, preserveIds);
        // Drop any stale "rejected" entry left over from the ORIGINAL
        // proposal for an id that is now actually IN the cart (e.g. Trail
        // Mix was skipped for being too expensive before it became the
        // substitute) — otherwise the same id shows as both ✓ selected and
        // ✕ skipped in the same revised-cart step, which is exactly the
        // kind of contradictory audit event this fix pass is about removing.
        const finalCartIds = new Set(trimResult.cart.map((c) => c.id));
        proposal = {
          cart: trimResult.cart,
          rejected: [...proposal.rejected.filter((r) => !finalCartIds.has(r.id)), ...trimResult.removed],
          total_estimated: trimResult.total
        };
      } else {
        // Plain budget/merchant-policy miss with no substitution involved —
        // regenerate, still excluding every SKU blocked so far this run.
        proposal = await runBuyerAgent(goal, catalog, resolvedBudget, failReason, [...blockedSkuIds]);
      }

      if (stoppedOrContinue(runId, res)) return;
      send(res, "cart_proposed", { revised: true, cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

      // Re-run the substitution pass on the revised cart too — a revision
      // must never be allowed to silently reintroduce an out-of-stock item.
      // (blockedSkuIds/substitutedOriginalIds carry over from the initial
      // pass, so an already-handled SKU can never be double-counted here.)
      subResult = applySubstitutions(proposal.cart, proposal.rejected, blockedSkuIds, substitutedOriginalIds, catalog);
      proposal.cart = subResult.cart;
      proposal.rejected = subResult.rejected;
      if (subResult.stockChecks.length) {
        send(res, "stock_check", { revised: true, checks: subResult.stockChecks });
      }
      if (subResult.substitutions.length) {
        send(res, "substitution", { revised: true, substitutions: subResult.substitutions, newTotal: cartTotal(proposal.cart, catalog) });
      }

      if (stoppedOrContinue(runId, res)) return;

      gate = runGateAndEmit(proposal.cart, resolvedBudget, catalog, 2, res);
    }

    // --- Step 5: stop gracefully if still failing — no silent failure, no
    // infinite loop, no attempt 3, ever.
    if (!gate.passed) {
      const failReason = gate.stage === "user" ? gate.userResult.reason : gate.merchantResult.reason;
      send(res, "flow_stopped", {
        reason: `Maximum bounded revision count reached (gate failed twice — ${gate.stage} policy). No further autonomous attempts permitted. Last reason: ${failReason}`
      });
      cleanupRun(runId);
      res.end();
      return;
    }

    if (stoppedOrContinue(runId, res)) return;

    // --- Step 6: risk score — explanatory only, computed on the cart that
    // already cleared BOTH policy gates. Never blocks anything by itself.
    // substitutedOriginalIds.size is the UNIQUE substitution count for the
    // whole run — this is what fixes "2 items were substituted" showing up
    // for what was actually one SKU substituted once.
    const risk = computeRiskScore({
      cart: proposal.cart,
      catalog,
      total: gate.total,
      budget: resolvedBudget,
      substitutionsCount: substitutedOriginalIds.size,
      requiresManualApproval: gate.requiresManualApproval
    });
    send(res, "risk_assessed", { ...risk });

    // --- Step 7: Human Approval Mode — pauses for either of two reasons:
    // a high-value cart (amount-based), or the merchant policy flagging a
    // restricted category (rule-based, independent of amount). The agent
    // is genuinely paused here — this await literally blocks execution, so
    // no order/payment action can happen until a human resolves it.
    if (gate.total > approvalThreshold || gate.requiresManualApproval) {
      const approvalReason = gate.requiresManualApproval
        ? `Merchant policy requires manual approval for this cart's category, regardless of amount.`
        : `₹${gate.total} exceeds the ₹${approvalThreshold} auto-approve threshold.`;
      send(res, "approval_required", {
        total: gate.total,
        threshold: approvalThreshold,
        runId,
        reason: approvalReason,
        requiresManualApproval: gate.requiresManualApproval
      });
      const approved = await waitForApproval(runId);

      if (stoppedOrContinue(runId, res)) return;

      if (!approved) {
        send(res, "order_rejected", {
          reason: `Human approval denied for a ₹${gate.total} purchase. No order was created.`
        });
        cleanupRun(runId);
        res.end();
        return;
      }
      send(res, "approval_granted", { total: gate.total });
    }

    // --- Step 8: create the order — Razorpay Test Mode if RAZORPAY_KEY_ID/
    // SECRET are configured, otherwise a clearly labeled demo/mock fallback.
    // Never real money either way (order.js never calls a live-mode API).
    const order = await createOrder(gate.total, `receipt_${Date.now()}`);
    send(res, "order_created", { order });

    send(res, "done", { finalCart: proposal.cart, total: gate.total, orderId: order.id, source: order.source });
    cleanupRun(runId);
    res.end();
  } catch (err) {
    console.error(err);
    send(res, "error", { message: err.message });
    cleanupRun(runId);
    res.end();
  }
});

export default router;

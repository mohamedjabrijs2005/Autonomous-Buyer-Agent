import express from "express";
import crypto from "crypto";
import { getCatalog, findById, findSubstitute } from "../data/catalog.js";
import { runBuyerAgent } from "../agent.js";
import { checkPolicy } from "../policy.js";
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

  try {
    const catalog = getCatalog();
    send(res, "goal_received", { goal, budget: budget || null, runId });

    if (stoppedOrContinue(runId, res)) return;

    send(res, "catalog_fetched", { count: catalog.length });

    const resolvedBudget = budget || 2000;

    // --- Step 1: initial proposal
    let proposal = await runBuyerAgent(goal, catalog, budget);
    if (stoppedOrContinue(runId, res)) return;
    send(res, "cart_proposed", { cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

    // --- Step 2: out-of-stock substitution pass (before policy check)
    let subResult = applySubstitutions(proposal.cart, proposal.rejected);
    proposal.cart = subResult.cart;
    proposal.rejected = subResult.rejected;
    let substitutionsCount = subResult.substitutions.length;
    if (substitutionsCount) {
      send(res, "substitution", { substitutions: subResult.substitutions });
    }

    if (stoppedOrContinue(runId, res)) return;

    // --- Step 3: policy gate, attempt 1
    let policyResult = checkPolicy(proposal.cart, resolvedBudget);
    send(res, "policy_check", { attempt: 1, ...policyResult });

    // --- Step 4: one bounded revision if gate failed
    if (!policyResult.passed) {
      if (stoppedOrContinue(runId, res)) return;

      send(res, "revision_started", { reason: policyResult.reason });
      proposal = await runBuyerAgent(goal, catalog, resolvedBudget, policyResult.reason);
      if (stoppedOrContinue(runId, res)) return;
      send(res, "cart_proposed", { revised: true, cart: proposal.cart, rejected: proposal.rejected, total_estimated: proposal.total_estimated });

      // Re-run the substitution pass on the revised cart too — a revision
      // must never be allowed to silently reintroduce an out-of-stock item.
      subResult = applySubstitutions(proposal.cart, proposal.rejected);
      proposal.cart = subResult.cart;
      proposal.rejected = subResult.rejected;
      substitutionsCount += subResult.substitutions.length;
      if (subResult.substitutions.length) {
        send(res, "substitution", { revised: true, substitutions: subResult.substitutions });
      }

      if (stoppedOrContinue(runId, res)) return;

      policyResult = checkPolicy(proposal.cart, resolvedBudget);
      send(res, "policy_check", { attempt: 2, ...policyResult });
    }

    // --- Step 5: stop gracefully if still failing — no silent failure, no infinite loop
    if (!policyResult.passed) {
      send(res, "flow_stopped", { reason: `Gate failed twice. Stopping — this is the bounded-retry rule, not an error. Last reason: ${policyResult.reason}` });
      cleanupRun(runId);
      res.end();
      return;
    }

    if (stoppedOrContinue(runId, res)) return;

    // --- Step 6: risk score — explanatory only, computed on the cart that
    // already passed the policy gate. Never blocks anything by itself.
    const risk = computeRiskScore({
      cart: proposal.cart,
      catalog,
      total: policyResult.total,
      budget: resolvedBudget,
      substitutionsCount
    });
    send(res, "risk_assessed", { ...risk });

    // --- Step 7: Human Approval Mode — high-value purchases pause here
    // until a human explicitly approves or rejects over POST /agent/approve.
    // The agent cannot create the order on its own past this point.
    if (policyResult.total > approvalThreshold) {
      send(res, "approval_required", { total: policyResult.total, threshold: approvalThreshold, runId });
      const approved = await waitForApproval(runId);

      if (stoppedOrContinue(runId, res)) return;

      if (!approved) {
        send(res, "order_rejected", {
          reason: `Human approval denied for a ₹${policyResult.total} purchase (above the ₹${approvalThreshold} approval threshold). No order was created.`
        });
        cleanupRun(runId);
        res.end();
        return;
      }
      send(res, "approval_granted", { total: policyResult.total });
    }

    // --- Step 8: create the order (real Razorpay test-mode if keys present)
    const order = await createOrder(policyResult.total, `receipt_${Date.now()}`);
    send(res, "order_created", { order });

    send(res, "done", { finalCart: proposal.cart, total: policyResult.total, orderId: order.id, source: order.source });
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

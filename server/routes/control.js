import express from "express";
import { stopRun, resolveApproval } from "../runState.js";

const router = express.Router();

// POST /agent/stop — { runId } — the Emergency Kill Switch. The running
// /agent/run stream checks this flag at every checkpoint and stops cleanly,
// with the current step preserved in the audit trail (nothing is rolled
// back or hidden — it just stops taking further action).
router.post("/agent/stop", (req, res) => {
  const { runId } = req.body || {};
  if (!runId) return res.status(400).json({ error: "runId is required" });
  const found = stopRun(runId);
  res.json({ ok: true, found });
});

// POST /agent/approve — { runId, approved } — resolves a pending Human
// Approval Mode gate for a high-value purchase. approved: false is a
// deliberate reject, not a timeout or error.
router.post("/agent/approve", (req, res) => {
  const { runId, approved } = req.body || {};
  if (!runId || typeof approved !== "boolean") {
    return res.status(400).json({ error: "runId and approved (boolean) are required" });
  }
  const found = resolveApproval(runId, approved);
  res.json({ ok: true, found });
});

export default router;

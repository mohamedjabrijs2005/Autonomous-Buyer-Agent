import express from "express";
import { isRealRazorpayConfigured, getPublicKeyId } from "../order.js";
import { verifyRazorpaySignature } from "../payment.js";
import { emitToRun, resolvePayment } from "../runState.js";

const router = express.Router();

// GET /payment/config — the ONLY payment-related thing the frontend is
// allowed to fetch. Never returns the secret key, only the public key id
// (needed to open Razorpay Checkout), and only when a real test-mode key is
// actually configured.
router.get("/payment/config", (req, res) => {
  if (!isRealRazorpayConfigured()) {
    return res.json({ available: false });
  }
  res.json({ available: true, keyId: getPublicKeyId() });
});

// POST /payment/initiate — purely an audit-trail marker, called right when
// the user clicks "Proceed to Razorpay Test Payment", before Checkout opens.
// { runId }
router.post("/payment/initiate", (req, res) => {
  const { runId } = req.body || {};
  if (!runId) return res.status(400).json({ error: "runId is required" });
  emitToRun(runId, "payment_initiated", {
    reason: "User explicitly initiated Razorpay Test Mode Checkout."
  });
  res.json({ ok: true });
});

// POST /payment/verify — { runId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// This is the ONLY place a payment is ever marked verified. The Razorpay
// Checkout success callback on the frontend is never trusted by itself.
router.post("/payment/verify", (req, res) => {
  const { runId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!runId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, status: "PAYMENT_VERIFICATION_FAILED", verified: false, error: "Missing required fields." });
  }

  emitToRun(runId, "payment_verification_started", {});

  const verified = verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!verified) {
    emitToRun(runId, "payment_verification_failed", {
      reason: "Signature verification failed — this payment cannot be trusted and will not be marked complete."
    });
    resolvePayment(runId, { verified: false, cancelled: false, reason: "Signature verification failed" });
    return res.json({ success: false, status: "PAYMENT_VERIFICATION_FAILED", verified: false });
  }

  emitToRun(runId, "payment_verified", {
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id
  });
  resolvePayment(runId, { verified: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id });
  res.json({ success: true, status: "PAYMENT_VERIFIED", verified: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id });
});

// POST /payment/cancel — the user closed the Razorpay Checkout modal
// without paying. { runId }
router.post("/payment/cancel", (req, res) => {
  const { runId } = req.body || {};
  if (!runId) return res.status(400).json({ error: "runId is required" });
  emitToRun(runId, "payment_cancelled", { reason: "Payment cancelled by user." });
  resolvePayment(runId, { verified: false, cancelled: true, reason: "Cancelled by user" });
  res.json({ ok: true });
});

// POST /payment/failed — Razorpay Checkout itself reported a failure.
// { runId, reason }
router.post("/payment/failed", (req, res) => {
  const { runId, reason } = req.body || {};
  if (!runId) return res.status(400).json({ error: "runId is required" });
  emitToRun(runId, "payment_failed", { reason: reason || "Razorpay Test Mode payment failed." });
  resolvePayment(runId, { verified: false, cancelled: false, reason: reason || "Payment failed" });
  res.json({ ok: true });
});

export default router;

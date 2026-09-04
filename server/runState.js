// Shared in-memory state for live agent runs — lets the two out-of-band
// control actions (Emergency Kill Switch, Human Approval Mode) reach a run
// that's mid-flight inside an open SSE connection.
//
// This is intentionally a plain in-memory Map: fine for a single-process
// demo/hackathon deployment. A production version would need this in a
// shared store (Redis, etc.) once the server scales to multiple instances.

const runs = new Map();

export function createRun(runId) {
  const state = { stopped: false, approval: null, payment: null, sender: null };
  runs.set(runId, state);
  return state;
}

export function isStopped(runId) {
  const state = runs.get(runId);
  return state ? state.stopped : false;
}

// The kill switch always wins: it stops the run AND, if a human-approval
// prompt is currently pending on this run, auto-resolves it as rejected
// rather than leaving it hanging forever.
export function stopRun(runId) {
  const state = runs.get(runId);
  if (!state) return false;
  state.stopped = true;
  if (state.approval) {
    state.approval.resolve(false);
    state.approval = null;
  }
  // The kill switch must also unblock a pending payment wait — a run
  // sitting at AWAITING_PAYMENT must stop the instant Stop is pressed, not
  // hang until the user closes or completes the Razorpay Checkout window.
  if (state.payment) {
    state.payment.resolve({ verified: false, cancelled: true, reason: "Stopped by kill switch" });
    state.payment = null;
  }
  return true;
}

// Returns a Promise that resolves to true/false once resolveApproval() is
// called for this runId (via POST /agent/approve), or false immediately if
// the run doesn't exist / was already killed.
export function waitForApproval(runId) {
  return new Promise((resolve) => {
    const state = runs.get(runId);
    if (!state) {
      resolve(false);
      return;
    }
    state.approval = { resolve };
  });
}

export function resolveApproval(runId, approved) {
  const state = runs.get(runId);
  if (!state || !state.approval) return false;
  state.approval.resolve(Boolean(approved));
  state.approval = null;
  return true;
}

export function cleanupRun(runId) {
  runs.delete(runId);
}

// --- Payment lifecycle (AWAITING_PAYMENT state) ---
// Bridges the long-lived GET /agent/run SSE stream with the separate
// POST /payment/verify, /payment/cancel, /payment/failed requests the
// frontend makes after the user completes (or abandons) Razorpay Checkout.

// Stores the SSE `send` function for a run so a later REST request
// (payment verify/cancel/failed) can push an event into that SAME
// already-open connection instead of needing its own stream.
export function registerSender(runId, sendFn) {
  const state = runs.get(runId);
  if (state) state.sender = sendFn;
}

export function emitToRun(runId, event, data) {
  const state = runs.get(runId);
  if (state && state.sender) state.sender(event, data);
}

// Returns a Promise that resolves once resolvePayment() is called for this
// runId, or immediately with {verified:false, cancelled:true} if the run
// doesn't exist / was already killed before this was called.
export function waitForPayment(runId) {
  return new Promise((resolve) => {
    const state = runs.get(runId);
    if (!state) {
      resolve({ verified: false, cancelled: true, reason: "Run no longer exists" });
      return;
    }
    state.payment = { resolve };
  });
}

export function resolvePayment(runId, result) {
  const state = runs.get(runId);
  if (!state || !state.payment) return false;
  state.payment.resolve(result);
  state.payment = null;
  return true;
}

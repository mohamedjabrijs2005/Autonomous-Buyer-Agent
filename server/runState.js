// Shared in-memory state for live agent runs — lets the two out-of-band
// control actions (Emergency Kill Switch, Human Approval Mode) reach a run
// that's mid-flight inside an open SSE connection.
//
// This is intentionally a plain in-memory Map: fine for a single-process
// demo/hackathon deployment. A production version would need this in a
// shared store (Redis, etc.) once the server scales to multiple instances.

const runs = new Map();

export function createRun(runId) {
  const state = { stopped: false, approval: null };
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

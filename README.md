# Ledger — Autonomous Buyer Agent (Track 01: AI Growth & Agentic Commerce)

An AI buyer agent that shops a merchant's catalog against a goal and budget,
with every money-moving action explainable, bounded, and gated — and a live
audit trail that streams in real time as the agent works.

## What it demonstrates

- **Agent-readable catalog** — `GET /catalog` exposes products in a structured,
  queryable shape any agent (yours or an external AI buyer) can reason over.
- **Bounded reasoning** — the agent proposes a cart with a reason for every
  included AND rejected item.
- **Gated money actions** — nothing reaches order creation without passing
  `checkPolicy()` first (budget, stock, discount caps). Failures return a
  concrete reason, never a silent drop.
- **One bounded revision** — if the gate fails, the agent gets exactly one
  chance to revise, with the failure reason fed back to it. If it still
  fails, the flow stops cleanly — no infinite retry loop.
- **Graceful failure handling** — an out-of-stock item is automatically
  substituted with the nearest in-stock item in the same category, and this
  substitution re-runs after a revision too, so a revision can never
  silently reintroduce an unavailable item.
- **Real-time audit trail** — the whole flow streams to the frontend over
  Server-Sent Events, so the timeline fills in live, not after the fact.

## Run it

You need two terminals.

**Terminal 1 — backend**
```bash
cd server
npm install
npm start
```
Runs on `http://localhost:3001`. No API keys required — see below.

**Terminal 2 — frontend**
```bash
cd client
npm install
npm run dev
```
Runs on `http://localhost:5173` (Vite proxies API calls to the backend
automatically — see `client/vite.config.ts`).

Open `http://localhost:5173`, enter a goal (or click a preset), and hit
**Run agent**. Try the "Snacks under ₹700" preset first — it deliberately
triggers the out-of-stock substitution AND a policy-gate failure + revision,
so you see the full flow in one run.

## Optional: real LLM + real Razorpay

Copy `server/.env.example` to `server/.env` and fill in:

- `GROQ_API_KEY` — without this, the agent uses a deterministic rule-based
  fallback so the whole flow still works with zero setup. With it, the
  agent reasons via Llama 3.3-70b on Groq.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — without these, `/order`
  returns a realistic mock order. With them, it creates a real Razorpay
  **test-mode** order via their Node SDK — get test keys from your Razorpay
  dashboard (Settings → API Keys → test mode).

Either way the flow runs identically — the demo doesn't depend on either key
being present, but having Razorpay test-mode wired up is worth doing before
you present, since "real API call, not a mock" is the strongest thing you
can show live.

## Project structure

## Deployment

Deploy backend and frontend as two separate services — this app uses
Server-Sent Events for the live audit trail, which needs a backend that
stays running as a normal process, not a serverless function with a short
timeout. Render (or Railway/Fly.io) work well for this; Vercel/Netlify are
fine for the frontend.

**1. Backend → Render**
- New → Web Service → connect this repo
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables if you have them: `GROQ_API_KEY`,
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (all optional — the app runs
  without them). Add `FRONTEND_URL` once you have step 2's URL.
- Deploy, then copy the public URL it gives you (e.g.
  `https://your-app.onrender.com`)

**2. Frontend → Vercel**
- New Project → import this repo
- Root directory: `client`
- Framework preset: Vite (build command `npm run build`, output `dist`)
- Environment variable: `VITE_API_BASE` = the Render URL from step 1
  (no trailing slash)
- Deploy, then copy the URL Vercel gives you

**3. Close the loop**
- Go back to Render → your backend service → environment variables → set
  `FRONTEND_URL` to the Vercel URL from step 2 → redeploy. This restricts
  CORS to just your frontend instead of allowing all origins.

**Note on Render's free tier:** it spins down after inactivity, so the
first request after idle time can take 20-30 seconds to respond. Open your
deployed frontend a minute or two before you demo so the backend is warm.


```
server/
  index.js           — Express entry point
  agent.js           — buyer agent (Groq + deterministic fallback)
  policy.js           — the gate: budget/stock/discount checks
  order.js            — Razorpay test-mode or mock order creation
  data/catalog.js     — the agent-readable product catalog
  routes/
    basic.js          — GET /catalog, POST /policy-check, POST /order
    agentRun.js        — GET /agent/run (SSE) — the full orchestrated flow
client/
  src/
    App.tsx            — wires goal input to the SSE stream
    components/
      GoalPanel.tsx     — goal input, budget, catalog reference
      AuditTrail.tsx    — live timeline rendering each SSE event
```

## Demo script (suggested)

1. Click "Snacks under ₹700" → Run agent.
2. Point out the initial cart proposal — every item has a reason, so does
   every rejection.
3. Point out the substitution event firing live — the out-of-stock item
   gets swapped, with a reason.
4. Point out the policy gate failing attempt 1 (over budget), the agent
   getting exactly one bounded revision, and passing on attempt 2.
5. Point out the order confirmation — say out loud that this is a real
   Razorpay test-mode API call if you've wired up keys, and that the audit
   trail above it is the full explainability record for that money action.

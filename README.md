# Custos — The Gated Buyer Agent

### Track 01 — AI Growth & Agentic Commerce

Custos is an autonomous AI buyer agent that enables AI-driven commerce with
built-in governance, policy controls, explainable decisions, and an auditable
payment workflow.

The agent understands a merchant's catalog, interprets a shopping goal,
constructs an optimized cart within a defined budget, validates stock and
merchant policies, handles failures through bounded revision, and creates a
Razorpay Test Mode order.

Every important decision and money-related action is recorded in a live,
exportable audit trail.

---

## 🚀 What Custos Demonstrates

### 1. Agent-Readable Merchant Catalog

Custos exposes the merchant catalog as structured data that an AI agent can
query and reason over.

Each product contains information such as:

- Product name
- Category
- Price
- Stock availability
- Discount limits

Example endpoint:

```text
GET /catalog
````

This creates a machine-readable catalog that can be consumed by an AI buyer.

---

### 2. AI-Powered Shopping Decisions

The buyer agent receives a natural-language goal such as:

```text
Restock snacks, prefer variety
```

and a defined budget:

```text
₹500
```

The agent analyzes eligible products and proposes a cart.

For every product, the system explains:

* Why the product was selected
* Why another product was rejected
* How the product fits the remaining budget
* How it contributes to the user's goal

This makes the purchasing decision transparent and understandable.

---

### 3. Deterministic Policy Gate

AI proposes the transaction, while deterministic policy checks control
whether the transaction can proceed.

The policy gate validates:

* Budget limits
* Product stock
* Discount limits
* Merchant policies
* Manual approval requirements

A transaction proceeds to order creation only after the required policy checks
are satisfied.

This creates a clear separation between:

```text
AI Decision
     ↓
Policy Validation
     ↓
Risk Evaluation
     ↓
Payment Authorization
     ↓
Order Creation
```

---

### 4. Bounded Agent Revision

Custos implements a controlled revision mechanism.

If the proposed cart fails a policy check:

```text
Attempt 1
   ↓
Policy failure
   ↓
Failure reason returned to agent
   ↓
One bounded revision
   ↓
Policy checked again
   ↓
Pass → Continue
```

The system deliberately uses a bounded revision model so that the agent can
correct its decision using the actual failure reason.

Every revision is recorded in the audit trail.

---

### 5. Intelligent Out-of-Stock Substitution

When a selected product becomes unavailable, Custos identifies an appropriate
alternative from the same product category.

Example:

```text
Masala Makhana
₹150
Out of stock
      ↓
Assorted Trail Mix
₹320
In-stock alternative
```

The substitution is explicitly recorded with:

* Original product
* Original price
* Replacement product
* Replacement price
* Reason for substitution

The policy gate then re-validates the updated cart.

---

### 6. Human Approval Gate

Certain merchant policies can require human approval before order creation.

When approval is required, the workflow moves into an explicit:

```text
WAITING FOR HUMAN APPROVAL
```

state.

The order is created only after the required approval is provided.

This gives merchants control over sensitive purchasing decisions while still
allowing the AI agent to automate the rest of the workflow.

---

### 7. Transaction Risk Assessment

Custos evaluates transaction context before order creation.

The risk score considers signals such as:

* Budget utilization
* Product substitutions
* Transaction characteristics
* Policy outcomes

Example:

```text
Transaction Risk
30 / 100 — MEDIUM
```

The score and its contributing signals are displayed in the interface so that
the transaction can be understood before execution.

---

### 8. Razorpay Test Mode Integration

Custos integrates with Razorpay's Orders API using Razorpay Test Mode.

When Razorpay Test Mode credentials are configured, the backend creates a
Razorpay Test Mode order through the official Razorpay Node SDK.

Example:

```text
Razorpay Test Mode
        ↓
Orders API
        ↓
order_XXXXXXXX
        ↓
Audit Trail
```

The application records:

* Razorpay order ID
* Amount
* Currency
* Receipt
* Payment source
* Order creation event

Razorpay Test Mode allows the complete transaction workflow to be demonstrated
without processing live payments.

---

## 🧠 AI Architecture

Custos supports AI reasoning through Groq.

The agent uses:

```text
Groq API
   ↓
Llama 3.3 70B
   ↓
Shopping Goal Understanding
   ↓
Catalog Reasoning
   ↓
Cart Proposal
   ↓
Policy Validation
```

The system also includes deterministic reasoning logic so the core workflow
remains reproducible during development and demonstration.

---

## ⚡ Real-Time Audit Trail

Custos provides a live transaction timeline using
**Server-Sent Events (SSE)**.

The frontend receives events as the agent progresses.

Example:

```text
Goal received
      ↓
Catalog queried
      ↓
Goal interpreted
      ↓
Cart proposed
      ↓
Stock checked
      ↓
Substitution performed
      ↓
Policy Gate — Attempt 1
      ↓
Revision requested
      ↓
Cart revised
      ↓
Policy Gate — Attempt 2
      ↓
Merchant Policy Gate
      ↓
Risk assessed
      ↓
Razorpay Test Mode order created
      ↓
Flow complete
```

The audit trail can also be exported as JSON.

This provides an inspectable record of the complete agent workflow.

---

## 🎯 Example Demo

### User Goal

```text
Restock snacks, prefer variety
```

### Budget

```text
₹500
```

### Agent Proposal

```text
Roasted Chana             ₹120
Masala Makhana            ₹150
Multigrain Crackers       ₹210
--------------------------------
Estimated Total           ₹480
```

If Masala Makhana is unavailable:

```text
Masala Makhana
      ↓
Out of stock
      ↓
Assorted Trail Mix
      ↓
Cart re-evaluated
```

The updated cart is then checked against the budget.

If the updated cart exceeds the budget:

```text
Policy Gate — Attempt 1
FAILED
      ↓
One bounded revision
      ↓
Cart revised
      ↓
Policy Gate — Attempt 2
PASSED
```

The validated transaction then proceeds through the merchant policy gate,
risk assessment, and Razorpay Test Mode order creation.

---

# 🏗️ System Architecture

```text
                    USER
                     │
                     ▼
              ┌─────────────┐
              │ React UI    │
              │ TypeScript  │
              └──────┬──────┘
                     │
                     │ SSE / REST
                     ▼
              ┌─────────────┐
              │ Express API │
              └──────┬──────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     ┌────────┐ ┌─────────┐ ┌──────────┐
     │ AI     │ │ Policy  │ │ Catalog  │
     │ Agent  │ │ Gate    │ │ Service  │
     └────┬───┘ └────┬────┘ └──────────┘
          │           │
          └─────┬─────┘
                ▼
        ┌───────────────┐
        │ Risk Assessment│
        └───────┬───────┘
                │
                ▼
        ┌────────────────┐
        │ Human Approval │
        │    if needed   │
        └───────┬────────┘
                │
                ▼
        ┌────────────────┐
        │ Razorpay Test  │
        │      Mode      │
        └────────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

## Backend

* Node.js
* Express
* Server-Sent Events

## AI

* Groq API
* Llama 3.3 70B

## Payments

* Razorpay Node SDK
* Razorpay Test Mode

## Deployment

* Render — Backend
* Vercel — Frontend

---

# 📁 Project Structure

```text
server/
│
├── index.js
├── agent.js
├── policy.js
├── order.js
│
├── data/
│   └── catalog.js
│
└── routes/
    ├── basic.js
    └── agentRun.js

client/
│
└── src/
    ├── App.tsx
    │
    └── components/
        ├── GoalPanel.tsx
        └── AuditTrail.tsx
```

### Important Files

```text
agent.js
```

Handles buyer-agent reasoning and cart generation.

```text
policy.js
```

Implements budget, stock, discount, and merchant policy validation.

```text
order.js
```

Handles Razorpay Test Mode order creation.

```text
agentRun.js
```

Orchestrates the complete agent workflow and streams events using SSE.

```text
AuditTrail.tsx
```

Displays the live transaction timeline.

---

# ▶️ Run Locally

## 1. Backend

```bash
cd server
npm install
npm start
```

Backend:

```text
http://localhost:3001
```

---

## 2. Frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Open the frontend in your browser and select a shopping goal.

---

# 🔑 Environment Variables

Create:

```text
server/.env
```

Example:

```env
GROQ_API_KEY=your_groq_api_key

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_test_secret

FRONTEND_URL=https://your-frontend-url.vercel.app
```

The Razorpay credentials should be Test Mode credentials.

---

# 💳 Razorpay Test Mode

Razorpay Test Mode is used for demonstrating the payment workflow.

The backend communicates with Razorpay through the official Node SDK.

The frontend never receives the Razorpay secret.

Example successful audit event:

```text
Razorpay Test Mode order created

Order ID:
order_TW42xggT05KFrL

Amount:
₹600
```

No live payment credentials are required for the demonstration.

---

# 🚀 Deployment

## Backend — Render

Create a new Web Service and use:

```text
Root Directory:
server

Build Command:
npm install

Start Command:
npm start
```

Configure:

```env
GROQ_API_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
FRONTEND_URL
```

Deploy the backend and copy its public URL.

---

## Frontend — Vercel

Create a new project using the `client` directory.

Configure:

```text
Root Directory:
client
```

Environment variable:

```env
VITE_API_BASE=https://your-backend.onrender.com
```

Deploy the frontend.

Finally, update the backend:

```env
FRONTEND_URL=https://your-frontend.vercel.app
```

and redeploy.

---

# 🧪 Demo Scenarios

Custos is designed to demonstrate multiple agentic-commerce situations.

## Scenario 1 — Successful Purchase

```text
Goal:
Restock beverages for the pantry

Budget:
₹1000
```

Expected flow:

```text
Goal
 ↓
Catalog
 ↓
Cart
 ↓
Policy Gate ✓
 ↓
Merchant Gate ✓
 ↓
Risk Assessment
 ↓
Razorpay Test Mode
 ↓
Order Created
```

---

## Scenario 2 — Budget Failure + Bounded Revision

```text
Goal:
Restock snacks, prefer variety

Budget:
₹500
```

Expected flow:

```text
Cart Proposed
      ↓
Substitution
      ↓
Policy Gate — Attempt 1
      ↓
Budget Failure
      ↓
Bounded Revision
      ↓
Policy Gate — Attempt 2
      ↓
Passed
      ↓
Order Created
```

---

## Scenario 3 — Out-of-Stock + Substitution

```text
Product selected
      ↓
Stock Check
      ↓
Out of Stock
      ↓
Same-category alternative
      ↓
Cart updated
      ↓
Policy Gate re-run
      ↓
Transaction continues

```

# 🏆 Why Custos?

Agentic commerce requires more than an AI that can select a product.

Custos combines:

* AI-driven purchasing
* Agent-readable catalogs
* Explainable cart decisions
* Deterministic policy enforcement
* Budget controls
* Stock-aware substitution
* Bounded agent revision
* Merchant-side policies
* Human approval
* Transaction risk scoring
* Razorpay Test Mode
* Real-time auditability

The result is a controlled architecture for AI-driven commerce where the agent
can reason and act while every important money-related decision remains
observable and governed.
---

---
# 🔐 Security Principles

Custos follows a policy-first transaction architecture.

### Credentials

Razorpay credentials remain on the backend.

### Policy Enforcement

Money-related actions are validated before order creation.

### Budget Control

The agent operates within the user's defined spending limit.

### Stock Validation

Product availability is checked before transaction execution.

### Bounded Actions

Agent revision is explicitly limited to a controlled workflow.

### Auditability

Important decisions and transaction events are recorded in the audit trail.

---

# 📌 Hackathon Track

**Track 01 — AI Growth & Agentic Commerce**

Custos directly addresses the challenge of making a merchant transactable by an
AI buyer end-to-end through:

```text
Agent-readable catalog
        +
AI purchasing decisions
        +
Policy gates
        +
Bounded execution
        +
Human approval
        +
Razorpay Test Mode
        +
Live audit trail
```

---

## 👥 Team : Solo
Name: Mohamed Jabri J S 

Mail Id: mohamedjabri904@gmail.com

Built for the Razorpay Buildathon.

**Project:** Custos - The Gated Buyer Agent

**Track:** AI Growth & Agentic Commerce

```

**This version removes the negative/problematic wording** and presents Custos as a polished hackathon product. It still keeps the important Test Mode distinction so the README remains technically honest.
```


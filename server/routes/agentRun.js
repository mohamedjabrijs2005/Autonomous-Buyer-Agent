// The buyer agent. Given a natural-language goal and the catalog, it proposes
// a cart with a reason attached to every included AND every rejected item —
// that reasoning is what gets rendered in the audit trail on the frontend.
//
// If GROQ_API_KEY is set, it uses Llama 3.3-70b via Groq for real reasoning.
// If not, it falls back to a deterministic rule-based agent so the whole
// flow still runs end-to-end with zero setup (useful for a demo where you
// don't want to depend on an API key being present).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function parseBudget(goalText, fallback = 2000) {
  const match = goalText.match(/(?:₹|rs\.?|inr)\s?([\d,]+)/i);
  if (match) return Number(match[1].replace(/,/g, ""));
  return fallback;
}

async function runBuyerAgentWithGroq(goalText, catalog, budget, revisionNote) {
  const systemPrompt = `You are an autonomous buyer agent shopping a merchant's catalog on behalf of a user.
Respond with STRICT JSON only. No markdown, no prose outside the JSON, no code fences.

Given a goal and a catalog, choose items to buy within the budget. For EVERY item you include,
give a short reason. For every notable item you deliberately did NOT pick, add it to "rejected" with a reason.

Output shape exactly:
{
  "cart": [{"id": "p1", "qty": 2, "reason": "..."}],
  "rejected": [{"id": "p3", "reason": "..."}],
  "total_estimated": 1234
}`;

  const userPrompt = `Goal: ${goalText}
Budget: ₹${budget}
${revisionNote ? `Revision needed: ${revisionNote}` : ""}

Catalog:
${JSON.stringify(catalog, null, 2)}`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4
    })
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const cleaned = raw.replace(/^```json\s*|```$/g, "");
  return JSON.parse(cleaned);
}

function runBuyerAgentFallback(goalText, catalog, budget, revisionNote) {
  // Deterministic stand-in: picks affordable, in-stock items across
  // categories mentioned (or all categories if none named), and explains
  // every decision the same way an LLM would.
  //
  // When the goal says "variety" (or similar), this round-robins one
  // affordable item per category at a time instead of greedily sorting
  // the whole pool by price — otherwise a cheap category (e.g. snacks)
  // eats the whole budget before a second category ever gets a look in,
  // which is the opposite of "variety".
  const lowerGoal = goalText.toLowerCase();
  const namedCategories = ["snacks", "beverages", "office"].filter((c) =>
    lowerGoal.includes(c)
  );
  const pool = namedCategories.length
    ? catalog.filter((p) => namedCategories.includes(p.category))
    : catalog;

  const preferVariety = /variety|assort|mix|range/.test(lowerGoal);

  let remaining = revisionNote ? Math.round(budget * 0.85) : budget; // tighten on revision
  const cart = [];
  const rejected = [];
  const chosenIds = new Set();

  if (preferVariety) {
    const categories = [...new Set(pool.map((p) => p.category))];
    let madeProgress = true;

    while (madeProgress && remaining > 0) {
      madeProgress = false;
      for (const cat of categories) {
        const affordable = pool
          .filter((p) => p.category === cat && !chosenIds.has(p.id) && p.price <= remaining)
          .sort((a, b) => a.price - b.price);
        const pick = affordable[0];
        if (pick) {
          cart.push({
            id: pick.id,
            qty: 1,
            reason: `Adds ${cat} variety — cheapest unpicked item in that category within the remaining ₹${remaining} budget.`
          });
          chosenIds.add(pick.id);
          remaining -= pick.price;
          madeProgress = true;
        }
      }
    }

    for (const p of pool) {
      if (!chosenIds.has(p.id)) {
        rejected.push({
          id: p.id,
          reason: `Skipped — ₹${p.price} didn't fit after prioritizing one-per-category variety first.`
        });
      }
    }
  } else {
    const sorted = [...pool].sort((a, b) => a.price - b.price);
    for (const item of sorted) {
      // Note: stock is deliberately NOT checked here — availability is the
      // policy gate's job (and the substitution step's job), not the agent's
      // proposal step. This mirrors how an LLM agent would behave: it reasons
      // about fit and budget, and the system around it enforces availability.
      if (item.price <= remaining) {
        cart.push({
          id: item.id,
          qty: 1,
          reason: `Fits within remaining budget (₹${item.price}).`
        });
        remaining -= item.price;
      } else {
        rejected.push({
          id: item.id,
          reason: `Skipped — ₹${item.price} would exceed the remaining budget of ₹${remaining}.`
        });
      }
    }
  }

  const total_estimated = cart.reduce((sum, c) => {
    const p = catalog.find((x) => x.id === c.id);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);

  return { cart, rejected, total_estimated };
}

export async function runBuyerAgent(goalText, catalog, budgetOverride, revisionNote) {
  const budget = budgetOverride || parseBudget(goalText);
  if (process.env.GROQ_API_KEY) {
    try {
      return await runBuyerAgentWithGroq(goalText, catalog, budget, revisionNote);
    } catch (err) {
      console.error("Groq call failed, falling back to rule-based agent:", err.message);
      return runBuyerAgentFallback(goalText, catalog, budget, revisionNote);
    }
  }
  return runBuyerAgentFallback(goalText, catalog, budget, revisionNote);
}

export { parseBudget };

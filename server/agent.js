// The buyer agent. Given a natural-language goal and the catalog, it proposes
// a cart with a reason attached to every included AND every rejected item —
// that reasoning is what gets rendered in the audit trail on the frontend.
//
// If GROQ_API_KEY is set, it uses Llama 3.3-70b via Groq for real reasoning.
// If not, it falls back to a deterministic rule-based agent so the whole
// flow still runs end-to-end with zero setup (useful for a demo where you
// don't want to depend on an API key being present).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Deterministic category interpretation — this is the fix for the bug where
// "restock office snacks" was matching BOTH "snacks" and "office" as
// requested categories, because "office" appeared as a literal substring
// even though it was only qualifying WHERE the snacks are for, not
// requesting office supplies. Category filtering must happen before cart
// selection, and it must be a deterministic rule the LLM cannot override —
// not something left to prompt-following.
const CATEGORY_KEYWORDS = {
  snacks: /\bsnacks?\b/i,
  beverages: /\bbeverages?\b|\bdrinks?\b|\bcoffee\b|\btea\b/i,
  office: /\boffice\s+suppl(y|ies)\b|\bstationery\b|\bstationary\b|\bnotebooks?\b|\bpens?\b|\bsticky\s*notes?\b|\borganizers?\b/i
};

export function interpretGoal(goalText, catalog) {
  const matched = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, re]) => re.test(goalText))
    .map(([cat]) => cat);
  const categories = matched.length ? matched : null; // null = no constraint, consider all categories
  const pool = categories ? catalog.filter((p) => categories.includes(p.category)) : catalog;
  return { categories, pool };
}

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

function runBuyerAgentFallback(pool, budget, revisionNote) {
  // Deterministic stand-in: picks affordable, in-stock items from the
  // ALREADY category-filtered pool, greedily within budget, and explains
  // every decision the same way an LLM would.
  let remaining = revisionNote ? Math.round(budget * 0.85) : budget; // tighten on revision
  const cart = [];
  const rejected = [];

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
        reason: `Fits within remaining budget (₹${item.price}) and adds category variety.`
      });
      remaining -= item.price;
    } else {
      rejected.push({
        id: item.id,
        reason: `Skipped — ₹${item.price} would exceed the remaining budget of ₹${remaining}.`
      });
    }
  }

  const total_estimated = cart.reduce((sum, c) => {
    const p = pool.find((x) => x.id === c.id);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);

  return { cart, rejected, total_estimated };
}

export async function runBuyerAgent(goalText, catalog, budgetOverride, revisionNote) {
  const budget = budgetOverride || parseBudget(goalText);
  // Category filtering happens HERE, deterministically, before either
  // reasoning path runs. The LLM (if used) only ever sees the already-
  // filtered pool — it never gets to decide category eligibility itself.
  const { pool } = interpretGoal(goalText, catalog);
  if (process.env.GROQ_API_KEY) {
    try {
      return await runBuyerAgentWithGroq(goalText, pool, budget, revisionNote);
    } catch (err) {
      console.error("Groq call failed, falling back to rule-based agent:", err.message);
      return runBuyerAgentFallback(pool, budget, revisionNote);
    }
  }
  return runBuyerAgentFallback(pool, budget, revisionNote);
}

export { parseBudget };

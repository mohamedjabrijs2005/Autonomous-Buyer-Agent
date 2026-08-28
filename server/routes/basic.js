import express from "express";
import { getCatalog } from "../data/catalog.js";
import { checkPolicy } from "../policy.js";
import { createOrder } from "../order.js";

const router = express.Router();

// GET /catalog — the agent-readable catalog itself
router.get("/catalog", (req, res) => {
  res.json(getCatalog());
});

// POST /policy-check — { cart: [{id, qty, discount_pct?}], budget }
router.post("/policy-check", (req, res) => {
  const { cart, budget } = req.body;
  if (!Array.isArray(cart) || typeof budget !== "number") {
    return res.status(400).json({ error: "cart (array) and budget (number) are required" });
  }
  res.json(checkPolicy(cart, budget));
});

// POST /order — { total, receiptId }
router.post("/order", async (req, res) => {
  const { total, receiptId } = req.body;
  if (typeof total !== "number") {
    return res.status(400).json({ error: "total (number) is required" });
  }
  const order = await createOrder(total, receiptId || `receipt_${Date.now()}`);
  res.json(order);
});

export default router;

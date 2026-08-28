// Agent-readable catalog. Any agent (yours, or an external AI buyer) can query
// this and reason about what to buy — that's the "agent-readable catalog"
// piece the brief calls out, not just a checkout UI.

export const catalog = [
  { id: "p1", name: "Assorted Trail Mix (500g)", category: "snacks", price: 320, stock: 40, max_discount_pct: 10 },
  { id: "p2", name: "Dark Chocolate Almonds (250g)", category: "snacks", price: 280, stock: 25, max_discount_pct: 10 },
  { id: "p3", name: "Masala Makhana (200g)", category: "snacks", price: 150, stock: 0, max_discount_pct: 15 }, // out of stock — triggers substitution
  { id: "p4", name: "Roasted Chana (300g)", category: "snacks", price: 120, stock: 60, max_discount_pct: 15 },
  { id: "p5", name: "Multigrain Crackers (Pack of 3)", category: "snacks", price: 210, stock: 30, max_discount_pct: 5 },
  { id: "p6", name: "Filter Coffee Powder (500g)", category: "beverages", price: 340, stock: 20, max_discount_pct: 10 },
  { id: "p7", name: "Green Tea Bags (Box of 25)", category: "beverages", price: 260, stock: 35, max_discount_pct: 10 },
  { id: "p8", name: "Cold Brew Concentrate (750ml)", category: "beverages", price: 450, stock: 15, max_discount_pct: 5 },
  { id: "p9", name: "A4 Notebook Set (Pack of 5)", category: "office", price: 380, stock: 22, max_discount_pct: 10 },
  { id: "p10", name: "Gel Pens (Box of 12)", category: "office", price: 180, stock: 50, max_discount_pct: 20 },
  { id: "p11", name: "Sticky Notes Combo Pack", category: "office", price: 220, stock: 18, max_discount_pct: 15 },
  { id: "p12", name: "Desk Organizer Tray", category: "office", price: 550, stock: 10, max_discount_pct: 5 }
];

export const getCatalog = () => catalog;

export const findById = (id) => catalog.find((p) => p.id === id);

export const findSubstitute = (originalId, excludeIds = []) => {
  const original = findById(originalId);
  if (!original) return null;
  return (
    catalog.find(
      (p) =>
        p.category === original.category &&
        p.id !== originalId &&
        p.stock > 0 &&
        !excludeIds.includes(p.id)
    ) || null
  );
};

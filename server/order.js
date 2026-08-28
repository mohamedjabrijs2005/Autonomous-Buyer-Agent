import Razorpay from "razorpay";

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

export async function createOrder(total, receiptId) {
  if (razorpay) {
    // Real Razorpay test-mode order — this is what proves an actual API
    // call happened, not a mock, when you demo this.
    const order = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise
      currency: "INR",
      receipt: receiptId
    });
    return { source: "razorpay_test_mode", ...order };
  }

  // Mock fallback so the flow still completes with zero setup.
  return {
    source: "mock",
    id: `mock_order_${Date.now()}`,
    amount: Math.round(total * 100),
    currency: "INR",
    receipt: receiptId,
    status: "created",
    created_at: Math.floor(Date.now() / 1000)
  };
}

import Razorpay from "razorpay";

// Test-mode-only guard (safety requirement for this hackathon project): a
// live-mode key (rzp_live_...) must never be silently used. If the key
// doesn't look like a test key, we refuse to initialize Razorpay at all and
// createOrder() throws a clear config error instead of falling back to mock
// or, worse, proceeding with real-money credentials.
let razorpay = null;
let razorpayConfigError = null;

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (keyId && keySecret) {
  if (!keyId.startsWith("rzp_test_")) {
    razorpayConfigError =
      "Custos payment integration requires Razorpay Test Mode credentials (a key starting with rzp_test_). Refusing to initialize with a non-test key.";
    console.error(razorpayConfigError);
  } else {
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
}

export function isRealRazorpayConfigured() {
  return Boolean(razorpay);
}

export function getPublicKeyId() {
  return razorpay ? keyId : null;
}

export async function createOrder(total, receiptId) {
  if (razorpayConfigError) {
    throw new Error(razorpayConfigError);
  }
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

  // Mock fallback so the flow still completes with zero setup. Deliberately
  // unchanged from before — the mock path completes immediately with no
  // payment step, exactly as it did before this feature existed.
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

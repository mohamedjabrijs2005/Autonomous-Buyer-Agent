import crypto from "crypto";

// Verifies a Razorpay Checkout success callback server-side. The frontend's
// success callback is NEVER trusted alone — this is the only place that
// decides whether a payment actually happened.
//
// Expected signature = HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
export function verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(String(razorpay_signature));
  if (expectedBuf.length !== actualBuf.length) return false;

  try {
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

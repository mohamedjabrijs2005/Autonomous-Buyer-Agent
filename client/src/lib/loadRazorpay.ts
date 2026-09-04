// Loads the Razorpay Checkout script exactly once, no matter how many times
// this is called across multiple agent runs. Safe to call repeatedly.

let loadPromise: Promise<void> | null = null;

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).Razorpay) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow retry on next call
      reject(new Error("Razorpay script failed to load"));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

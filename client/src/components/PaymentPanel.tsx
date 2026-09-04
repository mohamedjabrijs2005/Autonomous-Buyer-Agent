import { useState } from "react";
import { CreditCard, Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import { API_BASE } from "../config";
import { loadRazorpayScript } from "../lib/loadRazorpay";
import type { PaymentInfo } from "../types";

type Props = {
  payment: PaymentInfo;
  runId: string;
  onInitiated: () => void;
};

const STATUS_META: Record<PaymentInfo["status"], { label: string; color: string; bg: string; icon: typeof CreditCard }> = {
  awaiting_payment: { label: "AWAITING TEST PAYMENT", color: "text-accent", bg: "bg-accent/10 border-accent/30", icon: CreditCard },
  processing: { label: "PAYMENT PROCESSING", color: "text-accent2", bg: "bg-accent2/10 border-accent2/30", icon: Loader2 },
  verified: { label: "PAYMENT VERIFIED", color: "text-pass", bg: "bg-pass/10 border-pass/30", icon: CheckCircle2 },
  failed: { label: "PAYMENT FAILED", color: "text-fail", bg: "bg-fail/10 border-fail/30", icon: XCircle },
  cancelled: { label: "PAYMENT CANCELLED", color: "text-muted", bg: "bg-ink/5 border-ink/15", icon: Ban }
};

export default function PaymentPanel({ payment, runId, onInitiated }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const meta = STATUS_META[payment.status];
  const Icon = meta.icon;

  const handlePay = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const configRes = await fetch(`${API_BASE}/payment/config`);
      const config = await configRes.json();
      if (!config.available) {
        setLoadError("Razorpay Test Mode is not configured on the server.");
        setLoading(false);
        return;
      }

      await loadRazorpayScript();

      // Audit-trail marker — fired the moment the user explicitly acts,
      // before Checkout even opens.
      onInitiated();
      await fetch(`${API_BASE}/payment/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId })
      });

      const rzp = new (window as any).Razorpay({
        key: config.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "CUSTOS",
        description: "Governed AI Buyer Transaction",
        order_id: payment.orderId,
        handler: async (response: any) => {
          await fetch(`${API_BASE}/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
        },
        modal: {
          ondismiss: () => {
            fetch(`${API_BASE}/payment/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ runId })
            });
          }
        }
      });

      rzp.on("payment.failed", (resp: any) => {
        fetch(`${API_BASE}/payment/failed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, reason: resp?.error?.description || "Razorpay Test Mode payment failed." })
        });
      });

      rzp.open();
    } catch {
      setLoadError("Unable to load Razorpay Checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${meta.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${meta.color} ${payment.status === "processing" ? "animate-spin" : ""}`} />
        <span className={`text-xs font-semibold tracking-wide ${meta.color}`}>{meta.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <div className="text-[11px] text-muted uppercase tracking-wide">Order ID</div>
          <div className="font-mono text-ink truncate">{payment.orderId}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted uppercase tracking-wide">Amount</div>
          <div className="font-mono text-ink">₹{(payment.amount / 100).toFixed(2)}</div>
        </div>
      </div>

      {payment.status === "awaiting_payment" && (
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-ink text-white font-medium text-sm py-2.5 hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Proceed to Razorpay Test Payment
        </button>
      )}

      {payment.status === "verified" && payment.paymentId && (
        <div className="text-xs font-mono text-pass">{payment.paymentId}</div>
      )}

      {(payment.status === "failed" || payment.status === "cancelled") && payment.reason && (
        <div className="text-xs text-muted">{payment.reason}</div>
      )}

      {loadError && <div className="text-xs text-fail mt-2">{loadError}</div>}
    </div>
  );
}

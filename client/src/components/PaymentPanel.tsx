import { useState } from "react";
import { CreditCard, Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import { API_BASE } from "../config";
import { loadRazorpayScript } from "../lib/loadRazorpay";
import type { PaymentInfo } from "../types";

type Props = {
  payment: PaymentInfo;
  runId: string;
  onInitiated: () => void;
  onVerifying?: () => void;
};

const STATUS_CONFIG: Record<
  PaymentInfo["status"],
  {
    statusLabel: string;
    heading: string;
    description: string;
    color: string;
    bg: string;
    badgeBg: string;
    icon: typeof CreditCard;
  }
> = {
  awaiting_payment: {
    statusLabel: "READY FOR PAYMENT",
    heading: "Order Ready for Payment",
    description:
      "All policy and merchant checks have passed. Complete the Razorpay Test Mode payment to finish the transaction.",
    color: "text-gold",
    bg: "bg-gold-light/40 border-gold-border",
    badgeBg: "bg-gold text-white",
    icon: CreditCard
  },
  processing: {
    statusLabel: "PAYMENT IN PROGRESS",
    heading: "Payment Initiated",
    description: "Razorpay Test Mode Checkout is in progress.",
    color: "text-amber-700",
    bg: "bg-amber-50/60 border-amber-200",
    badgeBg: "bg-amber-600 text-white",
    icon: Loader2
  },
  verifying: {
    statusLabel: "VERIFYING PAYMENT",
    heading: "Verifying Payment",
    description: "Verifying Razorpay payment signature securely with the backend.",
    color: "text-amber-700",
    bg: "bg-amber-50/60 border-amber-200",
    badgeBg: "bg-amber-600 text-white",
    icon: Loader2
  },
  verified: {
    statusLabel: "PAYMENT VERIFIED",
    heading: "Payment Verified Successfully",
    description: "Razorpay payment signature verified securely on the backend.",
    color: "text-pass",
    bg: "bg-pass-bg border-pass-border",
    badgeBg: "bg-pass text-white",
    icon: CheckCircle2
  },
  failed: {
    statusLabel: "PAYMENT FAILED",
    heading: "Payment Failed",
    description: "Razorpay Test Mode payment could not be completed.",
    color: "text-fail",
    bg: "bg-fail-bg border-fail-border",
    badgeBg: "bg-fail text-white",
    icon: XCircle
  },
  cancelled: {
    statusLabel: "PAYMENT CANCELLED",
    heading: "Payment Cancelled",
    description: "Payment was cancelled by user. Modal dismissed without completing payment.",
    color: "text-muted",
    bg: "bg-surface border-line",
    badgeBg: "bg-muted text-white",
    icon: Ban
  }
};

export default function PaymentPanel({ payment, runId, onInitiated, onVerifying }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const config = STATUS_CONFIG[payment.status] || STATUS_CONFIG.awaiting_payment;
  const Icon = config.icon;

  const handlePay = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const configRes = await fetch(`${API_BASE}/payment/config`);
      const rzpConfig = await configRes.json();
      if (!rzpConfig.available) {
        setLoadError("Razorpay Test Mode is not configured on the server.");
        setLoading(false);
        return;
      }

      await loadRazorpayScript();

      // Audit-trail marker — fired the moment the user explicitly acts
      onInitiated();
      await fetch(`${API_BASE}/payment/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId })
      });

      const rzp = new (window as any).Razorpay({
        key: rzpConfig.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "CUSTOS",
        description: "Governed AI Buyer Transaction",
        order_id: payment.orderId,
        handler: async (response: any) => {
          onVerifying?.();
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
    <div className={`rounded-xl border p-5 shadow-card ${config.bg}`}>
      {/* Header with Badge & Main Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded ${config.badgeBg}`}>
            {config.statusLabel}
          </span>
          <span className="text-sm font-semibold text-ink">
            {config.heading}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Icon className={`w-3.5 h-3.5 ${config.color} ${payment.status === "processing" || payment.status === "verifying" ? "animate-spin" : ""}`} />
          <span className="font-medium">{config.statusLabel}</span>
        </div>
      </div>

      {/* Supporting Text */}
      <p className="text-xs text-muted mb-4 leading-relaxed">
        {payment.reason && (payment.status === "failed" || payment.status === "cancelled")
          ? payment.reason
          : config.description}
      </p>

      {/* Transaction Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4 bg-surface/70 border border-line/60 rounded-lg p-3">
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">Order ID</div>
          <div className="font-mono text-ink text-xs font-semibold truncate select-all">{payment.orderId}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">Amount</div>
          <div className="font-mono text-ink text-xs font-bold">₹{(payment.amount / 100).toFixed(2)}</div>
        </div>
        {payment.paymentId ? (
          <div>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">Payment ID</div>
            <div className="font-mono text-pass text-xs font-semibold truncate select-all">{payment.paymentId}</div>
          </div>
        ) : (
          <div>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">Currency</div>
            <div className="font-mono text-ink text-xs">{payment.currency}</div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">Payment Mode</div>
          <div className="text-xs font-medium text-gold-dark">Razorpay Test Mode</div>
        </div>
      </div>

      {/* User Action Button — only when ready for payment */}
      {payment.status === "awaiting_payment" && (
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold hover:bg-gold-hover text-white font-medium text-sm py-2.5 shadow-gold disabled:opacity-50 transition-all active:scale-[0.99]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Proceed to Razorpay Test Payment
        </button>
      )}

      {loadError && <div className="text-xs text-fail mt-2 font-medium">{loadError}</div>}
    </div>
  );
}


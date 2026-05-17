import { X, CheckCircle, AlertCircle } from "lucide-react";
import { useUser } from "../../contexts/UserContext";

export function PaymentFlashBanner() {
  const { paymentFlash, clearPaymentFlash } = useUser();
  if (!paymentFlash) return null;

  const success = paymentFlash.toLowerCase().includes("confirmed");

  return (
    <div
      className="mx-4 mt-3 mb-1 flex items-start gap-3 rounded-2xl px-4 py-3 border flex-shrink-0 z-50"
      style={{
        background: success ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)",
        borderColor: success ? "rgba(34,197,94,0.35)" : "rgba(251,191,36,0.35)",
      }}
    >
      {success ? (
        <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
      )}
      <p className="text-white font-bold flex-1 text-sm leading-snug">{paymentFlash}</p>
      <button
        type="button"
        onClick={clearPaymentFlash}
        className="text-gray-400 hover:text-white p-1"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

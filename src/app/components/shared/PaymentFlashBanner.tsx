import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { useUser } from "../../contexts/UserContext";

export function PaymentFlashBanner() {
  const { paymentFlash, clearPaymentFlash } = useUser();
  useEffect(() => {
    if (!paymentFlash) return;
    const timer = window.setTimeout(clearPaymentFlash, 5200);
    return () => window.clearTimeout(timer);
  }, [paymentFlash, clearPaymentFlash]);

  const success = paymentFlash?.toLowerCase().includes("confirmed") ?? false;

  return (
    <AnimatePresence>
      {paymentFlash && (
        <motion.div
          initial={{ opacity: 0, y: -18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed left-1/2 top-4 z-[1300] flex w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3 border shadow-2xl backdrop-blur-md"
          style={{
            background: success ? "rgba(20,83,45,0.92)" : "rgba(113,63,18,0.92)",
            borderColor: success ? "rgba(34,197,94,0.38)" : "rgba(251,191,36,0.38)",
          }}
        >
          {success ? (
            <CheckCircle size={18} className="text-green-300 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-amber-300 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-white font-bold flex-1 text-sm leading-snug">{paymentFlash}</p>
          <button
            type="button"
            onClick={clearPaymentFlash}
            className="text-white/60 hover:text-white p-1"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

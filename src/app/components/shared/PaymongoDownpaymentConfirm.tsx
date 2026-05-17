import { useState } from "react";
import { motion } from "motion/react";
import { CreditCard, Loader2, Smartphone } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { persistDemoSession, readPersistedDemoSession } from "../../utils/demoSession";
import {
  initiateCourtBookingPayment,
  redirectToPayMongoCheckout,
  type CourtBookingPaymentInput,
} from "../../services/paymongoPayment";

export type PendingCoachingLink = {
  coachingSessionId?: string;
  coachId?: string;
  coachingStudentId?: string;
  coachName?: string;
  coachHourlyRate?: number;
  duration: number;
  sessionDate?: string;
  startTime?: string;
  courtAmount: number;
  coachFee: number;
  totalDue: number;
  refCode: string;
  acceptedBy?: string;
};

const PENDING_COACHING_KEY = "sportsync_pending_coaching";

type PaymongoDownpaymentConfirmProps = {
  totalAmount: number;
  downpaymentPercentage: number;
  bookingPayload: CourtBookingPaymentInput;
  onCancel: () => void;
  pendingCoachingLink?: PendingCoachingLink;
};

export function PaymongoDownpaymentConfirm({
  totalAmount,
  downpaymentPercentage,
  bookingPayload,
  onCancel,
  pendingCoachingLink,
}: PaymongoDownpaymentConfirmProps) {
  const { user } = useUser();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const pct = Math.min(100, Math.max(1, downpaymentPercentage || 50));
  const downpaymentAmount = Math.round((totalAmount * pct) / 100);
  const balanceDue = Math.max(0, totalAmount - downpaymentAmount);

  const handlePay = async () => {
    setProcessing(true);
    setError("");
    try {
      if (!user?.id || !user?.email) {
        throw new Error("Please sign in to pay for your booking.");
      }

      const result = await initiateCourtBookingPayment(
        {
          ...bookingPayload,
          downpayment_percentage: pct,
          user_id: bookingPayload.user_id || user.id,
        },
        { id: user.id, email: user.email },
      );
      if (pendingCoachingLink) {
        try {
          sessionStorage.setItem(
            PENDING_COACHING_KEY,
            JSON.stringify({ ...pendingCoachingLink, bookingId: result.bookingId }),
          );
        } catch {
          /* ignore */
        }
      }
      if (user) {
        const snap = readPersistedDemoSession();
        persistDemoSession(user, snap?.demoAuthId ?? user.id);
      }
      redirectToPayMongoCheckout(result.checkoutUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment could not be started");
      setProcessing(false);
    }
  };

  return (
    <motion.div
      animate={{ boxShadow: ["0px 0px 0px rgba(255,140,0,0)", "0px 0px 20px rgba(255,140,0,0.25)", "0px 0px 0px rgba(255,140,0,0)"] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="space-y-4"
    >
      <motion.div
        className="rounded-3xl overflow-hidden relative"
        style={{ background: "linear-gradient(135deg,#FF8C00,#cc7000)", padding: "20px" }}
      >
        <motion.div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mt-10 -mr-10 pointer-events-none" />
        <motion.div className="flex items-center justify-between relative z-10 gap-3">
          <motion.div className="flex flex-col min-w-0">
            <motion.div className="flex items-center gap-2 mb-1">
              <motion.div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <motion.p className="text-orange-100 font-black tracking-widest" style={{ fontSize: 10 }}>
                PAY ONLINE · TEST MODE
              </motion.p>
            </motion.div>
            <motion.p className="text-white font-black leading-tight" style={{ fontSize: 20 }}>
              Downpayment ({pct}%)
            </motion.p>
            <motion.p className="text-orange-100/90 mt-1" style={{ fontSize: 11 }}>
              GCash, card, Maya & more via PayMongo
            </motion.p>
          </motion.div>
          <motion.div className="text-right bg-black/20 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner flex-shrink-0">
            <motion.p className="text-orange-200 font-bold mb-0.5" style={{ fontSize: 9, letterSpacing: 0.5 }}>
              PAY NOW
            </motion.p>
            <motion.p className="text-white font-black" style={{ fontSize: 22, lineHeight: 1 }}>
              {"\u20B1"}{downpaymentAmount.toLocaleString()}
            </motion.p>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div className="p-4 bg-[#1A1A1A] rounded-2xl border border-white/8 space-y-2">
        <motion.div className="flex justify-between text-sm">
          <span className="text-gray-400">Total booking</span>
          <span className="text-white font-black">{"\u20B1"}{totalAmount.toLocaleString()}</span>
        </motion.div>
        <motion.div className="flex justify-between text-sm">
          <span className="text-gray-400">Downpayment today ({pct}%)</span>
          <span className="text-[#FF8C00] font-black">{"\u20B1"}{downpaymentAmount.toLocaleString()}</span>
        </motion.div>
        <motion.div className="flex justify-between text-sm border-t border-white/5 pt-2">
          <span className="text-gray-500">Balance at facility</span>
          <span className="text-gray-300 font-black">{"\u20B1"}{balanceDue.toLocaleString()}</span>
        </motion.div>
      </motion.div>

      <motion.div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20 flex items-start gap-3">
        <CreditCard size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
        <motion.p className="text-gray-300 font-medium" style={{ fontSize: 13, lineHeight: 1.5 }}>
          After you complete payment, your booking appears in My Bookings. Pay the remaining balance at the front desk on arrival.
        </motion.p>
      </motion.div>

      {error && (
        <motion.div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold">
          {error}
        </motion.div>
      )}

      {processing ? (
        <motion.div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={40} className="text-[#FF8C00] animate-spin" />
          <motion.p className="text-white font-black" style={{ fontSize: 15 }}>
            Redirecting to PayMongo…
          </motion.p>
          <motion.p className="text-gray-500 text-xs text-center max-w-xs">
            Use PayMongo test cards or GCash test credentials in sandbox mode.
          </motion.p>
        </motion.div>
      ) : (
        <motion.div className="flex gap-2">
          <motion.button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-black transition-all hover:text-white"
            style={{ fontSize: 13 }}
          >
            Back
          </motion.button>
          <motion.button
            type="button"
            onClick={handlePay}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
            style={{
              fontSize: 14,
              background: "linear-gradient(135deg,#FF8C00,#e67e00)",
              boxShadow: "0 4px 16px rgba(255,140,0,0.4)",
            }}
          >
            <Smartphone size={16} />
            Pay {"\u20B1"}{downpaymentAmount.toLocaleString()}
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

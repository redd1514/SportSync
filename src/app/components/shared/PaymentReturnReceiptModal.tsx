import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Clock, Download, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { downloadTicketQrPng } from "../../../shared/qrDownload";
import { useUser } from "../../contexts/UserContext";
import {
  PAYMENT_RETURN_RECEIPT_KEY,
  PAYMENT_RETURN_RECEIPT_READY_KEY,
} from "./PaymongoDownpaymentConfirm";

type ReceiptSnapshot = {
  bookingId?: string;
  refCode?: string;
  court?: string;
  sport?: string;
  date?: string;
  time?: string;
  duration?: number;
  totalAmount?: number;
  downpaymentAmount?: number;
  downpaymentPercentage?: number;
  balanceDue?: number;
  coaching?: boolean;
};

function money(value?: number) {
  return `₱${Math.max(0, Number(value || 0)).toLocaleString()}`;
}

function shortDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
}

function time12(value?: string) {
  if (!value) return "";
  const hour = Number(value.split(":")[0]);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

export function PaymentReturnReceiptModal() {
  const { showPaymentFlash } = useUser();
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      try {
        if (sessionStorage.getItem(PAYMENT_RETURN_RECEIPT_READY_KEY) !== "1") return false;
        const raw = sessionStorage.getItem(PAYMENT_RETURN_RECEIPT_KEY);
        if (!raw || cancelled) return false;
        setReceipt(JSON.parse(raw));
        return true;
      } catch {
        setReceipt(null);
        return true;
      }
    };
    if (load()) return;
    const timer = window.setInterval(() => {
      if (load()) window.clearInterval(timer);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const close = () => {
    try {
      sessionStorage.removeItem(PAYMENT_RETURN_RECEIPT_KEY);
      sessionStorage.removeItem(PAYMENT_RETURN_RECEIPT_READY_KEY);
    } catch {
      /* ignore */
    }
    setReceipt(null);
    window.setTimeout(() => {
      showPaymentFlash(
        receipt?.coaching
          ? "Downpayment received - your coaching request is in My Coaching and the coach inbox."
          : "Downpayment received - your booking is confirmed. View it in My Bookings.",
      );
    }, 220);
  };

  const code = receipt?.refCode || receipt?.bookingId || "";

  return (
    <AnimatePresence>
      {receipt && (
        <motion.div
          className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="w-full max-w-[28rem] rounded-t-3xl sm:rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ background: "#181818", maxHeight: "92vh" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-green-500/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                  <CheckCircle size={23} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 16 }}>Downpayment received</p>
                  <p className="text-green-300 font-bold" style={{ fontSize: 12 }}>
                    {receipt.coaching ? "Coaching court slot reserved" : "Booking confirmed"}
                  </p>
                </div>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: "calc(92vh - 76px)", scrollbarWidth: "none" }}>
              <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-black truncate" style={{ fontSize: 15 }}>{receipt.court}</p>
                  <p className="text-gray-400" style={{ fontSize: 12 }}>
                    {shortDate(receipt.date)} · {time12(receipt.time)} · {receipt.duration || 1}h
                  </p>
                </div>
                <p className="text-orange-400 font-black flex-shrink-0" style={{ fontSize: 22 }}>{money(receipt.totalAmount)}</p>
              </div>

              <div className="bg-white rounded-3xl p-5 flex flex-col items-center gap-3">
                <p className="text-gray-600 font-black text-center" style={{ fontSize: 10, letterSpacing: 1.4 }}>
                  SHOW AT FRONT DESK TO CHECK IN
                </p>
                <div style={{ background: "white", padding: 4, borderRadius: 12 }}>
                  <QRCodeSVG value={code} size={160} level="H" includeMargin={false} />
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2">
                  <QrCode size={13} className="text-gray-500" />
                  <span className="text-gray-800 font-black" style={{ fontSize: 14, letterSpacing: 1.5 }}>{code}</span>
                </div>
                <button
                  type="button"
                  disabled={qrBusy}
                  onClick={async () => {
                    setQrBusy(true);
                    try {
                      await downloadTicketQrPng({ value: code, fileBaseName: code.replace(/\s+/g, "_"), displayCode: code });
                    } finally {
                      setQrBusy(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl font-black text-gray-800 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ fontSize: 13 }}
                >
                  <Download size={15} />
                  {qrBusy ? "Preparing..." : "Download QR image"}
                </button>
              </div>

              <div className="rounded-2xl bg-[#111] border border-white/8 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Downpayment paid ({receipt.downpaymentPercentage || 50}%)</span>
                  <span className="text-green-300 font-black">{money(receipt.downpaymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                  <span className="text-gray-500">Balance at facility</span>
                  <span className="text-white font-black">{money(receipt.balanceDue)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start gap-3">
                <Clock size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-gray-300 font-medium leading-relaxed" style={{ fontSize: 13 }}>
                  {receipt.coaching
                    ? "Keep this QR ready for check-in. Settle the remaining balance at the front desk before your coaching session starts."
                    : "Keep this QR ready for check-in. Pay the remaining balance at the front desk when you arrive."}
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="w-full py-3.5 rounded-2xl bg-[#FF8C00] text-white font-black shadow-lg shadow-orange-500/25"
                style={{ fontSize: 14 }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

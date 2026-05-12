import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, CheckCircle, X } from "lucide-react";

interface CoachingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestDetails: any;
  coachingFee: number;
  onPaymentComplete: (proofUrl: string) => Promise<void>;
}

export function CoachingPaymentModal({
  isOpen,
  onClose,
  requestDetails,
  coachingFee,
  onPaymentComplete,
}: CoachingPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "success">("upload");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handlePay = async () => {
    if (!uploadedFile) return;
    setLoading(true);
    try {
      const proofUrl = `payment-proof-${Date.now()}`;
      await onPaymentComplete(proofUrl);
      setStep("success");
      setTimeout(() => {
        onClose();
        setStep("upload");
        setUploadedFile(null);
      }, 2000);
    } catch (error) {
      console.error("Payment error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === "upload") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm p-0 md:p-4"
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-[#1E1E1F] w-full max-w-md rounded-t-3xl md:rounded-3xl border border-white/10"
            style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {step === "success" ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500 flex items-center justify-center">
                    <CheckCircle size={40} className="text-green-400" />
                  </div>
                </motion.div>
                <div className="text-center">
                  <h3 className="text-white font-black" style={{ fontSize: 22 }}>Payment Received!</h3>
                  <p className="text-gray-400 mt-2" style={{ fontSize: 14 }}>
                    Your payment is under verification. Staff will verify within 2 hours.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                  <div>
                    <p className="text-white font-black" style={{ fontSize: 16 }}>Complete Payment</p>
                    <p className="text-gray-500 text-xs mt-0.5">for {requestDetails?.coachName}</p>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
                  {/* Payment Details */}
                  <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                    <div className="flex justify-between mb-3">
                      <span className="text-gray-400 font-black" style={{ fontSize: 12 }}>COACHING FEE</span>
                      <span className="text-white font-black">₱{coachingFee?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                      <span className="text-gray-400 font-black" style={{ fontSize: 12 }}>DATE</span>
                      <span className="text-white font-black">{requestDetails?.requestedDate}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                      <span className="text-gray-400 font-black" style={{ fontSize: 12 }}>TIME</span>
                      <span className="text-white font-black">{requestDetails?.requestedTime}</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 mt-3 flex justify-between">
                      <span className="text-white font-black" style={{ fontSize: 13 }}>TOTAL</span>
                      <span className="text-orange-400 font-black" style={{ fontSize: 18 }}>₱{coachingFee?.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="text-gray-400 font-black mb-2 block" style={{ fontSize: 11, letterSpacing: 0.5 }}>UPLOAD PAYMENT PROOF</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors bg-white/5">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="text-gray-400 mb-2" size={24} />
                        <p className="text-xs text-gray-400 text-center px-2">
                          {uploadedFile ? uploadedFile.name : "Click to upload payment proof"}
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        disabled={loading}
                      />
                    </label>
                  </div>

                  <p className="text-xs text-gray-500 px-1">
                    Accepted: PNG, JPG, PDF (max 10MB). Staff will verify within 2 hours.
                  </p>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-3 border-t border-white/8 flex-shrink-0 flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 py-3 px-4 rounded-xl font-black transition-all"
                    style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: loading ? '#666' : '#fff' }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePay}
                    disabled={loading || !uploadedFile}
                    className="flex-1 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center"
                    style={{
                      fontSize: 13,
                      background: !uploadedFile || loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#FF8C00,#EA580C)',
                      color: !uploadedFile || loading ? '#666' : 'white',
                      cursor: !uploadedFile || loading ? 'not-allowed' : 'pointer',
                      boxShadow: uploadedFile && !loading ? '0 4px 16px rgba(255,140,0,0.3)' : 'none',
                    }}
                  >
                    {loading ? "Processing..." : "Submit Payment"}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

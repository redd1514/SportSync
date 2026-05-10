import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { motion } from "motion/react";
import { Upload, CheckCircle, Clock } from "lucide-react";

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
  const [step, setStep] = useState<"upload" | "confirm" | "success">("upload");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handlePay = async () => {
    if (!uploadedFile) return;
    setLoading(true);
    try {
      // Simulate file upload and get proof URL
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-[#1e1e1f] border-white/10">
        {step === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="text-green-400" size={32} />
            </div>
            <p className="text-white font-black text-lg">Payment Received!</p>
            <p className="text-gray-400 text-sm">Your payment is under verification</p>
          </motion.div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white text-xl">Complete Payment</DialogTitle>
              <DialogDescription className="text-gray-400">
                Pay for your coaching session with {requestDetails?.coachName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Payment Details */}
              <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Coaching Fee</span>
                  <span className="text-white font-bold">₱{coachingFee?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Date</span>
                  <span className="text-white font-bold">{requestDetails?.requestedDate}</span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
                  <span className="text-white font-black">Total Amount</span>
                  <span className="text-orange-400 font-black text-lg">₱{coachingFee?.toLocaleString()}</span>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-white text-sm font-bold block">Upload Payment Proof</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors bg-white/5">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="text-gray-400 mb-2" size={24} />
                    <p className="text-xs text-gray-400">
                      {uploadedFile ? uploadedFile.name : "Click to upload payment proof"}
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              <p className="text-xs text-gray-500">
                Accepted formats: PNG, JPG, PDF. Max size: 10MB. Staff will verify within 2 hours.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePay}
                disabled={loading || !uploadedFile}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? "Processing..." : "Submit Payment"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

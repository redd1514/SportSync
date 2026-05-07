import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, Info, CheckCircle, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_CONFIG = {
  danger:  { icon: Trash2,         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   confirmBg: 'bg-red-500 hover:bg-red-600' },
  warning: { icon: AlertTriangle,  color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', confirmBg: 'bg-orange-500 hover:bg-orange-600' },
  info:    { icon: Info,           color: '#0047AB', bg: 'rgba(0,71,171,0.12)',   border: 'rgba(0,71,171,0.25)',   confirmBg: 'bg-[#0047AB] hover:bg-[#003a8c]' },
};

interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmDialogOptions | null;
}

export function ConfirmDialog({ open, options }: ConfirmDialogProps) {
  if (!options) return null;

  const cfg = VARIANT_CONFIG[options.variant ?? 'danger'];
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={options.onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="relative w-full max-w-sm z-10"
            style={{
              background: 'linear-gradient(135deg, #1A1A1A 0%, #141414 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Close */}
            <button
              onClick={options.onCancel}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-all"
            >
              <X size={14} />
            </button>

            <div className="p-6">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <Icon size={22} style={{ color: cfg.color }} />
              </div>

              {/* JRC branding accent */}
              <div className="flex items-center gap-2 mb-3 justify-center">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
                  <span className="text-white font-black" style={{ fontSize: 10 }}>J</span>
                </div>
                <span className="text-gray-500 font-black" style={{ fontSize: 10, letterSpacing: 1 }}>JRC SPORTSYNC</span>
              </div>

              <p className="text-white mb-2 text-center" style={{ fontSize: 17, fontWeight: 900 }}>{options.title}</p>
              <p className="text-gray-400 text-center" style={{ fontSize: 13, lineHeight: 1.6 }}>{options.message}</p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={options.onCancel}
                className="flex-1 py-2.5 rounded-xl font-black transition-all text-gray-400 hover:text-white hover:bg-white/6 border border-white/8"
                style={{ fontSize: 14 }}
              >
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={options.onConfirm}
                className={`flex-1 py-2.5 rounded-xl font-black transition-all text-white ${cfg.confirmBg}`}
                style={{ fontSize: 14 }}
              >
                {options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
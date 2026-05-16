import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, X } from 'lucide-react';
import { LOYALTY_DISCOUNT_PERCENT, LOYALTY_REWARD_THRESHOLD } from '../../../constants/loyalty';

const DISPLAY_MS = 9500;

type Particle = { id: number; x: number; delay: number; color: string; size: number };

function buildParticles(count: number): Particle[] {
  const colors = ['#FBBF24', '#F97316', '#FB923C', '#FDE68A', '#22c55e'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 8 + Math.random() * 84,
    delay: Math.random() * 0.35,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 8,
  }));
}

export function LoyaltyCelebrationModal({
  open,
  onClose,
  rewardsUnlocked = 1,
}: {
  open: boolean;
  onClose: () => void;
  rewardsUnlocked?: number;
}) {
  const particles = useMemo(() => buildParticles(24), [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, DISPLAY_MS);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(12px)' }}
          onClick={onClose}
        >
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              initial={{ opacity: 0, y: '40vh', x: `${p.x}vw`, scale: 0 }}
              animate={{ opacity: [0, 0.9, 0.9, 0], y: '-8vh', scale: [0, 1, 0.8, 0] }}
              transition={{ duration: 2.8, delay: p.delay, ease: 'easeOut' }}
              style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 10px ${p.color}` }}
            />
          ))}

          <motion.div
            role="dialog"
            aria-labelledby="loyalty-celebration-title"
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="relative w-full max-w-md rounded-3xl border overflow-hidden"
            style={{
              background: 'linear-gradient(165deg, #1f180a 0%, #141416 42%, #10121c 100%)',
              borderColor: 'rgba(251,191,36,0.4)',
              boxShadow: '0 28px 90px rgba(249,115,22,0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(249,115,22,0.22), transparent 70%)',
              }}
            />

            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 z-10"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="relative px-6 sm:px-8 pt-10 pb-8 text-center">
              <div
                className="w-[4.5rem] h-[4.5rem] mx-auto mb-5 rounded-3xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #FBBF24, #F97316)',
                  boxShadow: '0 16px 48px rgba(249,115,22,0.45)',
                }}
              >
                <Trophy size={38} className="text-white" strokeWidth={2.2} />
              </div>

              <motion.div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 border border-yellow-400/35 bg-yellow-400/12">
                <Sparkles size={12} className="text-yellow-300" />
                <span className="text-yellow-200 font-black uppercase tracking-wider" style={{ fontSize: 10 }}>
                  Level up
                </span>
              </motion.div>

              <h2
                id="loyalty-celebration-title"
                className="text-white font-black mb-2"
                style={{ fontSize: 28, lineHeight: 1.12 }}
              >
                Reward Unlocked!
              </h2>

              <p className="text-gray-400 mb-1" style={{ fontSize: 15, lineHeight: 1.55 }}>
                You reached {LOYALTY_REWARD_THRESHOLD} loyalty points
                {rewardsUnlocked > 1 ? ` — ${rewardsUnlocked} rewards ready` : ''}.
              </p>
              <p className="text-gray-300 mb-6" style={{ fontSize: 15, lineHeight: 1.5 }}>
                Your next booking gets{' '}
                <span className="text-yellow-300 font-black">{LOYALTY_DISCOUNT_PERCENT}% off</span> court fees at checkout.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl text-white font-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  fontSize: 14,
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  boxShadow: '0 10px 32px rgba(249,115,22,0.4)',
                }}
              >
                Awesome — let&apos;s book!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

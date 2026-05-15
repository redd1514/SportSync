import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles } from 'lucide-react';
import { formatLoyaltyDiscountLabel, LOYALTY_REWARD_THRESHOLD } from '../../../constants/loyalty';

type LoyaltyRewardToggleProps = {
  active: boolean;
  onToggle: () => void;
  discountAmount: number;
  disabled?: boolean;
};

export function LoyaltyRewardToggle({ active, onToggle, discountAmount, disabled }: LoyaltyRewardToggleProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      layout
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 text-left disabled:opacity-50"
      style={{
        background: active ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
        borderColor: active ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.08)',
        boxShadow: active ? '0 0 24px rgba(251,191,36,0.12)' : 'none',
      }}
    >
      <motion.div className="flex items-center gap-2.5 min-w-0" layout>
        <motion.div
          animate={{
            scale: active ? [1, 1.2, 1] : 1,
            rotate: active ? [0, -8, 8, 0] : 0,
          }}
          transition={{ duration: 0.45 }}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: active ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)' }}
        >
          <Trophy size={16} style={{ color: active ? '#FBBF24' : '#9ca3af' }} />
        </motion.div>
        <motion.span
          animate={{ color: active ? '#fbbf24' : '#d1d5db' }}
          className="font-black truncate"
          style={{ fontSize: 12 }}
        >
          Redeem {LOYALTY_REWARD_THRESHOLD} pts · {formatLoyaltyDiscountLabel()}
        </motion.span>
      </motion.div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <AnimatePresence mode="wait">
          {active && (
            <motion.span
              key="spark"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="text-yellow-400"
            >
              <Sparkles size={14} />
            </motion.span>
          )}
        </AnimatePresence>
        <motion.span
          key={active ? 'on' : 'off'}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-black"
          style={{ color: '#fbbf24', fontSize: 12 }}
        >
          -₱{discountAmount.toLocaleString()}
        </motion.span>
        <motion.div
          className="w-10 h-5 rounded-full flex items-center px-0.5"
          animate={{ backgroundColor: active ? '#F97316' : '#374151' }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="w-4 h-4 bg-white rounded-full shadow"
            animate={{ x: active ? 20 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </motion.div>
      </div>
    </motion.button>
  );
}

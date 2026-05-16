import { motion } from 'motion/react';
import { TicketPercent } from 'lucide-react';
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
      className="w-full rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 text-left disabled:opacity-50"
      style={{
        background: active ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
        borderColor: active ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.08)',
        boxShadow: active ? '0 0 18px rgba(251,191,36,0.10)' : 'none',
      }}
    >
      <motion.div className="flex items-center gap-2 min-w-0" layout>
        <motion.div
          animate={{
            scale: active ? [1, 1.12, 1] : 1,
            rotate: active ? [0, -5, 5, 0] : 0,
          }}
          transition={{ duration: 0.45 }}
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: active ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)' }}
        >
          <TicketPercent size={13} style={{ color: active ? '#FBBF24' : '#9ca3af' }} />
        </motion.div>
        <div className="min-w-0">
          <motion.span
            animate={{ color: active ? '#fbbf24' : '#d1d5db' }}
            className="font-black block truncate"
            style={{ fontSize: 10.5 }}
          >
            Use {LOYALTY_REWARD_THRESHOLD} pts
          </motion.span>
          <span className="text-yellow-200/70 block truncate" style={{ fontSize: 9 }}>
            {formatLoyaltyDiscountLabel()}
          </span>
        </div>
      </motion.div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <motion.span
          key={active ? 'on' : 'off'}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-black"
          style={{ color: '#fbbf24', fontSize: 11 }}
        >
          -{'\u20B1'}{discountAmount.toLocaleString()}
        </motion.span>
        <motion.div
          className="w-8 h-4 rounded-full flex items-center px-0.5"
          animate={{ backgroundColor: active ? '#F97316' : '#374151' }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="w-3 h-3 bg-white rounded-full shadow"
            animate={{ x: active ? 16 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </motion.div>
      </div>
    </motion.button>
  );
}

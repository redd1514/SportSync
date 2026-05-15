import { useRef } from 'react';
import { motion } from 'motion/react';
import { loyaltyProgressPercent } from '../../../constants/loyalty';

type LoyaltyProgressBarProps = {
  points: number;
  height?: number;
  className?: string;
  drainDuration?: number;
  fillDuration?: number;
};

export function LoyaltyProgressBar({
  points,
  height = 6,
  className = '',
  drainDuration = 1.8,
  fillDuration = 1.15,
}: LoyaltyProgressBarProps) {
  const target = loyaltyProgressPercent(points);
  const prevPoints = useRef(points);
  const draining = points < prevPoints.current;
  prevPoints.current = points;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full ${className}`}
      style={{ height, background: 'rgba(255,255,255,0.08)' }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full loyalty-liquid-fill"
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, target))}%` }}
        transition={{
          duration: draining ? drainDuration : fillDuration,
          ease: draining ? [0.4, 0, 0.2, 1] : [0.22, 1, 0.36, 1],
        }}
        style={{
          background: 'linear-gradient(90deg, #FBBF24 0%, #F97316 55%, #FB923C 100%)',
          boxShadow: '0 0 14px rgba(251,191,36,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-40"
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}

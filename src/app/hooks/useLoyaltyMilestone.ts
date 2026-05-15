import { useEffect, useRef, useState, useCallback } from 'react';
import { getLoyaltyCelebrationsEnabled } from '../utils/loyaltyPreferences';
import { LOYALTY_REWARD_THRESHOLD, loyaltyRewardsAvailable } from '../constants/loyalty';

export function useLoyaltyMilestone(userId: string | undefined, loyaltyPoints: number) {
  const prevPoints = useRef<number | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [rewardsUnlocked, setRewardsUnlocked] = useState(1);

  const closeCelebration = useCallback(() => setCelebrationOpen(false), []);

  useEffect(() => {
    if (!userId) return;
    const prev = prevPoints.current;
    prevPoints.current = loyaltyPoints;

    if (prev === null) return;
    if (loyaltyPoints <= prev) return;
    if (!getLoyaltyCelebrationsEnabled(userId)) return;

    const prevRewards = loyaltyRewardsAvailable(prev);
    const nextRewards = loyaltyRewardsAvailable(loyaltyPoints);
    const crossedThreshold =
      loyaltyPoints >= LOYALTY_REWARD_THRESHOLD &&
      (prev < LOYALTY_REWARD_THRESHOLD || nextRewards > prevRewards);

    if (crossedThreshold) {
      setRewardsUnlocked(Math.max(1, nextRewards - prevRewards));
      setCelebrationOpen(true);
    }
  }, [loyaltyPoints, userId]);

  return { celebrationOpen, closeCelebration, rewardsUnlocked };
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { getLoyaltyCelebrationsEnabled } from '../utils/loyaltyPreferences';
import { LOYALTY_REWARD_THRESHOLD, loyaltyRewardsAvailable } from '../constants/loyalty';

const milestoneKey = (userId: string) => `sportsync_loyalty_last_celebrated:${userId}`;

export function useLoyaltyMilestone(userId: string | undefined, loyaltyPoints: number) {
  const prevPoints = useRef<number | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [rewardsUnlocked, setRewardsUnlocked] = useState(1);

  const closeCelebration = useCallback(() => setCelebrationOpen(false), []);

  useEffect(() => {
    if (!userId) return;
    const prev = prevPoints.current;
    prevPoints.current = loyaltyPoints;

    if (!getLoyaltyCelebrationsEnabled(userId)) return;

    const nextRewards = loyaltyRewardsAvailable(loyaltyPoints);
    if (nextRewards <= 0) return;

    let lastCelebrated = 0;
    try {
      lastCelebrated = Number(localStorage.getItem(milestoneKey(userId)) || 0);
    } catch {}

    const prevRewards = prev === null ? lastCelebrated : Math.max(lastCelebrated, loyaltyRewardsAvailable(prev));
    const crossedThreshold =
      loyaltyPoints >= LOYALTY_REWARD_THRESHOLD &&
      nextRewards > prevRewards;

    if (crossedThreshold) {
      setRewardsUnlocked(Math.max(1, nextRewards - prevRewards));
      setCelebrationOpen(true);
      try {
        localStorage.setItem(milestoneKey(userId), String(nextRewards));
      } catch {}
    }
  }, [loyaltyPoints, userId]);

  return { celebrationOpen, closeCelebration, rewardsUnlocked };
}

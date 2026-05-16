/** Points needed to unlock one redeemable reward tier */
export const LOYALTY_REWARD_THRESHOLD = 10;

/** Booking discount when redeeming 10 points (court and add-ons; coaching excluded). */
export const LOYALTY_DISCOUNT_PERCENT = 25;

export const LOYALTY_DISCOUNT_RATE = LOYALTY_DISCOUNT_PERCENT / 100;

export function loyaltyProgressPercent(points: number): number {
  const mod = points % LOYALTY_REWARD_THRESHOLD;
  if (points > 0 && mod === 0) return 100;
  return (mod / LOYALTY_REWARD_THRESHOLD) * 100;
}

export function loyaltyRewardsAvailable(points: number): number {
  return Math.floor(points / LOYALTY_REWARD_THRESHOLD);
}

export function loyaltyPointsToNextReward(points: number): number {
  const mod = points % LOYALTY_REWARD_THRESHOLD;
  if (points > 0 && mod === 0) return 0;
  return LOYALTY_REWARD_THRESHOLD - mod;
}

export function calcLoyaltyCourtDiscount(discountBase: number, apply: boolean): number {
  if (!apply || discountBase <= 0) return 0;
  return Math.round(discountBase * LOYALTY_DISCOUNT_RATE);
}

export function formatLoyaltyDiscountLabel(): string {
  return `${LOYALTY_DISCOUNT_PERCENT}% off booking items`;
}

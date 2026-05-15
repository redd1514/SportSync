const CELEBRATION_KEY = 'sportsync_loyalty_celebrations';

export function getLoyaltyCelebrationsEnabled(userId?: string): boolean {
  if (!userId || typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(`${CELEBRATION_KEY}_${userId}`);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

export function setLoyaltyCelebrationsEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(`${CELEBRATION_KEY}_${userId}`, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

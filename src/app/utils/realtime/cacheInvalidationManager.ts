/**
 * Cache Invalidation System
 * Manages cache keys and ensures consistency across the app
 */

import { RealtimeEvent } from './realtimeManager';

export type CacheKey = string | { resource: string; [key: string]: any };

/**
 * Cache invalidation strategies
 */
export enum InvalidationStrategy {
  /** Invalidate immediately */
  IMMEDIATE = 'IMMEDIATE',
  /** Invalidate with delay to batch updates */
  BATCH = 'BATCH',
  /** Invalidate only specific keys matching pattern */
  PATTERN = 'PATTERN',
  /** Never invalidate (for performance) */
  NEVER = 'NEVER',
}

class CacheInvalidationManager {
  private invalidationCallbacks: Map<string, Set<() => void>> = new Map();
  private batchedInvalidations: Set<string> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchDelay = 50; // ms
  private strategy = InvalidationStrategy.BATCH;

  /**
   * Subscribe to cache invalidation events for a key
   */
  onInvalidate(key: string, callback: () => void): () => void {
    if (!this.invalidationCallbacks.has(key)) {
      this.invalidationCallbacks.set(key, new Set());
    }

    this.invalidationCallbacks.get(key)!.add(callback);

    return () => {
      this.invalidationCallbacks.get(key)!.delete(callback);
    };
  }

  /**
   * Invalidate a cache key
   */
  invalidate(key: string, strategy?: InvalidationStrategy): void {
    const strategyToUse = strategy || this.strategy;

    if (strategyToUse === InvalidationStrategy.NEVER) {
      return;
    }

    if (strategyToUse === InvalidationStrategy.BATCH) {
      this.batchedInvalidations.add(key);

      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.flushInvalidations();
        }, this.batchDelay);
      }
    } else {
      this.executeInvalidation(key);
    }
  }

  /**
   * Invalidate multiple keys
   */
  invalidateMultiple(keys: string[]): void {
    keys.forEach((key) => this.invalidate(key));
  }

  /**
   * Invalidate keys matching a pattern
   */
  invalidatePattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.invalidationCallbacks.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Get invalidation key for resource
   */
  getKey(resource: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return resource;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}:${params[k]}`)
      .join('|');

    return `${resource}:${sortedParams}`;
  }

  /**
   * Invalidate based on realtime event
   */
  invalidateFromRealtimeEvent(event: RealtimeEvent<any>, table: string): void {
    const baseKey = `${table}`;

    if (event.type === 'INSERT' || event.type === 'UPDATE') {
      const record = event.new;
      if (record?.id) {
        // Invalidate specific item
        this.invalidate(`${baseKey}:${record.id}`);
      }
    } else if (event.type === 'DELETE') {
      const record = event.old;
      if (record?.id) {
        // Invalidate specific item
        this.invalidate(`${baseKey}:${record.id}`);
      }
    }

    // Invalidate list cache
    this.invalidatePattern(`${baseKey}:.*`);
    this.invalidate(`${baseKey}:all`);
  }

  /**
   * Execute invalidation callbacks
   */
  private executeInvalidation(key: string): void {
    const callbacks = this.invalidationCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error(`[CacheInvalidation] Error in callback for ${key}:`, error);
        }
      });
    }
  }

  /**
   * Flush all batched invalidations
   */
  private flushInvalidations(): void {
    this.batchedInvalidations.forEach((key) => {
      this.executeInvalidation(key);
    });

    this.batchedInvalidations.clear();
    this.batchTimeout = null;
  }

  /**
   * Clear all invalidations (for cleanup)
   */
  clear(): void {
    this.invalidationCallbacks.clear();
    this.batchedInvalidations.clear();
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
  }

  /**
   * Set invalidation strategy
   */
  setStrategy(strategy: InvalidationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get cache key for common resources
   */
  static resources = {
    bookings: (userId?: string) =>
      userId ? `bookings:user:${userId}` : 'bookings:all',
    booking: (bookingId: string) => `booking:${bookingId}`,
    coachingSessions: (userId?: string, role?: string) =>
      userId ? `coaching_sessions:${userId}:${role}` : 'coaching_sessions:all',
    coachingSession: (sessionId: string) => `coaching_session:${sessionId}`,
    notifications: (userId: string) => `notifications:${userId}`,
    notification: (notificationId: string) => `notification:${notificationId}`,
    announcements: 'announcements:all',
    announcement: (announcementId: string) => `announcement:${announcementId}`,
    facilities: 'facilities:all',
    facility: (facilityId: string) => `facility:${facilityId}`,
    coaches: (sport?: string) =>
      sport ? `coaches:${sport}` : 'coaches:all',
    coach: (coachId: string) => `coach:${coachId}`,
    availability: (coachId: string, date: string) =>
      `availability:${coachId}:${date}`,
  };
}

export const cacheInvalidationManager = new CacheInvalidationManager();

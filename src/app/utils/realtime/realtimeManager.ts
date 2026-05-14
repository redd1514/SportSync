/**
 * Supabase Realtime Subscription Manager
 * Handles subscription lifecycle, reconnection, and event batching
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../utils/supabase/client';

export interface RealtimeEvent<T> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
  eventId?: string;
  timestamp: number;
}

export interface SubscriptionConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  schema?: string;
  enabled?: boolean;
}

export interface RealtimeSubscriber<T> {
  id: string;
  callback: (event: RealtimeEvent<T>) => void;
  filter?: (event: RealtimeEvent<T>) => boolean;
  priority?: number; // Higher priority callbacks execute first
}

class RealtimeSubscriptionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscribers: Map<string, RealtimeSubscriber<any>[]> = new Map();
  private eventDeduplication: Map<string, number> = new Map();
  private deduplicationWindow = 1000; // 1 second
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private statusCallbacks: Array<(status: typeof this.connectionStatus) => void> = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private eventBatch: Map<string, RealtimeEvent<any>[]> = new Map();
  private batchSize = 50;
  private batchTimeout = 100; // ms

  constructor(private supabaseClient: SupabaseClient = supabase) {}

  /**
   * Subscribe to realtime table changes
   */
  subscribe<T>(
    channelKey: string,
    config: SubscriptionConfig,
    callback: (event: RealtimeEvent<T>) => void,
    options?: {
      filter?: (event: RealtimeEvent<T>) => boolean;
      priority?: number;
      deduplicateEvents?: boolean;
    }
  ): string {
    const subscriberId = `${channelKey}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize subscriber list for this channel
    if (!this.subscribers.has(channelKey)) {
      this.subscribers.set(channelKey, []);
    }

    // Add subscriber
    const subscriber: RealtimeSubscriber<T> = {
      id: subscriberId,
      callback,
      filter: options?.filter,
      priority: options?.priority ?? 0,
    };

    this.subscribers.get(channelKey)!.push(subscriber);

    // Sort by priority (higher first)
    this.subscribers.get(channelKey)!.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Create channel if it doesn't exist
    if (!this.channels.has(channelKey)) {
      this.createChannel(channelKey, config);
    }

    return subscriberId;
  }

  /**
   * Unsubscribe from realtime updates
   */
  unsubscribe(channelKey: string, subscriberId: string): void {
    const subscribers = this.subscribers.get(channelKey);
    if (subscribers) {
      const index = subscribers.findIndex((sub) => sub.id === subscriberId);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }

      // Clean up channel if no more subscribers
      if (subscribers.length === 0) {
        this.removeChannel(channelKey);
      }
    }
  }

  /**
   * Create and set up a realtime channel
   */
  private createChannel(channelKey: string, config: SubscriptionConfig): void {
    if (config.enabled === false) return;

    const channel = this.supabaseClient
      .channel(channelKey, {
        config: {
          broadcast: { self: false },
          presence: { key: channelKey },
        },
      })
      .on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload: any) => {
          this.handleEvent(channelKey, payload);
        }
      )
      .on('system', { event: '*' }, (payload: any) => {
        if (payload.type === 'channel_error') {
          console.error(`[Realtime] Channel error on ${channelKey}:`, payload);
          this.reconnectChannel(channelKey);
        }
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to ${channelKey}`);
        this.updateConnectionStatus('connected');
        this.reconnectAttempts.set(channelKey, 0);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Channel error: ${channelKey}`);
        this.reconnectChannel(channelKey);
      } else if (status === 'TIMED_OUT') {
        console.warn(`[Realtime] Channel timed out: ${channelKey}`);
        this.reconnectChannel(channelKey);
      }
    });

    this.channels.set(channelKey, channel);
  }

  /**
   * Handle incoming realtime event with deduplication
   */
  private handleEvent(channelKey: string, payload: any): void {
    console.log(`[Realtime] handleEvent channel=${channelKey} payload:`, payload);
    const event = this.parsePayload(payload);

    // Deduplicate events
    const eventKey = this.getEventKey(payload);
    const lastEventTime = this.eventDeduplication.get(eventKey);
    const now = Date.now();

    if (lastEventTime && now - lastEventTime < this.deduplicationWindow) {
      console.log(`[Realtime] Deduplicated event: ${eventKey}`);
      return;
    }

    this.eventDeduplication.set(eventKey, now);

    // Batch events
    if (!this.eventBatch.has(channelKey)) {
      this.eventBatch.set(channelKey, []);
    }

    this.eventBatch.get(channelKey)!.push(event);

    // Flush if batch is full
    if (this.eventBatch.get(channelKey)!.length >= this.batchSize) {
      this.flushBatch(channelKey);
    } else if (!this.batchInterval) {
      // Schedule flush
      this.batchInterval = setTimeout(() => {
        this.eventBatch.forEach((_, key) => this.flushBatch(key));
        this.batchInterval = null;
      }, this.batchTimeout);
    }
  }

  /**
   * Parse Supabase payload to standard event format
   */
  private parsePayload(payload: any): RealtimeEvent<any> {
    return {
      type: payload.eventType || 'UPDATE',
      new: payload.new,
      old: payload.old,
      eventId: payload.eventId,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate deduplication key for event
   */
  private getEventKey(payload: any): string {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const record = newRecord || oldRecord;
    const id = record?.id || '';
    return `${eventType}-${id}-${record?.updated_at || record?.created_at || ''}`;
  }

  /**
   * Flush batched events to subscribers
   */
  private flushBatch(channelKey: string): void {
    const events = this.eventBatch.get(channelKey);
    if (!events || events.length === 0) return;

    const subscribers = this.subscribers.get(channelKey) || [];

    for (const event of events) {
      for (const subscriber of subscribers) {
        // Apply filter if present
        if (subscriber.filter && !subscriber.filter(event)) {
          continue;
        }

        try {
          subscriber.callback(event);
        } catch (error) {
          console.error(`[Realtime] Error in subscriber callback:`, error);
        }
      }
    }

    this.eventBatch.delete(channelKey);
  }

  /**
   * Reconnect a channel after failure
   */
  private reconnectChannel(channelKey: string): void {
    const attempts = (this.reconnectAttempts.get(channelKey) || 0) + 1;
    this.reconnectAttempts.set(channelKey, attempts);

    if (attempts > this.maxReconnectAttempts) {
      console.error(`[Realtime] Max reconnect attempts reached for ${channelKey}`);
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts - 1), 30000);
    console.log(`[Realtime] Reconnecting ${channelKey} in ${delay}ms (attempt ${attempts})`);

    setTimeout(() => {
      const channel = this.channels.get(channelKey);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelKey);

        // Re-create channel (you'll need to store config)
        // For now, just recreate with stored config
        const subscribers = this.subscribers.get(channelKey);
        if (subscribers && subscribers.length > 0) {
          // Would need to store config to recreate
          this.updateConnectionStatus('connecting');
        }
      }
    }, delay);
  }

  /**
   * Remove a channel and all its subscribers
   */
  private removeChannel(channelKey: string): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelKey);
    }
    this.subscribers.delete(channelKey);
  }

  /**
   * Update and notify of connection status changes
   */
  private updateConnectionStatus(
    status: typeof this.connectionStatus
  ): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusCallbacks.forEach((cb) => cb(status));
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(
    callback: (status: typeof this.connectionStatus) => void
  ): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index !== -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): typeof this.connectionStatus {
    return this.connectionStatus;
  }

  /**
   * Clean up all subscriptions and channels
   */
  cleanup(): void {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
    this.subscribers.clear();
    this.eventDeduplication.clear();
    if (this.batchInterval) {
      clearTimeout(this.batchInterval);
    }
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return Array.from(this.subscribers.values()).reduce((sum, subs) => sum + subs.length, 0);
  }

  /**
   * Get channel count
   */
  getChannelCount(): number {
    return this.channels.size;
  }
}

export const realtimeManager = new RealtimeSubscriptionManager();

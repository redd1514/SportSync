/**
 * Realtime Event Emitter
 * Broadcasts events to connected clients via Supabase Realtime
 */

import { supabase } from '../services/supabaseClient.ts';

export interface RealtimeEventPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record?: Record<string, any>;
  oldRecord?: Record<string, any>;
  userId?: string;
  timestamp: string;
  [key: string]: any;
}

class RealtimeEventEmitter {
  /**
   * Emit INSERT event
   */
  static async emitInsert(
    table: string,
    record: Record<string, any>,
    options?: { userId?: string }
  ): Promise<void> {
    try {
      await supabase.from('realtime_events').insert({
        event_type: 'INSERT',
        table_name: table,
        record,
        user_id: options?.userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[RealtimeEventEmitter] Failed to emit INSERT for ${table}:`, error);
    }
  }

  /**
   * Emit UPDATE event
   */
  static async emitUpdate(
    table: string,
    record: Record<string, any>,
    oldRecord?: Record<string, any>,
    options?: { userId?: string }
  ): Promise<void> {
    try {
      await supabase.from('realtime_events').insert({
        event_type: 'UPDATE',
        table_name: table,
        record,
        old_record: oldRecord,
        user_id: options?.userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[RealtimeEventEmitter] Failed to emit UPDATE for ${table}:`, error);
    }
  }

  /**
   * Emit DELETE event
   */
  static async emitDelete(
    table: string,
    record: Record<string, any>,
    options?: { userId?: string }
  ): Promise<void> {
    try {
      await supabase.from('realtime_events').insert({
        event_type: 'DELETE',
        table_name: table,
        record,
        user_id: options?.userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[RealtimeEventEmitter] Failed to emit DELETE for ${table}:`, error);
    }
  }

  /**
   * Broadcast event to specific users or channels
   * Uses Postgres NOTIFY for real-time updates
   */
  static async broadcast(
    channel: string,
    event: string,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      // Use Supabase client's realtime broadcast
      await supabase.realtime.send({
        type: 'broadcast',
        event,
        payload,
      } as any);
    } catch (error) {
      console.error(`[RealtimeEventEmitter] Failed to broadcast:`, error);
    }
  }

  /**
   * Notify specific user of event
   */
  static async notifyUser(
    userId: string,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from('notifications').insert({
        recipient_id: userId,
        event_type: eventType,
        data,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[RealtimeEventEmitter] Failed to notify user ${userId}:`, error);
    }
  }
}

export { RealtimeEventEmitter };
